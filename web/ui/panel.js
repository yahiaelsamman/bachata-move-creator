/* Panel under the strip: "what can follow", or the details of the selected domino, with the leader view. */
(function (App) {
  'use strict';
  const MG = window.MoveGraph;
  const SK = window.LeaderSketch;
  const { $, h, button, optionList, levelDots, moveLabel, posName, shortName, LEVEL_NAME, state, edit, select } = App;

  const moveName = (id) => (App.g.moveById[id] ? App.g.moveById[id].name : id);
  const destination = (e) => (e.to === e.from ? '↺ same' : '→ ' + shortName(e.to));

  App.renderPanel = function (result) {
    const it = state.selected === null ? null : result.items[state.selected];
    const main = it ? detailPanel(it, state.selected) : nextPanel(result.end);
    let side;
    if (!it) side = [App.sketchFigure(result.end, 'Where you are now')];
    else if (it.missing || !it.from) side = [];
    else if (it.from === it.to) side = [App.sketchFigure(it.from, 'Start and end (same position)')];
    else side = [App.sketchFigure(it.from, 'Start'), App.sketchFigure(it.to, 'End')];
    $('panel').replaceChildren(h('div', { class: 'panel-grid' },
      h('div', { class: 'panel-main' }, main),
      side.length ? h('aside', { class: 'leader-view', 'aria-label': 'Leader view' }, h('h3', {}, 'Leader view'), side) : null));
  };

  /** Top-down sketch of a position as the leader sees it. */
  App.sketchFigure = function (posId, caption) {
    const p = App.g.posById[posId];
    if (!p) return null;
    const art = h('div', { class: 'sk-art' });
    art.innerHTML = SK.sketchSVG(p, { title: p.name });
    return h('figure', { class: 'sk-fig' }, art,
      h('figcaption', {}, h('strong', {}, caption + ': '), p.name, h('br'), h('span', { class: 'muted' }, SK.describe(p))));
  };

  function kindChips() {
    return h('div', { class: 'chips' }, ['all', 'move', 'styling', 'adjuster', 'compound'].map((k) =>
      button(k, () => { state.kindFilter = k; App.render(); }, { class: state.kindFilter === k ? 'on' : '' })));
  }

  function nextPanel(end) {
    const g = App.g;
    const options = MG.nextMoves(g, end).filter((e) => {
      const m = g.moveById[e.move];
      if (state.kindFilter !== 'all' && m.kind !== state.kindFilter) return false;
      if (m.level > state.maxLevel) return false;
      return !state.search || m.name.toLowerCase().includes(state.search.toLowerCase());
    });
    const search = h('input', {
      class: 'search', type: 'search', placeholder: 'Filter moves…', 'aria-label': 'Filter next moves', value: state.search,
      oninput: (ev) => { state.search = ev.target.value; App.keepFocus('.search', App.render); },
    });
    return h('div', {},
      h('div', { class: 'panel-head' }, h('h2', {}, `What can follow ${posName(end)}`), kindChips()),
      search,
      options.length
        ? optionList(options.map((e) => {
          const m = g.moveById[e.move];
          return {
            label: moveLabel(m),
            sub: [destination(e), ` · ${m.counts} ct `, levelDots(m.level)],
            onclick: () => { state.search = ''; edit.add([m.id]); },
          };
        }))
        : h('p', { class: 'muted' }, 'Nothing matches. This position needs more moves in data/moves.yaml.'));
  }

  /** The selected domino: facts and actions, then a bridge (if broken) or replacements, then insertions. */
  function detailPanel(it, i) {
    if (it.missing) {
      return h('div', { class: 'detail' }, h('p', {}, `Move "${it.id}" no longer exists.`), button('Remove', () => edit.remove(i)));
    }
    const m = it.move;
    return h('div', { class: 'detail' },
      h('div', { class: 'panel-head' }, h('h2', {}, moveLabel(m)), button('Close', () => select(null), { class: 'ghost' })),
      m.check ? h('div', { class: 'check' }, '⚑ Needs review: ' + m.check) : null,
      detailFacts(it),
      detailActions(m, i),
      it.broken ? bridgeSection(it, i) : replaceSection(it, i),
      it.to ? insertSection(it, i) : null);
  }

  function detailFacts(it) {
    const g = App.g;
    const m = it.move;
    const w = g.weightOf(m.id);
    const row = (term, ...value) => [h('dt', {}, term), h('dd', {}, ...value)];
    return h('dl', {},
      row('From', posName(it.from), h('br'), h('code', {}, MG.notation(g.posById[it.from]))),
      row('To', posName(it.to), h('br'), h('code', {}, MG.notation(g.posById[it.to]))),
      row('Counts', `${m.counts} (starts on beat ${it.beat})`),
      row('Level', levelDots(m.level), ' ', LEVEL_NAME[m.level] || ''),
      row('Weight', `${w.from || 'any'} → ${w.to || 'unchanged'}` + (it.weightWarn ? ` (you arrive ${it.weightIn})` : '')),
      m.opposite ? row('Opposite', moveName(m.opposite)) : null,
      m.sequence ? row('Made of', m.sequence.map(moveName).join(' › ')) : null,
      m.notes ? row('Notes', m.notes) : null);
  }

  function detailActions(m, i) {
    return h('div', { class: 'actions' },
      button('Remove', () => edit.remove(i)),
      i > 0 ? button('‹ Move left', () => edit.move(i, -1)) : null,
      i < state.strip.length - 1 ? button('Move right ›', () => edit.move(i, 1)) : null,
      m.sequence ? button('Expand into parts', () => edit.expand(i)) : null,
      button('Cut here', () => edit.cut(i)));
  }

  /** Ways to reconnect a broken domino to the one before it. */
  function bridgeSection(it, i) {
    const bridges = it.from ? MG.findBridges(App.g, it.expected, it.from, { maxLevel: state.maxLevel }) : [];
    return [
      h('h2', {}, `Bridge: ${posName(it.expected)} → ${posName(it.from)}`),
      bridges.length
        ? optionList(bridges.map((path) => ({
          label: path.map(moveName).join(' › '),
          sub: `${path.length} step${path.length > 1 ? 's' : ''}`,
          onclick: () => edit.insert(i, path),
        })))
        : h('p', { class: 'muted' }, 'No bridge within 3 moves. Remove this domino or add an adjuster to the data.'),
    ];
  }

  /** Other moves with the same start and end. */
  function replaceSection(it, i) {
    const g = App.g;
    const alts = MG.alternatives(g, it.from, it.to, it.move.id).filter(App.withinLevel);
    return [
      h('h2', {}, 'Replace with (same start and end)'),
      alts.length
        ? optionList(alts.map((id) => ({
          label: moveLabel(g.moveById[id]),
          sub: `${g.moveById[id].counts} ct`,
          onclick: () => edit.replace(i, id),
        })))
        : h('p', { class: 'muted' }, 'No alternatives yet.'),
    ];
  }

  /** Moves that can go after this domino; by default only those that keep the next domino connected. */
  function insertSection(it, i) {
    const g = App.g;
    const next = state.strip[i + 1];
    const nextEdges = next ? g.edgesByMove[next] || [] : null;
    const fits = (e) => !nextEdges || nextEdges.some((x) => x.from === e.to);
    const all = MG.nextMoves(g, it.to).filter((e) => g.moveById[e.move].kind !== 'compound' && App.withinLevel(e.move));
    const good = all.filter(fits);
    const toggleShowAll = () => { state.showAllInsert = !state.showAllInsert; App.render(); };
    return [
      h('h2', {}, 'Insert after this'),
      h('p', { class: 'muted' }, next ? `${good.length} of ${all.length} moves keep the next domino connected.` : 'This is the last domino.'),
      optionList((state.showAllInsert ? all : good).map((e) => ({
        label: moveLabel(g.moveById[e.move]),
        sub: (fits(e) ? '' : '⚠ ') + destination(e),
        onclick: () => edit.insert(i + 1, [e.move], i + 1),
      }))),
      next && good.length < all.length
        ? button(state.showAllInsert ? 'Show only moves that fit' : `Show all ${all.length} (some will need a bridge)`, toggleShowAll, { class: 'ghost' })
        : null,
    ];
  }
})(window.App);
