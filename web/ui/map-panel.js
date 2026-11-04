/* Map section: the position map and the info box for the position (or arrow) picked on it. */
(function (App) {
  'use strict';
  const MG = window.MoveGraph;
  const PM = window.PositionMap;
  const { $, h, button, optionList, levelDots, posName, shortName, state, edit } = App;
  const moveName = (id) => App.g.moveById[id].name;

  // Phones start with the focused view; the whole map is one tap away.
  state.mapView = window.matchMedia('(max-width: 720px)').matches ? 'focus' : 'all';

  App.renderMap = function (result) {
    const path = result.items.filter((it) => !it.broken && it.from).map((it) => ({ from: it.from, to: it.to }));
    if (!path.length) path.push({ from: state.startPos, to: state.startPos });
    const center = state.mapSelected || result.end;
    const layout = state.mapView === 'focus' ? PM.layoutFocus(App.g, App.mapLayout, center) : App.mapLayout;
    $('map-view').replaceChildren(
      button(`Around ${shortName(center)}`, () => { state.mapView = 'focus'; App.render(); },
        { class: state.mapView === 'focus' ? 'on' : '', 'aria-pressed': String(state.mapView === 'focus') }),
      button('Whole map', () => { state.mapView = 'all'; App.render(); },
        { class: state.mapView === 'all' ? 'on' : '', 'aria-pressed': String(state.mapView === 'all') }));
    $('map').innerHTML = PM.mapSVG(App.g, layout, { selected: state.mapView === 'focus' ? center : state.mapSelected, path });
    renderMapInfo(result);
  };

  /** Pick a position on the map (null = none). */
  App.showOnMap = function (id) {
    state.mapSelected = id;
    App.render();
  };

  /** Info for the picked position: ways in and out, bridges from the combo's end, or the moves of a tapped arrow. */
  function renderMapInfo(result) {
    const g = App.g;
    const id = state.mapSelected;
    if (!id || !g.posById[id]) {
      $('map-info').replaceChildren(h('p', { class: 'muted' },
        `${g.positions.length} positions, ${g.edges.filter((e) => MG.isTransition(g, e)).length} position-changing connections. ` +
        'Pick a position on the map to see its ways in and out.'));
      return;
    }
    const link = state.mapLink && state.mapLink.from === id ? state.mapLink : null;
    const outs = neighbours(g.outgoing[id], 'to');
    const ins = neighbours(g.incoming[id], 'from');
    const loops = MG.loopMoves(g, id).map(moveName).sort();
    $('map-info').replaceChildren(h('div', {},
      h('div', { class: 'panel-head' }, h('h3', {}, posName(id)), button('Close', () => App.showOnMap(null), { class: 'ghost' })),
      App.sketchFigure(id, 'Leader view'),
      h('div', { class: 'actions' },
        button('Start a new combo here', () => edit.startNewComboAt(id)),
        result.end === id ? h('span', { class: 'muted' }, 'Your combo ends here.') : null),
      link ? linkSection(link, result) : null,
      bridgeToHere(id, result),
      h('h4', {}, `Ways out (${countMoves(outs)})`), waysList(outs, '→'),
      h('h4', {}, `Ways in (${countMoves(ins)})`), waysList(ins, '←'),
      loops.length ? [h('h4', {}, `In place (${loops.length})`), h('p', { class: 'small' }, loops.join(', '))] : null));
  }

  /** Position-changing edges grouped by the position at their other `end`: [[posId, Set of move names]], by name. */
  function neighbours(edges, end) {
    const byPos = {};
    for (const e of edges) {
      if (!MG.isTransition(App.g, e)) continue;
      (byPos[e[end]] = byPos[e[end]] || new Set()).add(moveName(e.move));
    }
    return Object.entries(byPos).sort((a, b) => posName(a[0]).localeCompare(posName(b[0])));
  }

  const countMoves = (rows) => rows.reduce((n, [, names]) => n + names.size, 0);

  function waysList(rows, arrow) {
    if (!rows.length) return h('p', { class: 'muted' }, 'None yet.');
    return h('ul', { class: 'map-list' }, rows.map(([posId, names]) => h('li', {},
      button(arrow + ' ' + shortName(posId), () => App.showOnMap(posId), { class: 'link' }),
      ': ', [...names].sort().join(', '))));
  }

  /** The moves of a tapped arrow. They can be added when the combo ends where the arrow starts. */
  function linkSection(link, result) {
    const g = App.g;
    const ids = [...new Set(g.outgoing[link.from].filter((e) => e.to === link.to && MG.isTransition(g, e)).map((e) => e.move))];
    const atEnd = result.end === link.from;
    return [
      h('h4', {}, `${shortName(link.from)} → ${shortName(link.to)} (${ids.length})`),
      optionList(ids.map((id) => ({
        label: moveName(id),
        sub: [`${g.moveById[id].counts} ct `, levelDots(g.moveById[id].level)],
        disabled: !atEnd,
        title: atEnd ? 'Add to the combo' : `Your combo ends in ${posName(result.end)}`,
        onclick: () => { state.mapSelected = link.to; state.mapLink = null; edit.add([id]); },
      }))),
    ];
  }

  /** Short ways from the end of the combo to this position. */
  function bridgeToHere(id, result) {
    const bridges = result.end !== id ? MG.findBridges(App.g, result.end, id, { limit: 3, maxLevel: state.maxLevel }) : [];
    if (!bridges.length) return null;
    return [
      h('h4', {}, `Get here from the end of your combo (${shortName(result.end)})`),
      optionList(bridges.map((path) => ({
        label: path.map(moveName).join(' › '),
        sub: `+${path.length}`,
        onclick: () => edit.add(path),
      }))),
    ];
  }

  /** Clicks (and Enter/Space) on the map: an arrow shows its moves, a position toggles its info. */
  App.initMap = function () {
    const onMapActivate = (ev) => {
      const link = ev.target.closest && ev.target.closest('[data-link]');
      if (link) {
        const [from, to] = link.getAttribute('data-link').split('>');
        state.mapLink = { from, to };
        App.showOnMap(from);
        return;
      }
      const node = ev.target.closest && ev.target.closest('[data-pos]');
      if (!node) return;
      state.mapLink = null;
      const id = node.getAttribute('data-pos');
      App.showOnMap(state.mapSelected === id ? null : id);
      if (window.matchMedia('(max-width: 720px)').matches) $('map-info').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    $('map').addEventListener('click', onMapActivate);
    $('map').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onMapActivate(ev); } });
  };
})(window.App);
