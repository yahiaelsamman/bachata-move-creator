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

  App.renderLibrary = function (result) {
    const g = App.g;
    const box = $('library');
    if (!App.isTab('library')) return;
    const q = $('lib-search').value.trim().toLowerCase();
    const kind = $('lib-kind').value;
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
    const list = (ids) => ids.map(shortName).join(', ');
    box.replaceChildren(
      h('p', { class: 'muted small' }, `${rows.length} of ${g.moves.length} moves` +
        (state.maxLevel < 3 ? ` (level filter: up to ${LEVEL_NAME[state.maxLevel]})` : '') + '. “Add” appears when a move can follow the end of your combo.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'lib' },
        h('thead', {}, h('tr', {}, ['Move', 'Starts in', 'Ends in', 'Counts', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, rows.map(({ m, ep }) => h('tr', {},
          h('td', {}, h('strong', {}, m.name), ' ', badge(m.kind), ' ', levelDots(m.level),
            m.check ? h('span', { class: 'flag', title: m.check }, ' ⚑') : null,
            m.notes ? [h('br'), h('span', { class: 'muted small' }, m.notes)] : null),
          h('td', { class: 'small' }, ep.all ? 'any position' : list(ep.froms)),
          h('td', { class: 'small' }, ep.tos ? list(ep.tos) : '↺ same'),
          h('td', {}, String(m.counts)),
          h('td', {}, fitsEnd(m.id) ? button('Add', () => edit.add([m.id])) : null)))))));
  };

  App.initLibrary = function () {
    $('lib-search').addEventListener('input', App.render);
    $('lib-kind').addEventListener('change', App.render);
    $('lib-check').addEventListener('change', App.render);
  };

  App.renderPositions = function () {
    const g = App.g;
    const healthById = Object.fromEntries(g.health.map((x) => [x.id, x]));
    const showPosition = (id) => {
      App.showOnMap(id);
      App.showTab('map');
    };
    $('positions').replaceChildren(h('div', { class: 'table-wrap' }, h('table', {},
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
      'open / semi / closed / apart = distance · L>R leader\'s left holds follower\'s right · R>back leader\'s right hand on her back · ' +
      'cross R/L = leader\'s right hand on top.'),
    h('p', { class: 'muted small' }, 'Ways in/out count distinct moves that change position. Aim for at least 3 each. Click a name to see it on the map.'));
  };
})(window.App);
