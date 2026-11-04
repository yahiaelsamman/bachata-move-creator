/* Movie: the animated leader view of one move, with Play, a scrubber and the current count. */
(function (App) {
  'use strict';
  const Motion = window.Motion;
  const { h, button, posName } = App;
  const BEAT_MS = 500;     // 120 bpm, a comfortable bachata tempo to watch
  const QUICK_MS = 700;    // catches and releases (0 counts) still get a short animation

  /** The count the dancers are on at t, e.g. 5, 6, 7, 8, 1 for an 8-count move that starts on 5. */
  const countAt = (it, t) => ((it.beat - 1 + Math.min(it.move.counts - 1, Math.floor(t * it.move.counts))) % 8) + 1;

  App.movieFigure = function (it) {
    const g = App.g;
    const m = it.move;
    const from = g.posById[it.from];
    const to = g.posById[it.to];
    const bounds = Motion.movieBounds(m, from, to);
    const duration = m.counts ? m.counts * BEAT_MS : QUICK_MS;
    const art = h('div', { class: 'sk-art' });
    const scrub = h('input', { type: 'range', min: '0', max: '1000', value: '0', 'aria-label': `Position in ${m.name}` });
    const count = h('span', { class: 'mv-count' });
    let raf = null;
    let startedAt = 0;

    function draw(t) {
      art.innerHTML = Motion.frameSVG(m, from, to, t, bounds);
      scrub.value = String(Math.round(t * 1000));
      count.textContent = m.counts ? `count ${countAt(it, t)}` : t < 0.5 ? 'start' : 'end';
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      play.textContent = '▶ Play';
    }
    function step(now) {
      if (!art.isConnected) return stop();       // the panel was redrawn
      const t = Math.min(1, (now - startedAt) / duration);
      draw(t);
      if (t < 1) raf = requestAnimationFrame(step); else stop();
    }
    const play = button('▶ Play', () => {
      if (raf) return stop();
      const from0 = Number(scrub.value) >= 1000 ? 0 : Number(scrub.value) / 1000;   // replay from the start at the end
      startedAt = performance.now() - from0 * duration;
      play.textContent = '❚❚ Pause';
      raf = requestAnimationFrame(step);
    }, { class: 'mv-play' });
    scrub.addEventListener('input', () => { stop(); draw(Number(scrub.value) / 1000); });

    draw(0);
    return h('figure', { class: 'sk-fig movie' }, art,
      h('div', { class: 'mv-controls' }, play, scrub, count),
      h('figcaption', {}, h('strong', {}, 'Start: '), posName(it.from), h('br'), h('strong', {}, 'End: '), posName(it.to)));
  };

  /** A frame of a move for practice mode (t from 0 to 1). */
  App.moveFrame = (it, t) => Motion.frameSVG(it.move, App.g.posById[it.from], App.g.posById[it.to], t);
})(window.App);
