/*
 * Practice mode: steps through a combo one big card at a time, optionally on a
 * beat (tempo in BPM, optional click sound). 0-count moves (catches, releases)
 * are shown on the card of the move they happen in.
 *
 *   Practice.open(items, view, startAt)
 *     items:   the evaluated strip (MoveGraph.evaluateStrip(...).items)
 *     view:    { posName(id), sketch(id) -> SVG markup, or '' }
 *     startAt: index of the item to start on
 *
 * Self-contained (no App): the Node tests load it with a small window shim.
 */
(function () {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const prefs = (() => {
    try { return JSON.parse(localStorage.getItem('bmc.practice') || '{}'); } catch { return {}; }
  })();
  const savePrefs = () => { try { localStorage.setItem('bmc.practice', JSON.stringify(prefs)); } catch { /* ignore */ } };

  let dlg, steps = [], idx = 0, beat = 0, timer = null, audio = null, view = null, countIn = 0, wakeLock = null;
  const q = (selector) => dlg.querySelector(selector);
  // Click, count-in and loop are on unless turned off; counting aloud is off unless turned on.
  const isOn = (name) => (name === 'voice' ? Boolean(prefs.voice) : prefs[name] !== false);
  const loops = () => isOn('loop');

  /** Fold 0-count moves into the next counted move ("then on the fly: …"). */
  function buildSteps(items) {
    const out = [];
    let pending = [];
    for (const it of items) {
      if (it.missing) continue;
      if (!it.move.counts) { pending.push(it); continue; }
      out.push({ it, extras: pending });
      pending = [];
    }
    if (pending.length) {
      if (out.length) out[out.length - 1].after = pending;
      else out.push({ it: pending[pending.length - 1], extras: pending.slice(0, -1) });
    }
    return out;
  }

  function ensureDialog() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.className = 'practice';
    dlg.setAttribute('aria-label', 'Practice mode');
    dlg.innerHTML = `
      <div class="pr-top">
        <strong>Practice</strong>
        <span class="pr-progress"></span>
        <button type="button" class="ghost pr-close">Close</button>
      </div>
      <div class="pr-card"></div>
      <div class="pr-beats" aria-hidden="true">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<span data-n="${n}">${n}</span>`).join('')}</div>
      <div class="pr-next muted"></div>
      <div class="pr-controls">
        <button type="button" class="pr-prev" aria-label="Previous move">‹ Prev</button>
        <button type="button" class="primary pr-play">Play</button>
        <button type="button" class="pr-nextbtn" aria-label="Next move">Next ›</button>
      </div>
      <div class="pr-settings">
        <label>Tempo <input type="range" class="pr-bpm" min="80" max="160" step="2"> <span class="pr-bpm-val"></span> bpm</label>
        <label><input type="checkbox" class="pr-sound"> Click</label>
        <label><input type="checkbox" class="pr-voice"> Count aloud</label>
        <label><input type="checkbox" class="pr-countin"> Count-in (5-6-7-8)</label>
        <label><input type="checkbox" class="pr-loop"> Loop</label>
      </div>`;
    document.body.append(dlg);
    q('.pr-close').addEventListener('click', () => dlg.close());
    q('.pr-prev').addEventListener('click', () => go(idx - 1));
    q('.pr-nextbtn').addEventListener('click', () => go(idx + 1));
    q('.pr-play').addEventListener('click', toggle);
    const bpm = q('.pr-bpm');
    bpm.value = prefs.bpm || 124;
    q('.pr-bpm-val').textContent = bpm.value;
    bpm.addEventListener('input', () => {
      prefs.bpm = Number(bpm.value); savePrefs();
      q('.pr-bpm-val').textContent = bpm.value;
      if (timer) { stop(); start(); }
    });
    for (const name of ['sound', 'voice', 'countin', 'loop']) {
      const box = q('.pr-' + name);
      box.checked = isOn(name);
      box.addEventListener('change', () => { prefs[name] = box.checked; savePrefs(); });
    }
    if (!('speechSynthesis' in window)) q('.pr-voice').closest('label').hidden = true;
    dlg.addEventListener('close', stop);
    dlg.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
      else if (e.key === ' ') { e.preventDefault(); toggle(); }
    });
    return dlg;
  }

  function go(i) {
    if (!steps.length) return;
    if (i >= steps.length) i = loops() ? 0 : steps.length - 1;
    if (i < 0) i = 0;
    idx = i;
    beat = 0;
    render();
  }

  function render() {
    const step = steps[idx];
    q('.pr-progress').textContent = steps.length ? `${idx + 1} / ${steps.length}` : '';
    if (!step) {
      q('.pr-card').innerHTML = '<p>Add some moves first.</p>';
      return;
    }
    const { it, extras = [], after = [] } = step;
    const m = it.move;
    const firstFrom = extras.length ? extras[0].from : it.from;
    const lastTo = after.length ? after[after.length - 1].to : it.to;
    const sk = (id, label) => {
      const svg = view.sketch(id);
      return svg ? `<figure><div>${svg}</div><figcaption>${label}: ${esc(view.posName(id))}</figcaption></figure>` : '';
    };
    q('.pr-card').innerHTML = `
      ${extras.length ? `<p class="pr-extra">First, on the fly: ${extras.map((x) => esc(x.move.name)).join(' › ')}</p>` : ''}
      <h2 class="pr-name">${esc(m.name)}</h2>
      <p class="pr-meta"><span class="badge k-${esc(m.kind)}">${esc(view.kindLabel(m.kind))}</span> ${m.counts} counts · beats ${window.MoveGraph.beatRange(it.beat, m.counts)}</p>
      ${after.length ? `<p class="pr-extra">Then, on the fly: ${after.map((x) => esc(x.move.name)).join(' › ')}</p>` : ''}
      ${m.notes ? `<p class="pr-notes">${esc(m.notes)}</p>` : ''}
      <div class="pr-sketches">${firstFrom === lastTo ? sk(firstFrom, 'Start and end') : sk(firstFrom, 'Start') + sk(lastTo, 'End')}</div>`;
    const nextStep = steps[idx + 1] || (loops() ? steps[0] : null);
    q('.pr-next').textContent = nextStep ? `Next: ${nextStep.it.move.name}` : 'Last move';
    paintBeats();
  }

  function paintBeats() {
    const step = steps[idx];
    if (!step) return;
    const start = step.it.countFrom % 8;
    const n = step.it.move.counts;
    const current = (start + beat) % 8;
    dlg.querySelectorAll('.pr-beats span').forEach((el, k) => {
      const inMove = ((k - start + 8) % 8) < Math.min(n, 8);
      // During the count-in, 5-6-7-8 light up before the first move starts.
      const counting = countIn > 0 && k === 8 - countIn;
      el.className = (inMove ? 'in' : '') + ((timer && !countIn && k === current) || counting ? ' now' : '');
    });
  }

  function click(accent) {
    if (!isOn('sound')) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator();
      const gain = audio.createGain();
      o.frequency.value = accent ? 1600 : 1000;
      gain.gain.setValueAtTime(0.25, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.05);
      o.connect(gain).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + 0.06);
    } catch { /* no audio */ }
  }

  const WORDS = ['one', 'two', 'three', 'tap', 'five', 'six', 'seven', 'tap'];
  function say(k) {
    if (!prefs.voice || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(WORDS[k]);
      u.rate = 1.8;
      u.volume = 0.9;
      window.speechSynthesis.speak(u);
    } catch { /* speech not available */ }
  }

  function tick() {
    const step = steps[idx];
    if (!step) return stop();
    if (countIn > 0) {                       // "five, six, seven, eight" before the first move
      const k = 8 - countIn;
      paintBeats();
      click(k === 4);
      say(k);
      countIn--;
      return;
    }
    const n = step.it.move.counts;
    if (beat >= n) {
      const last = idx === steps.length - 1;
      if (last && !loops()) return stop();
      go(idx + 1);
    }
    const current = (steps[idx].it.countFrom + beat) % 8;
    click(current === 0 || current === 4);
    say(current);
    paintBeats();
    beat++;
  }

  function start() {
    const bpm = Number(q('.pr-bpm').value) || 124;
    if (audio && audio.state === 'suspended') audio.resume();
    countIn = beat === 0 && isOn('countin') ? 4 : 0;
    keepAwake(true);
    timer = setInterval(tick, 60000 / bpm);
    tick();
    q('.pr-play').textContent = 'Pause';
  }

  /** Keep the phone screen on while practice plays (where the browser allows it). */
  function keepAwake(on) {
    try {
      if (on && navigator.wakeLock && !wakeLock) navigator.wakeLock.request('screen').then((l) => { wakeLock = l; }, () => {});
      if (!on && wakeLock) { wakeLock.release(); wakeLock = null; }
    } catch { /* not supported */ }
  }

  function stop() {
    if (timer) clearInterval(timer);
    countIn = 0;
    keepAwake(false);
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch { /* ignore */ }
    timer = null;
    if (dlg) {
      q('.pr-play').textContent = 'Play';
      paintBeats();
    }
  }

  function toggle() {
    if (timer) stop();
    else {
      if (beat >= (steps[idx] ? steps[idx].it.move.counts : 0)) beat = 0;
      start();
    }
  }

  window.Practice = {
    open(items, pageView, startAt = 0) {
      view = pageView;
      ensureDialog();
      steps = buildSteps(items.filter((it) => !it.broken));
      // Start on the step that contains the selected domino, if any.
      const target = items[startAt];
      idx = Math.max(0, steps.findIndex((st) => st.it === target || (st.extras || []).includes(target) || (st.after || []).includes(target)));
      beat = 0;
      stop();
      render();
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
      q('.pr-play').focus();
    },
    _buildSteps: buildSteps,
  };
})();
