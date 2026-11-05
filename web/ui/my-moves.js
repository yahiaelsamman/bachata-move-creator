/* My moves: the new-move form, the user's own moves as cards, and their combos (saved compound moves).
 * Moves stay short (4 or 8 counts, or on the fly); anything longer is a combo. */
(function (App) {
  'use strict';
  const MG = window.MoveGraph;
  const Share = window.ComboShare;
  const BASE = window.BACHATA_DATA;
  const { $, h, button, shortName, own, state, edit } = App;

  const copyButton = (label, text) => button(label, (ev) => App.copyText(text, ev.currentTarget));

  App.initMoveForm = function () {
    const g = App.g;
    state.mineShow = 'moves';
    const form = $('move-form');
    const to = form.elements.to;
    to.append(h('option', { value: 'same' }, 'the position it started in'));
    for (const p of g.positions) to.append(h('option', { value: p.id }, p.name));
    const fromBox = $('mf-from');
    for (const p of g.positions) {
      fromBox.append(h('label', { class: 'mf-chip' }, h('input', { type: 'checkbox', value: p.id }), ' ', p.short || p.name));
    }
    const status = $('mf-status');
    const syncKind = () => {
      const styling = form.elements.kind.value === 'styling';
      if (styling) to.value = 'same';
      to.disabled = styling;
    };
    form.elements.kind.addEventListener('change', syncKind);
    syncKind();
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const name = form.elements.name.value.trim();
      const from = [...fromBox.querySelectorAll('input:checked')].map((i) => i.value);
      const counts = Number(form.elements.counts.value);
      const fail = (msg) => { status.textContent = msg; status.className = 'small flag bad'; };
      if (!name) return fail('Give the move a name.');
      if (!from.length) return fail('Tick at least one position it starts in.');
      const id = Share.uniqueId(name, (taken) => Boolean(App.g.moveById[taken]), 'move');
      const move = {
        id, name, kind: form.elements.kind.value,
        from, to: form.elements.kind.value === 'styling' ? 'same' : to.value, counts,
      };
      const notes = form.elements.notes.value.trim();
      if (notes) move.notes = notes;
      const test = MG.compile({ positions: BASE.positions, moves: [...BASE.moves, ...own.moves, move] });
      const problems = test.errors.filter((e) => e.includes(`"${id}"`));
      if (problems.length) return fail(problems.join(' '));
      state.mineShow = 'moves';
      own.addMove(move);
      form.reset();
      fromBox.querySelectorAll('input').forEach((i) => { i.checked = false; });
      syncKind();
      status.className = 'small';
      status.textContent = `Saved "${name}". It now appears under What can follow for ${from.map(shortName).join(', ')}.`;
    });
  };

  /** The switch between the user's moves and combos. */
  function renderSwitch() {
    const chip = (key, label, n) => button(`${label} · ${n}`, () => { state.mineShow = key; App.renderData(); },
      { class: state.mineShow === key ? 'on' : '', 'aria-pressed': String(state.mineShow === key) });
    $('mine-switch').replaceChildren(chip('moves', 'Moves', own.moves.length), chip('combos', 'Combos', own.compounds.length));
    $('my-moves').hidden = state.mineShow !== 'moves';
    $('compounds').hidden = state.mineShow !== 'combos';
  }

  /** Where a move goes, e.g. "Open L-R, Closed → Handshake · 4 counts". */
  function route(m) {
    const from = m.from.map(shortName).join(', ');
    const to = m.to === 'same' ? 'same position' : shortName(m.to);
    return `${from} → ${to} · ${m.counts ? `${m.counts} counts` : 'on the fly'}`;
  }

  const focusForm = () => { const f = $('move-form'); f.scrollIntoView({ behavior: 'smooth', block: 'start' }); f.elements.name.focus({ preventScroll: true }); };

  App.renderMyMoves = function () {
    renderSwitch();
    const box = $('my-moves');
    const broken = own.moves.filter((m) => own.errors[m.id]);
    const yaml = own.moves.map(Share.moveYaml).join('\n');
    box.replaceChildren(...[
      broken.length ? h('div', { class: 'errors' }, broken.map((m) => own.errors[m.id].join('\n')).join('\n')) : null,
      h('div', { class: 'cards' },
        own.moves.map((m) => h('div', { class: 'card move-card' },
          h('div', { class: 'head' }, h('h4', {}, m.name), App.badge(m.kind)),
          h('div', { class: 'route' }, route(m)),
          m.notes ? h('div', { class: 'note' }, m.notes) : null,
          h('div', { class: 'actions' }, button('Delete', () => {
            if (own.compounds.some((c) => c.sequence.includes(m.id)) && !confirm(`"${m.name}" is used in a combo, which will break. Delete anyway?`)) return;
            own.deleteMove(m.id);
          }, { class: 'ghost', 'aria-label': `Delete ${m.name}` })))),
        button('+ Describe a new move', focusForm, { class: 'new-card' })),
      own.moves.length ? h('details', { class: 'yaml' },
        h('summary', {}, 'For the data file (YAML)'),
        h('p', { class: 'small muted' }, 'Moves you add live in this browser. To keep them for good (and for everyone), copy this into data/moves.yaml.'),
        h('pre', {}, yaml), copyButton('Copy YAML', yaml)) : null].filter(Boolean));
  };

  App.renderCompounds = function () {
    renderSwitch();
    const box = $('compounds');
    const broken = own.compounds.filter((c) => own.errors[c.id]);
    const yaml = own.compounds.map(Share.compoundYaml).join('\n');
    const nameOf = (id) => (App.g.moveById[id] ? App.g.moveById[id].name : id);
    const startOf = (c) => {
      const edges = App.g.edgesByMove[c.id] || [];
      return edges.length ? `${shortName(edges[0].from)} → ${shortName(edges[0].to)} · ${App.g.moveById[c.id].counts} counts` : '';
    };
    box.replaceChildren(...[
      broken.length ? h('div', { class: 'errors' },
        'Broken combos (a part changed or was removed):\n' + broken.map((c) => own.errors[c.id].join('\n')).join('\n')) : '',
      own.compounds.length ? null : h('p', { class: 'muted' },
        'A combo is a sequence longer than one move. Build one without breaks on the Build tab, then use More › Save as combo.'),
      h('div', { class: 'cards' }, own.compounds.map((c) => h('div', { class: 'card move-card' },
        h('div', { class: 'head' }, h('h4', {}, c.name), App.badge('compound')),
        h('div', { class: 'route' }, startOf(c)),
        h('div', { class: 'note' }, c.sequence.map(nameOf).join(' › ')),
        h('div', { class: 'actions' },
          App.g.moveById[c.id] ? button('Open in Build', () => {
            const e = (App.g.edgesByMove[c.id] || [])[0];
            if (e) state.startPos = e.from;
            edit.setStrip([...c.sequence]);
            App.showTab('build');
          }) : null,
          button('Delete', () => own.deleteCompound(c.id), { class: 'ghost', 'aria-label': `Delete ${c.name}` }))))),
      own.compounds.length ? h('details', { class: 'yaml' },
        h('summary', {}, 'For the data file (YAML)'),
        h('pre', {}, yaml), copyButton('Copy YAML', yaml)) : null].filter(Boolean));
  };

})(window.App);
