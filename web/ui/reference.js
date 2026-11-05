/* Reference sections: the move library (search and filter all moves) and the positions table. */
(function (App) {
  'use strict';
  const MG = window.MoveGraph;
  const SK = window.LeaderSketch;
  const { $, h, button, badge, levelDots, posName, shortName, LEVEL_NAME, state, edit } = App;

  /** Where a move can start and end: froms, tos (null = in place), all = starts anywhere. */
  function endpoints(id) {
    const g = App.g;
    const edges = g.edgesByMove[id] || [];
    const froms = [...new Set(edges.map((e) => e.from))];
    const same = edges.length && edges.every((e) => e.from === e.to);
    const tos = same ? null : [...new Set(edges.map((e) => e.to))];
    return { froms, tos, all: froms.length === g.positions.length };
  }

  /** "Open L-R, Handshake, +2": the first few positions, then how many more. */
  function shortList(ids, max) {
    const names = ids.map(shortName);
    return names.length > max + 1 ? `${names.slice(0, max).join(', ')}, +${names.length - max}` : names.join(', ');
  }

  App.renderLibrary = function (result) {
    const g = App.g;
    const box = $('library');
    if (!App.isTab('library')) return;
    renderLibraryControls();
    const q = $('lib-search').value.trim().toLowerCase();
    const kind = state.libKind;
    const onlyCheck = $('lib-check').checked;
    const rows = g.moves
      .filter((m) => kind === 'all' || m.kind === kind)
      .filter((m) => !onlyCheck || m.check)
      .filter((m) => m.level <= state.maxLevel)
      .map((m) => ({ m, ep: endpoints(m.id) }))
      .filter(({ m, ep }) => {
        if (!q) return true;
        const where = ep.all ? [] : ep.froms.map(posName);
        const hay = [m.name, m.notes, m.id, ...where, ...(ep.tos || []).map(posName)].join(' ').toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => a.m.name.localeCompare(b.m.name));
    const fitsEnd = (id) => (g.edgesByMove[id] || []).some((e) => e.from === result.end);
    const rate = (m) => {
      const lvl = App.userLevel(m.id);
      return button(levelDots(lvl), () => App.rateMove(m.id), {
        class: 'rate' + (lvl ? '' : ' unrated'),
        'aria-label': `Level of ${m.name}: ${lvl ? LEVEL_NAME[lvl] : 'not rated'}. Tap to change.`,
        title: 'Tap to rate: beginner, intermediate, advanced, unrated',
      });
    };
    box.replaceChildren(
      h('p', { class: 'muted small lib-hint' }, `${rows.length} of ${g.moves.length} moves` +
        (state.maxLevel < 3 ? ` (showing moves you rated up to ${LEVEL_NAME[state.maxLevel]}, and unrated ones)` : '') +
        '. Levels are yours: tap ○○○ to rate a move. “Add” appears when a move can follow the end of your combo.'),
      h('div', { class: 'card lib-wrap table-wrap' }, h('table', { class: 'lib' },
        h('thead', {}, h('tr', {}, ['Move', 'Starts in', 'Ends in', 'Counts', 'Level'].map((t) => h('th', {}, t)), h('th', {}, h('span', { class: 'visually-hidden' }, 'Add')))),
        h('tbody', {}, rows.map(({ m, ep }) => h('tr', {},
          h('td', { class: 'mv' }, h('strong', {}, m.name), badge(m.kind),
            m.check ? h('span', { class: 'flag small', title: m.check }, ' · ⚑ to check') : null,
            m.notes ? h('span', { class: 'note', title: m.notes }, m.notes) : null),
          h('td', { class: 'where', title: ep.all ? '' : ep.froms.map(posName).join(', ') }, ep.all ? 'Any position' : shortList(ep.froms, q ? 99 : 2)),
          h('td', { class: 'where' }, ep.tos ? shortList(ep.tos, q ? 99 : 2) : '↺ same'),
          h('td', {}, m.counts ? String(m.counts) : 'on the fly', m.on ? ` · usually on ${m.on}` : null),
          h('td', {}, rate(m)),
          h('td', {}, fitsEnd(m.id) ? button('Add', () => edit.add([m.id]), { class: 'add' }) : null)))))));
  };

  function renderLibraryControls() {
    const label = (k) => (k === 'all' ? 'All' : (App.KIND_LABEL[k] || k).replace(/^./, (c) => c.toUpperCase()));
    $('lib-kinds').replaceChildren(...['all', 'move', 'styling', 'adjuster', 'compound'].map((k) =>
      button(label(k), () => { state.libKind = k; App.render(); }, { class: state.libKind === k ? 'on' : '', 'aria-pressed': String(state.libKind === k) })));
    const moves = state.libShow === 'moves';
    $('lib-show-moves').setAttribute('aria-pressed', String(moves));
    $('lib-show-positions').setAttribute('aria-pressed', String(!moves));
    $('library').hidden = !moves;
    $('positions').hidden = moves;
    for (const el of [$('lib-search'), $('lib-kinds'), document.querySelector('.check-only')]) el.hidden = !moves;
    $('lib-search').placeholder = `Search ${App.g.moves.length} moves, notes or positions…`;
  }

  App.initLibrary = function () {
    state.libKind = 'all';
    state.libShow = 'moves';
    $('lib-search').addEventListener('input', App.render);
    $('lib-check').addEventListener('change', App.render);
    $('lib-show-moves').addEventListener('click', () => { state.libShow = 'moves'; App.render(); });
    $('lib-show-positions').addEventListener('click', () => { state.libShow = 'positions'; App.render(); });
  };

  App.renderPositions = function () {
    const g = App.g;
    const healthById = Object.fromEntries(g.health.map((x) => [x.id, x]));
    const showPosition = (id) => {
      App.showOnMap(id);
      App.showTab('map');
    };
    $('positions').replaceChildren(h('div', { class: 'card lib-wrap table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Position'), h('th', {}, 'Notation'), h('th', {}, 'Ways in / out'))),
      h('tbody', {}, g.positions.map((p) => {
        const health = healthById[p.id];
        const thumb = h('div', { class: 'thumb' });
        thumb.innerHTML = SK.sketchSVG(p);
        return h('tr', {},
          h('td', {}, thumb),
          h('td', {}, button(p.name, () => showPosition(p.id), { class: 'link' }),
            h('br'), h('code', { class: 'muted' }, p.id), h('br'), h('span', { class: 'muted small' }, SK.describe(p))),
          h('td', {}, h('code', {}, MG.notation(p))),
          h('td', { class: health.thin ? 'flag' : '' }, `${health.in} / ${health.out}`));
      })))),
    h('p', { class: 'muted small' }, 'Notation: FEO facing each other · SHD shadow (leader behind) · SBS-R/L side by side, follower on the right/left · ' +
      'open / semi / closed / apart = distance · L>R leader\'s left holds follower\'s right · R>back leader\'s right hand on the follower\'s back · ' +
      'cross R/L = leader\'s right hand on top.'),
    h('p', { class: 'muted small' }, 'Ways in/out count distinct moves that change position. Aim for at least 3 each. Click a name to see it on the map.'));
  };
})(window.App);
