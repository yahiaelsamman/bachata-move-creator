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

  /** "3", "3¼", "3½", "3¾": the count, with quarters when paused between counts. */
  const QUARTERS = ['', '¼', '½', '¾'];
  App.countText = function (seg, t, exact) {
    const pos = Math.min(seg.counts, t * seg.counts);
    const q = exact && pos < seg.counts ? Math.floor((pos - Math.floor(pos)) * 4 + 1e-6) : 0;
    return `${countAt(seg, t)}${QUARTERS[q]}`;
  };

  /**
   * The player: a sketch, the counts 1-8 (tap one to jump there and stop), a scrubber drawn over the
   * moves' colours, Play/Pause between two buttons that step a quarter count back or forward, and a
   * status line. `label(seg, t, paused)` says where we are; `onSegment(seg | null)` is told which
   * segment shows (null when stopped).
   */
  function player(segments, { label, onSegment = () => {}, ariaLabel }) {
    const total = segments.reduce((sum, s) => sum + durationOf(s), 0);
    const bounds = sharedBounds(segments);
    const starts = [];                               // ms at which each segment starts
    segments.reduce((ms, s) => { starts.push(ms); return ms + durationOf(s); }, 0);
    const art = h('div', { class: 'sk-art', role: 'img', 'aria-label': `Leader view, seen from above: ${ariaLabel.replace(/^Position in /, '')}` });
    const scrub = h('input', { type: 'range', min: '0', max: '1000', value: '0', 'aria-label': ariaLabel });
    const status = h('span', { class: 'mv-count', 'aria-live': 'polite' });
    const nums = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => button(String(n), () => goToCount(n), { class: 'num', 'aria-label': `Stop on count ${n}`, title: `Stop on count ${n}` }));
    const beats = h('div', { class: 'mv-beats' }, h('span', { class: 'eyebrow' }, 'Count · tap to stop there'), h('div', { class: 'nums' }, nums));
    const segs = h('div', { class: 'mv-segs', 'aria-hidden': 'true' },
      segments.map((s) => h('i', { class: `k-${s.move.kind}`, style: `flex: ${durationOf(s)} 1 0` })));
    let raf = null;
    let startedAt = 0;
    let at = 0;                                      // where we are, in ms

    /** The counts (1-8) that occur in the animation, with the time each one starts. */
    const beatTimes = [];
    segments.forEach((s, i) => {
      for (let k = 0; k < s.counts; k++) beatTimes.push({ ms: starts[i] + k * BEAT_MS, count: ((s.beat - 1 + k) % 8) + 1, seg: i });
    });
    const segAt = (ms) => Math.max(0, starts.findIndex((st, i) => ms >= st && ms < st + durationOf(segments[i])));

    function draw(ms, playing) {
      at = Math.max(0, Math.min(total, ms));
      const { seg, t } = locate(segments, at);
      art.innerHTML = Motion.frameSVG(seg.move, seg.from, seg.to, t, bounds);
      scrub.value = String(Math.round((at / total) * 1000));
      status.textContent = label(seg, t, !playing);
      const now = seg.counts ? countAt(seg, t) : 0;
      nums.forEach((el, i) => {
        el.classList.toggle('now', i + 1 === now);
        el.disabled = !beatTimes.some((b) => b.count === i + 1);
      });
      onSegment(playing ? seg : null);
    }
    function setButton(playing) {
      play.textContent = playing ? '❚❚' : '▶';
      play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      play.title = playing ? 'Pause' : 'Play';
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      setButton(false);
      onSegment(null);
    }
    function step(now) {
      if (!art.isConnected) return stop();         // the panel was redrawn
      const ms = Math.min(total, now - startedAt);
      draw(ms, ms < total);
      if (ms < total) raf = requestAnimationFrame(step); else stop();
    }
    /** Stop and show a moment (ms). */
    function showAt(ms) { stop(); draw(ms, false); }
    /** Jump to the start of count n: in the move on screen if it has that count, else the nearest one. */
    function goToCount(n) {
      const cur = segAt(at);
      const options = beatTimes.filter((b) => b.count === n);
      if (!options.length) return;
      const here = options.filter((b) => b.seg === cur);
      const pick = (here.length ? here : options).reduce((a, b) => (Math.abs(b.ms - at) < Math.abs(a.ms - at) ? b : a));
      showAt(pick.ms);
    }
    /** A quarter count back or forward (a 0-count move takes four steps too). */
    function nudge(dir, whole = false) {
      const seg = segments[segAt(Math.min(at, total - 1e-6))];
      const unit = (seg.counts ? BEAT_MS : QUICK_MS) / (whole ? 1 : 4);
      const grid = Math.round(at / unit) * unit;      // snap to the quarter grid, then move
      showAt(Math.abs(grid - at) > 1 ? (dir > 0 ? Math.ceil(at / unit) : Math.floor(at / unit)) * unit : grid + dir * unit);
    }
    const play = button('▶', () => {
      if (raf) return stop();
      const from = at >= total ? 0 : at;              // at the end: replay
      startedAt = performance.now() - from;
      setButton(true);
      raf = requestAnimationFrame(step);
    }, { class: 'mv-play' });
    setButton(false);
    const back = button('‹', () => nudge(-1), { class: 'mv-step', 'aria-label': 'A quarter count back', title: 'A quarter count back (← on the slider)' });
    const fwd = button('›', () => nudge(1), { class: 'mv-step', 'aria-label': 'A quarter count forward', title: 'A quarter count forward (→ on the slider)' });
    scrub.addEventListener('input', () => showAt((Number(scrub.value) / 1000) * total));
    // Arrow keys on the slider: a quarter count; with Shift, a whole count.
    scrub.addEventListener('keydown', (ev) => {
      const dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[ev.key];
      if (!dir) return;
      ev.preventDefault();
      nudge(dir, ev.shiftKey);
    });

    draw(0, false);
    return {
      art, status,
      controls: h('div', { class: 'mv-controls' }, beats, h('div', { class: 'mv-track' }, segs, scrub), h('div', { class: 'mv-buttons' }, back, play, fwd)),
    };
  }

  App.movieFigure = function (it) {
    const seg = segmentOf(it, null);
    const { art, status, controls } = player([seg], {
      ariaLabel: `Position in ${it.move.name}`,
      label: (s, t, paused) => (s.counts ? `count ${App.countText(s, t, paused)}` : t < 0.5 ? 'start' : 'end'),
    });
    return h('figure', { class: 'sk-fig movie' }, art, controls, status, App.heightKey(),
      h('figcaption', {}, viewTurnsNote(seg), h('strong', {}, 'Start: '), posName(it.from), h('br'), h('strong', {}, 'End: '), posName(it.to)));
  };

  /**
   * The picture turns with the leader. When the leader turns and that moves the partner round him
   * (e.g. a half turn into the leader's shadow), the leader is drawn still and the partner goes round:
   * say so, or it looks as if the partner did the turn.
   */
  function viewTurnsNote(seg) {
    const turn = Motion.turnsOf(seg.move).leader;
    if (!turn) return null;
    const a = Motion.frameAt(seg.move, seg.from, seg.to, 0).leader.face;
    const b = Motion.frameAt(seg.move, seg.from, seg.to, 0.5).leader.face;
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) > 0.05) return null;     // the leader is drawn turning
    const size = Math.abs(turn) === 180 ? 'a half turn' : Math.abs(turn) === 90 ? 'a quarter turn' : 'a turn';
    return h('span', { class: 'view-note' }, `You make ${size} to the ${turn > 0 ? 'right' : 'left'}. The picture turns with you, so your partner seems to go round you.`, h('br'));
  }

  /** Light up the domino that is playing (without redrawing the strip). */
  function highlight(index) {
    document.querySelectorAll('#strip .domino:not(.add)').forEach((el, i) => el.classList.toggle('playing', i === index));
  }

  App.comboFigure = function (result) {
    const segments = comboSegments(result);
    if (!segments.length) return null;
    const dominoes = result.items.length;
    const { art, status, controls } = player(segments, {
      ariaLabel: 'Position in the combo',
      label: (s, t, paused) => `${s.index + 1}/${dominoes} · ${s.move.name}` + (s.counts ? ` · count ${App.countText(s, t, paused)}` : ''),
      onSegment: (s) => highlight(s ? s.index : null),
    });
    const breaks = result.items.filter((it) => it.broken).length;
    return h('figure', { class: 'sk-fig movie combo-movie' }, art, controls, status, App.heightKey(),
      h('figcaption', {}, h('strong', {}, 'Whole combo: '), `${result.items.length} moves, ${result.totalCounts} counts`,
        breaks ? h('span', { class: 'flag' }, ` · ${breaks} break${breaks > 1 ? 's' : ''}: the picture jumps there`) : null));
  };

  /** A frame of a move for practice mode (t from 0 to 1). */
  App.moveFrame = (it, t) => Motion.frameSVG(it.move, App.g.posById[it.from], App.g.posById[it.to], t);
})(window.App);
