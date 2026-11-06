/* Map section: a hub around one position (its neighbours on the inner ring, everything else outside),
 * a small overview of all positions, and the info panel for the position in the middle. */
(function (App) {
  'use strict';
  const MG = window.MoveGraph;
  const PM = window.PositionMap;
  const SK = window.LeaderSketch;
  const { $, h, button, optionList, posName, shortName, state, edit } = App;
  const moveName = (id) => App.g.moveById[id].name;
  const WAYS_SHOWN = 7;
  const phone = window.matchMedia('(max-width: 640px)');     // phones get a tighter hub with bigger names

  /** The middle of the map: the position picked on it, else where the combo ends. */
  const centerOf = (result) => (state.mapSelected && App.g.posById[state.mapSelected] ? state.mapSelected : result.end);

  App.renderMap = function (result) {
    const g = App.g;
    const center = centerOf(result);
    const hub = PM.layoutHub(g, App.mapLayout, center, { compact: phone.matches });
    const link = state.mapLink && [state.mapLink.from, state.mapLink.to].includes(center)
      ? (state.mapLink.from === center ? state.mapLink.to : state.mapLink.from) : null;
    $('map-title').replaceChildren('Around ', h('b', {}, posName(center)),
      result.end !== center ? h('span', {}, ' · your combo ends in ', h('b', {}, shortName(result.end))) : ' · where your combo ends');
    $('map').innerHTML = PM.hubSVG(g, hub, { end: result.end, link });
    const art = h('div', { class: 'ov-art' });
    art.innerHTML = PM.overviewSVG(g, App.mapLayout, center);
    $('map-overview').replaceChildren(
      h('div', { class: 'ov-text' }, h('p', { class: 'eyebrow' }, 'All positions'),
        h('p', { class: 'small muted' }, `All ${g.positions.length} positions, laid out so that positions linked by moves sit close together. ` +
          `Filled: ${shortName(center)}. Ringed: one move away. Tap a dot to put it in the middle.`)),
      art);
    renderMapInfo(result, center, link);
  };

  /** Put a position in the middle of the map (null = back to where the combo ends). */
  App.showOnMap = function (id) {
    state.mapSelected = id;
    state.mapAllOut = false;
    App.render();
  };

  /** Moves out of `id` that change position, as [moveId, to], sorted by kind then name. */
  function waysOut(id) {
    const g = App.g;
    const seen = new Set();
    const order = { move: 0, adjuster: 1, compound: 2, styling: 3 };
    return g.outgoing[id].filter((e) => MG.isTransition(g, e) && !seen.has(e.move) && seen.add(e.move))
      .map((e) => [e.move, e.to])
      .sort((a, b) => (order[g.moveById[a[0]].kind] - order[g.moveById[b[0]].kind]) || moveName(a[0]).localeCompare(moveName(b[0])));
  }

  const countMoves = (edges) => new Set(edges.filter((e) => MG.isTransition(App.g, e)).map((e) => e.move)).size;

  function renderMapInfo(result, id, link) {
    const g = App.g;
    const p = g.posById[id];
    const atEnd = result.end === id;
    const outs = waysOut(id);
    const loops = MG.loopMoves(g, id).map(moveName).sort();
    const shown = state.mapAllOut ? outs : outs.slice(0, WAYS_SHOWN);

    const info = h('div', { class: 'card' },
      h('p', { class: 'eyebrow' }, 'Position'),
      h('h3', {}, p.name),
      h('p', { class: 'desc' }, SK.describe(p)),
      h('p', { class: 'counts' }, h('span', {}, `${countMoves(g.incoming[id])} ways in`), h('span', {}, `${countMoves(g.outgoing[id])} ways out`),
        loops.length ? h('span', {}, `${loops.length} in place`) : null),
      atEnd ? h('p', { class: 'tag-end' }, 'Your combo ends here.') : null);

    const ways = h('div', { class: 'card' },
      h('h4', { class: 'eyebrow' }, 'Ways out'),
      outs.length
        ? optionList(shown.map(([mid, to]) => ({
          label: moveName(mid),
          sub: [App.badge(g.moveById[mid].kind), ' → ' + shortName(to)],
          title: atEnd ? 'Add to your combo' : `Go to ${posName(to)} on the map`,
          onclick: () => {
            if (atEnd) { state.mapSelected = to; state.mapLink = null; edit.add([mid]); } else App.showOnMap(to);
          },
        })))
        : h('p', { class: 'muted' }, 'None yet.'),
      outs.length > WAYS_SHOWN
        ? button(state.mapAllOut ? 'Show fewer' : `+ ${outs.length - WAYS_SHOWN} more`, () => { state.mapAllOut = !state.mapAllOut; App.render(); }, { class: 'link more' })
        : null,
      loops.length ? h('details', { class: 'small muted in-place' }, h('summary', {}, `In place (${loops.length})`), loops.join(', ')) : null,
      h('p', { class: 'small muted', style: 'margin-top:8px' }, atEnd ? 'Tap a move to add it to your combo.' : 'Tap a move to follow it on the map.'));

    const buttons = h('div', { class: 'map-buttons' },
      button('Start a combo here', () => edit.startNewComboAt(id), { class: 'primary' }),
      !atEnd ? button(state.mapRoutes ? 'Hide routes from my combo' : 'Routes from my combo', () => { state.mapRoutes = !state.mapRoutes; App.render(); }) : null);

    $('map-info').replaceChildren(...[info,
      link ? linkSection(id, link, result) : null,
      state.mapRoutes && !atEnd ? routesHere(id, result) : null,
      ways, buttons].filter(Boolean));
  }

  /** The moves along a tapped spoke, both ways. They can be added when the combo ends where they start. */
  function linkSection(center, other, result) {
    const g = App.g;
    const between = (a, b) => [...new Set(g.outgoing[a].filter((e) => e.to === b && MG.isTransition(g, e)).map((e) => e.move))];
    const part = (a, b) => {
      const ids = between(a, b);
      if (!ids.length) return null;
      const atEnd = result.end === a;
      return [
        h('h4', {}, `${shortName(a)} → ${shortName(b)} (${ids.length})`),
        optionList(ids.map((mid) => ({
          label: moveName(mid),
          sub: [App.badge(g.moveById[mid].kind), g.moveById[mid].counts ? ` · ${g.moveById[mid].counts} ct` : ' · on the fly'],
          disabled: !atEnd,
          title: atEnd ? 'Add to the combo' : `Your combo ends in ${posName(result.end)}`,
          onclick: () => { state.mapSelected = b; state.mapLink = null; edit.add([mid]); },
        }))),
      ];
    };
    return h('div', { class: 'card link-card' }, ...[part(center, other), part(other, center)].filter(Boolean),
      button('Close', () => { state.mapLink = null; App.render(); }, { class: 'link more' }));
  }

  /** Short ways from the end of the combo to this position. */
  function routesHere(id, result) {
    const bridges = MG.findBridges(App.g, result.end, id, { limit: 3, maxLevel: state.maxLevel });
    return h('div', { class: 'card' },
      h('h4', {}, `From ${shortName(result.end)} (end of your combo)`),
      bridges.length
        ? optionList(bridges.map((path) => ({
          label: path.map(moveName).join(' › '),
          sub: `+${path.length}`,
          onclick: () => { state.mapRoutes = false; edit.add(path); },
        })))
        : h('p', { class: 'muted' }, 'No route within 3 moves.'));
  }

  /** Clicks (and Enter/Space) on the map: a spoke shows its moves, a station moves to the middle. */
  App.initMap = function () {
    const onMapActivate = (ev) => {
      const t = ev.target.closest ? ev.target : ev.target.parentElement;
      const spoke = t.closest('[data-link]');
      if (spoke) {
        const [from, to] = spoke.getAttribute('data-link').split('>');
        state.mapLink = { from, to };
        App.render();
        return;
      }
      const node = t.closest('[data-pos]') || t.closest('[data-center]');
      if (!node) return;
      state.mapLink = null;
      const id = node.getAttribute('data-pos') || node.getAttribute('data-center');
      const center = state.mapSelected || App.evaluate().end;
      App.showOnMap(id === center && state.mapSelected ? null : id);
    };
    $('map').addEventListener('click', onMapActivate);
    phone.addEventListener('change', () => { if (App.isTab('map')) App.render(); });
    $('map-overview').addEventListener('click', onMapActivate);
    $('map').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onMapActivate(ev); } });
  };
})(window.App);
