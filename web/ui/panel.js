/* Panel under the strip: "what can follow", or the details of the selected domino, with the leader view. */
(function (App) {
  'use strict';
  const MG = window.MoveGraph;
  const SK = window.LeaderSketch;
  const { $, h, button, optionList, levelDots, moveLabel, posName, shortName, LEVEL_NAME, state, edit, select } = App;

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
            sub: [e.to === e.from ? '↺ same' : '→ ' + shortName(e.to), ` · ${m.counts} ct `, levelDots(m.level)],
            onclick: () => { state.search = ''; edit.add([m.id]); },
          };
        }))
        : h('p', { class: 'muted' }, 'Nothing matches. This position needs more moves in data/moves.yaml.'));
  }

  function detailPanel(it, i) {
    const g = App.g;
    const m = it.move;
    const wrap = h('div', { class: 'detail' });
    if (it.missing) {
      wrap.append(h('p', {}, `Move "${it.id}" no longer exists.`), button('Remove', () => edit.remove(i)));
      return wrap;
    }
    const w = g.weightOf(m.id);
    const nameOf = (id) => (g.moveById[id] ? g.moveById[id].name : id);
    wrap.append(...[
      h('div', { class: 'panel-head' }, h('h2', {}, moveLabel(m)), button('Close', () => select(null), { class: 'ghost' })),
      m.check ? h('div', { class: 'check' }, '⚑ Needs review: ' + m.check) : null,
      h('dl', {},
        h('dt', {}, 'From'), h('dd', {}, posName(it.from), h('br'), h('code', {}, MG.notation(g.posById[it.from]))),
        h('dt', {}, 'To'), h('dd', {}, posName(it.to), h('br'), h('code', {}, MG.notation(g.posById[it.to]))),
        h('dt', {}, 'Counts'), h('dd', {}, `${m.counts} (starts on beat ${it.beat})`),
        h('dt', {}, 'Level'), h('dd', {}, levelDots(m.level), ' ', LEVEL_NAME[m.level] || ''),
        h('dt', {}, 'Weight'), h('dd', {}, `${w.from || 'any'} → ${w.to || 'unchanged'}` + (it.weightWarn ? ` (you arrive ${it.weightIn})` : '')),
        m.opposite ? [h('dt', {}, 'Opposite'), h('dd', {}, nameOf(m.opposite))] : null,
        m.sequence ? [h('dt', {}, 'Made of'), h('dd', {}, m.sequence.map(nameOf).join(' › '))] : null,
        m.notes ? [h('dt', {}, 'Notes'), h('dd', {}, m.notes)] : null),
      h('div', { class: 'actions' },
        button('Remove', () => edit.remove(i)),
        i > 0 ? button('‹ Move left', () => edit.move(i, -1)) : null,
        i < state.strip.length - 1 ? button('Move right ›', () => edit.move(i, 1)) : null,
        m.sequence ? button('Expand into parts', () => edit.expand(i)) : null,
        button('Cut here', () => edit.cut(i))),
    ].filter(Boolean));

    if (it.broken) {
      const bridges = it.from ? MG.findBridges(g, it.expected, it.from, { maxLevel: state.maxLevel }) : [];
      wrap.append(h('h2', {}, `Bridge: ${posName(it.expected)} → ${posName(it.from)}`),
        bridges.length
          ? optionList(bridges.map((path) => ({
            label: path.map(nameOf).join(' › '),
            sub: `${path.length} step${path.length > 1 ? 's' : ''}`,
            onclick: () => edit.insert(i, path),
          })))
          : h('p', { class: 'muted' }, 'No bridge within 3 moves. Remove this domino or add an adjuster to the data.'));
    } else {
      const alts = MG.alternatives(g, it.from, it.to, m.id).filter(App.withinLevel);
      wrap.append(h('h2', {}, `Replace with (same start and end)`),
        alts.length
          ? optionList(alts.map((id) => ({
            label: moveLabel(g.moveById[id]),
            sub: `${g.moveById[id].counts} ct`,
            onclick: () => edit.replace(i, id),
          })))
          : h('p', { class: 'muted' }, 'No alternatives yet.'));
    }

    if (it.to) {
      const next = state.strip[i + 1];
      const nextEdges = next ? g.edgesByMove[next] || [] : null;
      const fits = (e) => !nextEdges || nextEdges.some((x) => x.from === e.to);
      const all = MG.nextMoves(g, it.to).filter((e) => g.moveById[e.move].kind !== 'compound' && App.withinLevel(e.move));
      const good = all.filter(fits);
      const shown = state.showAllInsert ? all : good;
      wrap.append(...[h('h2', {}, 'Insert after this'),
        h('p', { class: 'muted' }, next
          ? `${good.length} of ${all.length} moves keep the next domino connected.`
          : 'This is the last domino.'),
        optionList(shown.map((e) => ({
          label: moveLabel(g.moveById[e.move]),
          sub: (fits(e) ? '' : '⚠ ') + (e.to === e.from ? '↺ same' : '→ ' + shortName(e.to)),
          onclick: () => edit.insert(i + 1, [e.move], i + 1),
        }))),
        next && good.length < all.length
          ? button(state.showAllInsert ? 'Show only moves that fit' : `Show all ${all.length} (some will need a bridge)`,
            () => { state.showAllInsert = !state.showAllInsert; App.render(); }, { class: 'ghost' })
          : null].filter(Boolean));
    }
    return wrap;
  }
})(window.App);
