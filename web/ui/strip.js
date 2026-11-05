/* Strip: the combo as a metro line. Each move is a station; the line leaving it has the colour of its kind.
 * Also the joints (a red "break" where two moves don't connect), the empty state and the summary. */
(function (App) {
  'use strict';
  const { $, h, button, posName, state, edit, select } = App;

  const kindColour = (kind) => `var(--k-line-${kind})`;

  App.renderStrip = function (result) {
    const strip = $('strip');
    strip.replaceChildren();
    let prevKind = null;
    result.items.forEach((it, i) => {
      if (it.broken) {
        strip.append(h('span', { class: 'joint broken' }, button('✕ break', () => select(i), { title: 'These two moves do not connect. Tap for ways to reconnect.' })));
        prevKind = null;
      }
      strip.append(station(it, i, prevKind));
      prevKind = it.missing ? null : it.move.kind;
    });
    if (!state.strip.length) {
      strip.append(emptyState());
      return;
    }
    strip.append(button([h('span', { class: 'stop', 'aria-hidden': 'true' }, '+'), h('span', { class: 'name' }, 'next')], () => select(null), {
      class: 'domino add' + (state.selected === null ? ' selected' : ''),
      style: prevKind ? `--in: ${kindColour(prevKind)}` : null,
      'aria-label': 'Add the next move',
    }));
    keepSelectedInView(strip);
  };

  /** The strip scrolls sideways; keep the selected station (or "+ next") visible. */
  function keepSelectedInView(strip) {
    const el = strip.querySelector('.domino.selected');
    if (!el || strip.scrollWidth <= strip.clientWidth) return;
    const left = el.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + el.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = Math.max(0, left - (strip.clientWidth - el.offsetWidth) / 2);
    }
  }

  /** "16 counts / ends in Handshake" on the right of the line; the full sentence is read out and shown as a tooltip. */
  App.renderSummary = function (result) {
    const warnings = result.items.filter((it) => it.timingWarn || it.weightWarn || it.phraseWarn).length;
    const breaks = result.items.filter((it) => it.broken).length;
    const box = $('summary');
    if (!state.strip.length) { box.replaceChildren(); box.title = ''; return; }
    const n = state.strip.length;
    const extra = (breaks ? ` · ${breaks} break${breaks > 1 ? 's' : ''}` : '') +
      (warnings ? ` · ${warnings} soft warning${warnings > 1 ? 's' : ''}` : '');
    box.replaceChildren(...[
      h('b', {}, `${n} move${n > 1 ? 's' : ''} · ${result.totalCounts} counts`), ' ',
      h('span', { class: 'sum-ends' }, `ends in ${posName(result.end)}`),
      extra ? h('span', { class: 'flag' }, extra) : null].filter(Boolean));
    box.title = `${(result.totalCounts / 8).toFixed(1)} × 8 counts, ends on ${result.weight} weight`;
  };

  /** The sentence the screen reader hears after a change. */
  App.summaryText = function (result) {
    if (!state.strip.length) return 'Combo is empty.';
    const breaks = result.items.filter((it) => it.broken).length;
    return `${state.strip.length} moves · ${result.totalCounts} counts · ends in ${posName(result.end)}` + (breaks ? ` · ${breaks} break${breaks > 1 ? 's' : ''}` : '');
  };

  /** Shown on the line when the combo is empty: random combo and the built-in examples. */
  function emptyState() {
    const g = App.g;
    const examples = g.moves.filter((m) => m.kind === 'compound' && !m.id.startsWith('my-'))
      .filter((m) => (g.edgesByMove[m.id] || []).some((e) => e.from === state.startPos));
    return h('div', { class: 'empty' },
      h('p', {}, 'Pick a first move from What can follow, or:'),
      h('div', { class: 'actions' },
        button('Random combo', edit.random, { class: 'primary' }),
        examples.map((m) => button('Example: ' + m.name, () => edit.setStrip(m.sequence)))));
  }

  function station(it, i, prevKind) {
    const m = it.move;
    if (it.missing) {
      return button([h('span', { class: 'stop' }), h('span', { class: 'name' }, `Unknown move "${it.id}"`)], () => select(i), { class: 'domino broken' });
    }
    const flags = [];
    if (it.timingWarn) flags.push(h('span', { class: 'flag', title: 'Starts mid-phrase' }, `starts on ${it.beat}`));
    if (it.phraseWarn) flags.push(h('span', { class: 'flag', title: 'An 8-count move that starts on 5 runs across two phrases. Add a 4-count move before it.' }, 'starts on 5'));
    if (it.onWarn) flags.push(h('span', { title: `This turn is usually led on ${m.on} (the dancer steps onto the foot of the turn then). Here it starts on ${it.beat}; dancers often break off the beat, so this is only a hint.` }, `usually on ${m.on}`));
    if (it.weightWarn) flags.push(h('span', { class: 'flag', title: 'Weight mismatch' }, `needs ${App.g.weightOf(m.id).from}`));
    if (m.check) flags.push(h('span', { class: 'flag', title: m.check }, '⚑'));
    const meta = [];
    flags.forEach((f, n) => { if (n) meta.push(' · '); meta.push(f); });
    return button([
      h('span', { class: 'stop', 'aria-hidden': 'true' }),
      h('span', { class: 'name' }, m.name),
      h('span', { class: 'meta' }, meta),
    ], () => select(i), {
      class: `domino k-${m.kind}` + (it.broken ? ' broken' : '') + (state.selected === i ? ' selected' : ''),
      style: `--k: ${kindColour(m.kind)}` + (prevKind ? `; --in: ${kindColour(prevKind)}` : ''),
      title: `${posName(it.from)} → ${posName(it.to)} · ${countLabel(it)}`,
    });
  }

  /** Counts and the beats they cover, e.g. "8 counts, 5-8, 1-4"; 0-count adjusters happen on the fly. */
  function countLabel(it) {
    const n = it.move.counts;
    return n ? `${n} counts, ${App.beatRange(it.beat, n)}` : 'on the fly';
  }
})(window.App);
