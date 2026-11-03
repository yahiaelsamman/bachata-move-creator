/* My moves: the add-a-move form, and the lists of own moves and own compounds with their YAML. */
(function (App) {
  'use strict';
  const MG = window.MoveGraph;
  const Share = window.ComboShare;
  const BASE = window.BACHATA_DATA;
  const { $, h, button, shortName, own } = App;

  const copyButton = (label, text) => button(label, (ev) => App.copyText(text, ev.currentTarget));

  App.initMoveForm = function () {
    const g = App.g;
    const form = $('move-form');
    const to = form.elements.to;
    to.append(h('option', { value: 'same' }, 'same position it started in'));
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
      if (!from.length) return fail('Tick at least one position it can start from.');
      if (!Number.isInteger(counts) || counts < 0) return fail('Counts must be a whole number, 0 or more.');
      const id = Share.uniqueId(name, (taken) => Boolean(App.g.moveById[taken]), 'move');
      const move = {
        id, name, kind: form.elements.kind.value, level: Number(form.elements.level.value),
        from, to: form.elements.kind.value === 'styling' ? 'same' : to.value, counts,
      };
      const notes = form.elements.notes.value.trim();
      if (notes) move.notes = notes;
      const test = MG.compile({ positions: BASE.positions, moves: [...BASE.moves, ...own.moves, move] });
      const problems = test.errors.filter((e) => e.includes(`"${id}"`));
      if (problems.length) return fail(problems.join(' '));
      own.addMove(move);
      form.reset();
      fromBox.querySelectorAll('input').forEach((i) => { i.checked = false; });
      syncKind();
      status.className = 'small';
      status.textContent = `Saved "${name}". It now appears under "what can follow" for ${from.map(shortName).join(', ')}.`;
    });
  };

  App.renderMyMoves = function () {
    const box = $('my-moves');
    if (!own.moves.length) { box.replaceChildren(); return; }
    const broken = own.moves.filter((m) => own.errors[m.id]);
    const yaml = own.moves.map(Share.moveYaml).join('\n');
    box.replaceChildren(h('div', {},
      h('h3', {}, `Your moves (${own.moves.length})`),
      broken.length ? h('div', { class: 'errors' }, broken.map((m) => own.errors[m.id].join('\n')).join('\n')) : null,
      h('pre', {}, yaml),
      h('div', { class: 'actions' },
        copyButton('Copy YAML', yaml),
        own.moves.map((m) => button(`Delete "${m.name}"`, () => {
          if (own.compounds.some((c) => c.sequence.includes(m.id)) && !confirm(`"${m.name}" is used in a compound move, which will break. Delete anyway?`)) return;
          own.deleteMove(m.id);
        }, { class: 'ghost' })))));
  };

  App.renderCompounds = function () {
    const box = $('compounds');
    if (!own.compounds.length) {
      box.replaceChildren(h('p', { class: 'muted' },
        'Build a combo without breaks, then use "Save as compound". Saved compounds live in this browser; ' +
        'copy their YAML into data/moves.yaml to keep them for good.'));
      return;
    }
    const broken = own.compounds.filter((c) => own.errors[c.id]);
    const yaml = own.compounds.map(Share.compoundYaml).join('\n');
    box.replaceChildren(
      broken.length ? h('div', { class: 'errors' },
        'Broken compound moves (a part changed or was removed):\n' + broken.map((c) => own.errors[c.id].join('\n')).join('\n')) : '',
      h('pre', {}, yaml),
      h('div', { class: 'actions' },
        copyButton('Copy YAML', yaml),
        own.compounds.map((c) => button(`Delete "${c.name}"`, () => own.deleteCompound(c.id), { class: 'ghost' }))));
  };
})(window.App);
