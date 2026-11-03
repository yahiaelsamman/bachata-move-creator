/* Map section: the position map and the info box for the position (or arrow) picked on it. */
(function (App) {
  'use strict';
  const MG = window.MoveGraph;
  const PM = window.PositionMap;
  const { $, h, button, optionList, levelDots, posName, shortName, state, edit } = App;

  App.renderMap = function (result) {
    const path = result.items.filter((it) => !it.broken && it.from).map((it) => ({ from: it.from, to: it.to }));
    if (!path.length) path.push({ from: state.startPos, to: state.startPos });
    $('map').innerHTML = PM.mapSVG(App.g, App.mapLayout, { selected: state.mapSelected, path });
    renderMapInfo(result);
  };

  /** Pick a position on the map (null = none). */
  App.showOnMap = function (id) {
    state.mapSelected = id;
    App.render();
  };

  function renderMapInfo(result) {
    const g = App.g;
    const box = $('map-info');
    const id = state.mapSelected;
    if (!id || !g.posById[id]) {
      box.replaceChildren(h('p', { class: 'muted' },
        `${g.positions.length} positions, ${g.edges.filter((e) => MG.isTransition(g, e)).length} position-changing connections. ` +
        'Pick a position on the map to see its ways in and out.'));
      return;
    }
    const group = (edges, key) => {
      const by = {};
      for (const e of edges) {
        if (!MG.isTransition(g, e)) continue;
        (by[e[key]] = by[e[key]] || new Set()).add(g.moveById[e.move].name);
      }
      return Object.entries(by).sort((a, b) => posName(a[0]).localeCompare(posName(b[0])));
    };
    const link = state.mapLink && state.mapLink.from === id ? state.mapLink : null;
    const linkMoves = link ? [...new Set(g.outgoing[id].filter((e) => e.to === link.to && MG.isTransition(g, e)).map((e) => e.move))] : [];
    const outs = group(g.outgoing[id], 'to');
    const ins = group(g.incoming[id], 'from');
    const loops = MG.loopMoves(g, id).map((m) => g.moveById[m].name).sort();
    const list = (rows, arrow) => rows.length
      ? h('ul', { class: 'map-list' }, rows.map(([pid, names]) => h('li', {},
        button(arrow + ' ' + shortName(pid), () => App.showOnMap(pid), { class: 'link' }),
        ': ', [...names].sort().join(', '))))
      : h('p', { class: 'muted' }, 'None yet.');
    const bridges = result.end !== id ? MG.findBridges(g, result.end, id, { limit: 3, maxLevel: state.maxLevel }) : [];
    box.replaceChildren(h('div', {},
      h('div', { class: 'panel-head' }, h('h3', {}, posName(id)), button('Close', () => App.showOnMap(null), { class: 'ghost' })),
      App.sketchFigure(id, 'Leader view'),
      h('div', { class: 'actions' },
        button('Start a new combo here', () => edit.startNewComboAt(id)),
        result.end === id ? h('span', { class: 'muted' }, 'Your combo ends here.') : null),
      link ? [h('h4', {}, `${shortName(link.from)} → ${shortName(link.to)} (${linkMoves.length})`),
        optionList(linkMoves.map((mid) => ({
          label: g.moveById[mid].name,
          sub: [`${g.moveById[mid].counts} ct `, levelDots(g.moveById[mid].level)],
          disabled: result.end !== id,
          title: result.end === id ? 'Add to the combo' : `Your combo ends in ${posName(result.end)}`,
          onclick: () => { state.mapSelected = link.to; state.mapLink = null; edit.add([mid]); },
        })))] : null,
      bridges.length ? [h('h4', {}, `Get here from the end of your combo (${shortName(result.end)})`),
        optionList(bridges.map((path) => ({
          label: path.map((m) => g.moveById[m].name).join(' › '),
          sub: `+${path.length}`,
          onclick: () => edit.add(path),
        })))] : null,
      h('h4', {}, `Ways out (${outs.reduce((n, [, s]) => n + s.size, 0)})`), list(outs, '→'),
      h('h4', {}, `Ways in (${ins.reduce((n, [, s]) => n + s.size, 0)})`), list(ins, '←'),
      loops.length ? [h('h4', {}, `In place (${loops.length})`), h('p', { class: 'small' }, loops.join(', '))] : null));
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
