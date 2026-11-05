/* Strip: the row of dominoes, the joints between them, the empty state and the summary line. */
(function (App) {
  'use strict';
  const { $, h, button, posName, shortName, state, edit, select } = App;

  App.renderStrip = function (result) {
    const strip = $('strip');
    strip.replaceChildren(h('span', { class: 'start-pill', title: posName(state.startPos) }, 'Start: ' + shortName(state.startPos)));
    result.items.forEach((it, i) => {
      strip.append(it.broken
        ? h('span', { class: 'joint broken' }, button('✕ bridge', () => select(i), { title: 'These dominoes do not connect' }))
        : h('span', { class: 'joint', 'aria-hidden': 'true' }, '›'));
      strip.append(domino(it, i));
    });
    if (!state.strip.length) {
      strip.append(emptyState());
      return;
    }
    strip.append(h('span', { class: 'joint', 'aria-hidden': 'true' }, '›'),
      button('+ next move', () => select(null), { class: 'domino add' + (state.selected === null ? ' selected' : '') }));
    keepSelectedInView(strip);
  };

  /** The strip scrolls sideways; keep the selected domino (or "+ next move") visible. */
  function keepSelectedInView(strip) {
    const el = strip.querySelector('.domino.selected');
    if (!el || strip.scrollWidth <= strip.clientWidth) return;
    const left = el.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft || left + el.offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollLeft = Math.max(0, left - (strip.clientWidth - el.offsetWidth) / 2);
    }
  }

  App.renderSummary = function (result) {
    const warnings = result.items.filter((it) => it.timingWarn || it.weightWarn || it.phraseWarn).length;
    const breaks = result.items.filter((it) => it.broken).length;
    $('summary').textContent = state.strip.length
      ? `${state.strip.length} dominoes · ${result.totalCounts} counts (${(result.totalCounts / 8).toFixed(1)} × 8) · ` +
        `ends in ${posName(result.end)}, ${result.weight} weight` +
        (breaks ? ` · ${breaks} break${breaks > 1 ? 's' : ''}` : '') +
        (warnings ? ` · ${warnings} soft warning${warnings > 1 ? 's' : ''}` : '')
      : '';
  };

  /** Shown instead of dominoes when the combo is empty: random combo and the built-in examples. */
  function emptyState() {
    const g = App.g;
    const examples = g.moves.filter((m) => m.kind === 'compound' && !m.id.startsWith('my-'))
      .filter((m) => (g.edgesByMove[m.id] || []).some((e) => e.from === state.startPos));
    return h('div', { class: 'empty' },
      h('p', {}, 'Start a combo: pick moves below, roll a random one, or load an example.'),
      h('div', { class: 'actions' },
        button('Random combo', edit.random, { class: 'primary' }),
        examples.map((m) => button('Example: ' + m.name, () => edit.setStrip(m.sequence)))));
  }

  function domino(it, i) {
    const m = it.move;
    if (it.missing) {
      return button(h('div', { class: 'name' }, `Unknown move "${it.id}"`), () => select(i), { class: 'domino broken' });
    }
    const flags = [];
    if (it.timingWarn) flags.push(h('span', { class: 'flag', title: 'Starts mid-phrase' }, ` · starts on ${it.beat}`));
    if (it.phraseWarn) flags.push(h('span', { class: 'flag', title: 'An 8-count move that starts on 5 runs across two phrases. Add a 4-count move before it.' }, ' · starts on 5'));
    if (it.onWarn) flags.push(h('span', { class: 'muted', title: `This turn is usually led on ${m.on} (the dancer steps onto the foot of the turn then). Here it starts on ${it.beat}; dancers often break off the beat, so this is only a hint.` }, ` · usually on ${m.on}`));
    if (it.weightWarn) flags.push(h('span', { class: 'flag', title: 'Weight mismatch' }, ` · needs ${App.g.weightOf(m.id).from}`));
    if (m.check) flags.push(h('span', { class: 'flag', title: m.check }, ' · ⚑'));
    return button([
      h('div', { class: 'halves' }, h('span', {}, shortName(it.from)), h('span', {}, shortName(it.to))),
      h('div', { class: 'name' }, m.name),
      h('div', { class: 'meta' }, countLabel(it), flags),
    ], () => select(i), {
      class: `domino k-${m.kind}` + (it.broken ? ' broken' : '') + (state.selected === i ? ' selected' : ''),
      title: `${posName(it.from)} → ${posName(it.to)}`,
    });
  }

  /** Counts and the beats they cover, e.g. "8 ct · 5-8, 1-4"; 0-count connectors happen on the fly. */
  function countLabel(it) {
    const n = it.move.counts;
    return n ? `${n} ct · ${App.beatRange(it.beat, n)}` : 'on the fly';
  }
})(window.App);
