/*
 * Movies: the animated leader view.
 *   App.movieFigure(item)    one move: Play, a scrubber and the current count
 *   App.comboFigure(result)  the whole combo, move after move (combo blocks play their parts);
 *                            the domino that is playing lights up in the strip
 * Both are the same player over a list of segments (one segment = one move).
 */
(function (App) {
  'use strict';
  const MG = window.MoveGraph;
  const Motion = window.Motion;
  const { h, button, posName } = App;
  const BEAT_MS = 500;     // 120 bpm, a comfortable bachata tempo to watch
  const QUICK_MS = 500;    // catches and releases (0 counts) still get a short animation

  const durationOf = (seg) => (seg.counts ? seg.counts * BEAT_MS : QUICK_MS);

  /** The count the dancers are on at t within a segment, e.g. 5, 6, 7, 8, 1 for an 8-count move starting on 5. */
  const countAt = (seg, t) => ((seg.beat - 1 + Math.min(seg.counts - 1, Math.floor(t * seg.counts))) % 8) + 1;

  function segmentOf(it, index) {
    const g = App.g;
    return { move: it.move, from: g.posById[it.from], to: g.posById[it.to], beat: it.beat, counts: it.move.counts, index };
  }

  /** The moves a combo plays, with combo blocks opened up into their parts. */
  function comboSegments(result) {
    const g = App.g;
    const out = [];
    const add = (it, index, depth) => {
      if (it.missing || !it.from || !it.to) return;
      if (it.move.kind === 'compound' && depth < 4) {
        const parts = MG.evaluateStrip(g, it.from, it.weightIn || 'mirrored', it.move.sequence);
        const beatShift = it.countFrom;
        for (const p of parts.items) add({ ...p, beat: ((p.countFrom + beatShift) % 8) + 1 }, index, depth + 1);
        return;
      }
      out.push(segmentOf(it, index));
    };
    result.items.forEach((it, i) => add(it, i, 0));
    return out;
  }

  /** One picture area for every segment, so the drawing doesn't jump from move to move. */
  function sharedBounds(segments) {
    const all = segments.map((s) => Motion.movieBounds(s.move, s.from, s.to));
    const pick = (k, f) => f(...all.map((b) => b[k]));
    return { top: pick('top', Math.min), bottom: pick('bottom', Math.max), left: pick('left', Math.min), right: pick('right', Math.max) };
  }

  /** Where we are at a time (ms) in the list: the segment and t within it. */
  function locate(segments, ms) {
    let start = 0;
    for (const seg of segments) {
      const d = durationOf(seg);
      if (ms < start + d) return { seg, t: (ms - start) / d };
      start += d;
    }
    return { seg: segments[segments.length - 1], t: 1 };
  }

  /**
   * The player: a sketch, Play/Pause, a scrubber and a status line.
   * `label(seg, t)` says where we are; `onSegment(seg | null)` is told which segment shows (null when stopped).
   */
  function player(segments, { label, onSegment = () => {}, ariaLabel }) {
    const total = segments.reduce((sum, s) => sum + durationOf(s), 0);
    const bounds = sharedBounds(segments);
    const art = h('div', { class: 'sk-art' });
    const scrub = h('input', { type: 'range', min: '0', max: '1000', value: '0', 'aria-label': ariaLabel });
    const status = h('span', { class: 'mv-count' });
    let raf = null;
    let startedAt = 0;

    function draw(fraction, playing) {
      const { seg, t } = locate(segments, fraction * total);
      art.innerHTML = Motion.frameSVG(seg.move, seg.from, seg.to, t, bounds);
      scrub.value = String(Math.round(fraction * 1000));
      status.textContent = label(seg, t);
      onSegment(playing ? seg : null);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      play.textContent = '▶ Play';
      onSegment(null);
    }
    function step(now) {
      if (!art.isConnected) return stop();         // the panel was redrawn
      const fraction = Math.min(1, (now - startedAt) / total);
      draw(fraction, fraction < 1);
      if (fraction < 1) raf = requestAnimationFrame(step); else stop();
    }
    const play = button('▶ Play', () => {
      if (raf) return stop();
      const from = Number(scrub.value) >= 1000 ? 0 : Number(scrub.value) / 1000;   // at the end: replay
      startedAt = performance.now() - from * total;
      play.textContent = '❚❚ Pause';
      raf = requestAnimationFrame(step);
    }, { class: 'mv-play' });
    scrub.addEventListener('input', () => { stop(); draw(Number(scrub.value) / 1000, false); });

    draw(0, false);
    return { art, controls: h('div', { class: 'mv-controls' }, play, scrub, status) };
  }

  App.movieFigure = function (it) {
    const seg = segmentOf(it, null);
    const { art, controls } = player([seg], {
      ariaLabel: `Position in ${it.move.name}`,
      label: (s, t) => (s.counts ? `count ${countAt(s, t)}` : t < 0.5 ? 'start' : 'end'),
    });
    return h('figure', { class: 'sk-fig movie' }, art, controls, App.heightKey(),
      h('figcaption', {}, h('strong', {}, 'Start: '), posName(it.from), h('br'), h('strong', {}, 'End: '), posName(it.to)));
  };

  /** Light up the domino that is playing (without redrawing the strip). */
  function highlight(index) {
    document.querySelectorAll('#strip .domino:not(.add)').forEach((el, i) => el.classList.toggle('playing', i === index));
  }

  App.comboFigure = function (result) {
    const segments = comboSegments(result);
    if (!segments.length) return null;
    const dominoes = result.items.length;
    const { art, controls } = player(segments, {
      ariaLabel: 'Position in the combo',
      label: (s, t) => `${s.index + 1}/${dominoes} · ${s.move.name}` + (s.counts ? ` · count ${countAt(s, t)}` : ''),
      onSegment: (s) => highlight(s ? s.index : null),
    });
    const breaks = result.items.filter((it) => it.broken).length;
    return h('figure', { class: 'sk-fig movie combo-movie' }, art, controls, App.heightKey(),
      h('figcaption', {}, h('strong', {}, 'Whole combo: '), `${result.items.length} moves, ${result.totalCounts} counts`,
        breaks ? h('span', { class: 'flag' }, ` · ${breaks} break${breaks > 1 ? 's' : ''}: the picture jumps there`) : null));
  };

  /** A frame of a move for practice mode (t from 0 to 1). */
  App.moveFrame = (it, t) => Motion.frameSVG(it.move, App.g.posById[it.from], App.g.posById[it.to], t);
})(window.App);
