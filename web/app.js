/* Domino-strip UI. Depends on data.js, graph.js, sketch.js, map.js, share.js and practice.js. */
(function () {
  'use strict';
  const MG = window.MoveGraph;
  const SK = window.LeaderSketch;
  const PM = window.PositionMap;
  const Share = window.ComboShare;
  const BASE = window.BACHATA_DATA;

  // ------------------------------------------------------------ dom helpers
  const $ = (id) => document.getElementById(id);

  /** Build an element: h('p', { class: 'muted', onclick }, 'text', child, [more children]). */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
    return el;
  }

  const button = (label, onclick, attrs = {}) => h('button', { type: 'button', onclick, ...attrs }, label);

  /** A grid of option buttons. Each row: { label, sub, onclick, disabled, title }. */
  const optionList = (rows) => h('ul', { class: 'options' }, rows.map((r) => h('li', {},
    button([h('span', {}, r.label), h('span', { class: 'to' }, r.sub)], r.onclick, { disabled: r.disabled, title: r.title }))));

  const LEVEL_NAME = { 1: 'beginner', 2: 'intermediate', 3: 'advanced' };
  const badge = (kind) => h('span', { class: `badge k-${kind}` }, kind);
  const levelDots = (lvl) => h('span', { class: 'lvl', title: LEVEL_NAME[lvl] || '' }, '●'.repeat(lvl) + '○'.repeat(3 - lvl));
  const moveLabel = (m) => [m.name, ' ', badge(m.kind)];
  const shortName = (id) => (g.posById[id] ? g.posById[id].short || g.posById[id].name : '?');
  const posName = (id) => (g.posById[id] ? g.posById[id].name : '?');

  /** Copy text to the clipboard and say so on the button for a moment; if that fails, show it to copy by hand. */
  function copyText(text, el, okLabel = 'Copied') {
    el.dataset.label = el.dataset.label || el.textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => {
      el.textContent = okLabel;
      setTimeout(() => { el.textContent = el.dataset.label; }, 1800);
    }, () => { prompt('Copy this text:', text); });
  }

  /** Run a re-render that replaces the element `selector` while the user types in it, and keep the caret. */
  function keepFocus(selector, rerender) {
    const caret = document.activeElement.selectionStart;
    rerender();
    const again = document.querySelector(selector);
    if (again) { again.focus(); again.setSelectionRange(caret, caret); }
  }

  // ------------------------------------------------------------ state
  // Glossary: g = the compiled move graph (MoveGraph.compile); "item" = one evaluated domino from
  // MoveGraph.evaluateStrip; "own" moves and compounds were added in this browser.
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
  };

  const state = {
    startPos: 'open_LR',
    startWeight: 'mirrored',
    strip: [],             // move ids
    selected: null,        // index into strip, or null = "what comes next"
    kindFilter: 'all',
    search: '',
    showAllInsert: false,
    mapSelected: null,
    mapLink: null,         // { from, to } of a tapped map arrow
    maxLevel: [1, 2, 3].includes(store.get('bmc.maxLevel', 3)) ? store.get('bmc.maxLevel', 3) : 3,
  };
  let myMoves = store.get('bmc.moves', []);
  let myCompounds = store.get('bmc.compounds', []);
  let g;
  let mapLayout = null;
  let dataErrors = [];     // problems in data/*.yaml
  let ownErrors = {};      // own move or compound id -> its problems
  let importedNote = '';

  /** Compile the base data plus own moves and compounds. Call after any of them change. */
  function recompile() {
    g = MG.compile({ positions: BASE.positions, moves: [...BASE.moves, ...myMoves, ...myCompounds] });
    ownErrors = {};
    dataErrors = g.errors.filter((e) => {
      const own = [...myMoves, ...myCompounds].find((c) => e.includes(`"${c.id}"`));
      if (own) (ownErrors[own.id] = ownErrors[own.id] || []).push(e);
      return !own;
    });
    mapLayout = PM.layoutMap(g);
    dropUnknownMoves();
  }

  /** recompile() and redraw the parts of the page that show the data itself. */
  function reloadData() {
    recompile();
    renderData();
  }

  function dropUnknownMoves() {
    state.strip = state.strip.filter((id) => g.moveById[id]);
  }

  /** Apply a combo from a link or from this browser's storage. Unknown values keep the current ones. */
  function loadCombo(combo) {
    if (g.posById[combo.startPos]) state.startPos = combo.startPos;
    if (['mirrored', 'parallel'].includes(combo.startWeight)) state.startWeight = combo.startWeight;
    state.strip = Array.isArray(combo.strip) ? [...combo.strip] : [];
    state.selected = null;
    dropUnknownMoves();
  }

  const evaluate = () => MG.evaluateStrip(g, state.startPos, state.startWeight, state.strip);
  const withinLevel = (id) => (g.moveById[id] ? g.moveById[id].level <= state.maxLevel : false);

  function shareHash() {
    return Share.buildHash({ startPos: state.startPos, startWeight: state.startWeight, strip: state.strip, myMoves, myCompounds });
  }

  function persist() {
    store.set('bmc.state', { startPos: state.startPos, startWeight: state.startWeight, strip: state.strip });
    try { history.replaceState(null, '', state.strip.length ? shareHash() : location.pathname + location.search); } catch { /* file:// in some browsers */ }
  }

  // Undo: snapshots of the combo, taken whenever it changes.
  const undoStack = [];
  let lastSnap = null;
  const snapshot = () => JSON.stringify({ startPos: state.startPos, startWeight: state.startWeight, strip: state.strip });

  /** Call after every change to the combo: records undo, saves, re-renders. */
  function commit() {
    const snap = snapshot();
    if (lastSnap !== null && snap !== lastSnap) {
      undoStack.push(lastSnap);
      if (undoStack.length > 100) undoStack.shift();
    }
    lastSnap = snap;
    persist();
    render();
  }

  function undo() {
    const prev = undoStack.pop();
    if (!prev) return;
    Object.assign(state, JSON.parse(prev));
    lastSnap = prev;
    state.selected = null;
    persist();
    render();
  }

  /** Select a domino (or null for "what can follow"). */
  function select(i) {
    state.selected = i;
    state.search = '';
    state.showAllInsert = false;
    render();
  }

  /** Everything a user can do to the combo. Each one ends in commit(). */
  const edit = {
    add(ids) { state.strip.push(...ids); state.selected = null; commit(); },
    insert(at, ids, selected = null) { state.strip.splice(at, 0, ...ids); state.selected = selected; commit(); },
    replace(i, id) { state.strip[i] = id; commit(); },
    remove(i) { state.strip.splice(i, 1); state.selected = null; commit(); },
    move(i, d) {
      const [id] = state.strip.splice(i, 1);
      state.strip.splice(i + d, 0, id);
      state.selected = i + d;
      commit();
    },
    expand(i) { state.strip.splice(i, 1, ...g.moveById[state.strip[i]].sequence); state.selected = null; commit(); },
    cut(i) { state.strip.length = i + 1; state.selected = null; commit(); },
    setStrip(ids, selected = null) { state.strip = [...ids]; state.selected = selected; commit(); },
    clear() { edit.setStrip([]); },
    random() { edit.setStrip(MG.randomCombo(g, state.startPos, { steps: 4, maxLevel: state.maxLevel })); },
    setStart(id) { state.startPos = id; commit(); },
    setWeight(w) { state.startWeight = w; commit(); },
    startNewComboAt(id) { state.startPos = id; edit.clear(); },
    load(combo) { loadCombo(combo); commit(); },
  };

  /** Moves and compounds saved in this browser. */
  const own = {
    importShared(custom) {
      const fresh = (custom || []).filter((m) => !myMoves.some((x) => x.id === m.id));
      if (!fresh.length) return;
      myMoves = myMoves.concat(fresh);
      store.set('bmc.moves', myMoves);
      importedNote = `Added ${fresh.length} move${fresh.length > 1 ? 's' : ''} from the shared link: ${fresh.map((m) => m.name).join(', ')}. They're under "My moves".`;
    },
    addMove(move) {
      myMoves.push(move);
      store.set('bmc.moves', myMoves);
      reloadData();
      render();
    },
    deleteMove(id) {
      myMoves = myMoves.filter((x) => x.id !== id);
      store.set('bmc.moves', myMoves);
      reloadData();
      render();
    },
    saveCompound(name) {
      const base = 'my-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let id = base || 'my-compound';
      for (let n = 2; g.moveById[id]; n++) id = `${base}-${n}`;
      myCompounds.push({ id, name, kind: 'compound', sequence: [...state.strip] });
      store.set('bmc.compounds', myCompounds);
      reloadData();
      edit.setStrip([id], 0);
    },
    deleteCompound(id) {
      myCompounds = myCompounds.filter((x) => x.id !== id);
      store.set('bmc.compounds', myCompounds);
      reloadData();
      render();
    },
  };

  // ------------------------------------------------------------ render
  /** Redraw everything that depends on the combo. */
  function render() {
    const result = evaluate();
    if (state.selected !== null && state.selected >= state.strip.length) state.selected = null;
    renderStrip(result);
    renderSummary(result);
    renderPanel(result);
    renderMap(result);
    renderLibrary(result);
    syncToolbar();
  }

  /** Redraw what only changes when the data changes (own moves added or deleted). */
  function renderData() {
    renderMessages();
    renderPositions();
    renderMyMoves();
    renderCompounds();
  }

  function syncToolbar() {
    $('start-pos').value = state.startPos;
    $('start-weight').value = state.startWeight;
    $('max-level').value = String(state.maxLevel);
    const empty = state.strip.length === 0;
    $('btn-undo').disabled = undoStack.length === 0;
    $('btn-practice').disabled = empty;
    $('btn-text').disabled = empty;
    $('btn-clear').disabled = empty;
  }

  function renderMessages() {
    const note = $('notice');
    note.hidden = !importedNote;
    note.textContent = importedNote;
    const box = $('errors');
    box.hidden = dataErrors.length === 0;
    box.textContent = dataErrors.length ? 'Data problems:\n' + dataErrors.join('\n') : '';
  }

  // ------------------------------------------------------------ strip
  function renderStrip(result) {
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
  }

  function emptyState() {
    const examples = g.moves.filter((m) => m.kind === 'compound' && !m.id.startsWith('my-'))
      .filter((m) => (g.edgesByMove[m.id] || []).some((e) => e.from === state.startPos));
    return h('div', { class: 'empty' },
      h('p', {}, 'Start a combo: pick moves below, roll a random one, or load an example.'),
      h('div', { class: 'actions' },
        button('Random combo', edit.random, { class: 'primary' }),
        examples.map((m) => button('Example: ' + m.name, () => edit.setStrip(m.sequence)))));
  }

  function renderSummary(result) {
    const warnings = result.items.filter((it) => it.timingWarn || it.weightWarn).length;
    const breaks = result.items.filter((it) => it.broken).length;
    $('summary').textContent = state.strip.length
      ? `${state.strip.length} dominoes · ${result.totalCounts} counts (${(result.totalCounts / 8).toFixed(1)} × 8) · ` +
        `ends in ${posName(result.end)}, ${result.weight} weight` +
        (breaks ? ` · ${breaks} break${breaks > 1 ? 's' : ''}` : '') +
        (warnings ? ` · ${warnings} soft warning${warnings > 1 ? 's' : ''}` : '')
      : '';
  }

  function domino(it, i) {
    const m = it.move;
    if (it.missing) {
      return button(h('div', { class: 'name' }, `Unknown move "${it.id}"`), () => select(i), { class: 'domino broken' });
    }
    const flags = [];
    if (it.timingWarn) flags.push(h('span', { class: 'flag', title: 'Starts mid-phrase' }, ` · starts on ${it.beat}`));
    if (it.weightWarn) flags.push(h('span', { class: 'flag', title: 'Weight mismatch' }, ` · needs ${g.weightOf(m.id).from}`));
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

  /** "1→4" style range within the 8-count; 0-count adjusters happen on the fly. */
  function countLabel(it) {
    const n = it.move.counts;
    if (!n) return 'on the fly';
    const end = ((it.countFrom + n - 1) % 8) + 1;
    return `${n} ct · ${it.beat}→${end}`;
  }

  // ------------------------------------------------------------ panel
  function renderPanel(result) {
    const it = state.selected === null ? null : result.items[state.selected];
    const main = it ? detailPanel(it, state.selected) : nextPanel(result.end);
    let side;
    if (!it) side = [sketchFigure(result.end, 'Where you are now')];
    else if (it.missing || !it.from) side = [];
    else if (it.from === it.to) side = [sketchFigure(it.from, 'Start and end (same position)')];
    else side = [sketchFigure(it.from, 'Start'), sketchFigure(it.to, 'End')];
    $('panel').replaceChildren(h('div', { class: 'panel-grid' },
      h('div', { class: 'panel-main' }, main),
      side.length ? h('aside', { class: 'leader-view', 'aria-label': 'Leader view' }, h('h3', {}, 'Leader view'), side) : null));
  }

  /** Top-down sketch of a position as the leader sees it. */
  function sketchFigure(posId, caption) {
    const p = g.posById[posId];
    if (!p) return null;
    const art = h('div', { class: 'sk-art' });
    art.innerHTML = SK.sketchSVG(p, { title: p.name });
    return h('figure', { class: 'sk-fig' }, art,
      h('figcaption', {}, h('strong', {}, caption + ': '), p.name, h('br'), h('span', { class: 'muted' }, SK.describe(p))));
  }

  function kindChips() {
    return h('div', { class: 'chips' }, ['all', 'move', 'styling', 'adjuster', 'compound'].map((k) =>
      button(k, () => { state.kindFilter = k; render(); }, { class: state.kindFilter === k ? 'on' : '' })));
  }

  function nextPanel(end) {
    const options = MG.nextMoves(g, end).filter((e) => {
      const m = g.moveById[e.move];
      if (state.kindFilter !== 'all' && m.kind !== state.kindFilter) return false;
      if (m.level > state.maxLevel) return false;
      return !state.search || m.name.toLowerCase().includes(state.search.toLowerCase());
    });
    const search = h('input', {
      class: 'search', type: 'search', placeholder: 'Filter moves…', 'aria-label': 'Filter next moves', value: state.search,
      oninput: (ev) => { state.search = ev.target.value; keepFocus('.search', render); },
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
      const alts = MG.alternatives(g, it.from, it.to, m.id).filter(withinLevel);
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
      const all = MG.nextMoves(g, it.to).filter((e) => g.moveById[e.move].kind !== 'compound' && withinLevel(e.move));
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
            () => { state.showAllInsert = !state.showAllInsert; render(); }, { class: 'ghost' })
          : null].filter(Boolean));
    }
    return wrap;
  }

  // ------------------------------------------------------------ map
  function renderMap(result) {
    const path = result.items.filter((it) => !it.broken && it.from).map((it) => ({ from: it.from, to: it.to }));
    if (!path.length) path.push({ from: state.startPos, to: state.startPos });
    $('map').innerHTML = PM.mapSVG(g, mapLayout, { selected: state.mapSelected, path });
    renderMapInfo(result);
  }

  function showOnMap(id) {
    state.mapSelected = id;
    render();
  }

  function renderMapInfo(result) {
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
        button(arrow + ' ' + shortName(pid), () => showOnMap(pid), { class: 'link' }),
        ': ', [...names].sort().join(', '))))
      : h('p', { class: 'muted' }, 'None yet.');
    const bridges = result.end !== id ? MG.findBridges(g, result.end, id, { limit: 3, maxLevel: state.maxLevel }) : [];
    box.replaceChildren(h('div', {},
      h('div', { class: 'panel-head' }, h('h3', {}, posName(id)), button('Close', () => showOnMap(null), { class: 'ghost' })),
      sketchFigure(id, 'Leader view'),
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

  function initMap() {
    const onMapActivate = (ev) => {
      const link = ev.target.closest && ev.target.closest('[data-link]');
      if (link) {
        const [from, to] = link.getAttribute('data-link').split('>');
        state.mapLink = { from, to };
        showOnMap(from);
        return;
      }
      const node = ev.target.closest && ev.target.closest('[data-pos]');
      if (!node) return;
      state.mapLink = null;
      const id = node.getAttribute('data-pos');
      showOnMap(state.mapSelected === id ? null : id);
      if (window.matchMedia('(max-width: 720px)').matches) $('map-info').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    $('map').addEventListener('click', onMapActivate);
    $('map').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onMapActivate(ev); } });
  }

  // ------------------------------------------------------------ reference: positions table and move library
  function renderPositions() {
    const healthById = Object.fromEntries(g.health.map((x) => [x.id, x]));
    const showPosition = (id) => {
      showOnMap(id);
      document.querySelector('.map-section').scrollIntoView({ behavior: 'smooth' });
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
  }

  /** Where a move can start and end: froms, tos (null = in place), all = starts anywhere. */
  function endpoints(id) {
    const edges = g.edgesByMove[id] || [];
    const froms = [...new Set(edges.map((e) => e.from))];
    const same = edges.length && edges.every((e) => e.from === e.to);
    const tos = same ? null : [...new Set(edges.map((e) => e.to))];
    return { froms, tos, all: froms.length === g.positions.length };
  }

  function renderLibrary(result) {
    const box = $('library');
    if (!$('library-section').open) { box.replaceChildren(); return; }
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
  }

  function initLibrary() {
    $('lib-search').addEventListener('input', render);
    $('lib-kind').addEventListener('change', render);
    $('lib-check').addEventListener('change', render);
    $('library-section').addEventListener('toggle', render);
  }

  // ------------------------------------------------------------ my moves: add-a-move form, own moves, own compounds
  function initMoveForm() {
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
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'move';
      let id = 'my-' + slug;
      for (let n = 2; g.moveById[id]; n++) id = `my-${slug}-${n}`;
      const move = {
        id, name, kind: form.elements.kind.value, level: Number(form.elements.level.value),
        from, to: form.elements.kind.value === 'styling' ? 'same' : to.value, counts,
      };
      const notes = form.elements.notes.value.trim();
      if (notes) move.notes = notes;
      const test = MG.compile({ positions: BASE.positions, moves: [...BASE.moves, ...myMoves, move] });
      const problems = test.errors.filter((e) => e.includes(`"${id}"`));
      if (problems.length) return fail(problems.join(' '));
      own.addMove(move);
      form.reset();
      fromBox.querySelectorAll('input').forEach((i) => { i.checked = false; });
      syncKind();
      status.className = 'small';
      status.textContent = `Saved "${name}". It now appears under "what can follow" for ${from.map(shortName).join(', ')}.`;
    });
  }

  const copyButton = (label, text) => button(label, (ev) => copyText(text, ev.currentTarget));

  function renderMyMoves() {
    const box = $('my-moves');
    if (!myMoves.length) { box.replaceChildren(); return; }
    const broken = myMoves.filter((m) => ownErrors[m.id]);
    const yaml = myMoves.map(Share.moveYaml).join('\n');
    box.replaceChildren(h('div', {},
      h('h3', {}, `Your moves (${myMoves.length})`),
      broken.length ? h('div', { class: 'errors' }, broken.map((m) => ownErrors[m.id].join('\n')).join('\n')) : null,
      h('pre', {}, yaml),
      h('div', { class: 'actions' },
        copyButton('Copy YAML', yaml),
        myMoves.map((m) => button(`Delete "${m.name}"`, () => {
          if (myCompounds.some((c) => c.sequence.includes(m.id)) && !confirm(`"${m.name}" is used in a compound move, which will break. Delete anyway?`)) return;
          own.deleteMove(m.id);
        }, { class: 'ghost' })))));
  }

  function renderCompounds() {
    const box = $('compounds');
    if (!myCompounds.length) {
      box.replaceChildren(h('p', { class: 'muted' },
        'Build a combo without breaks, then use "Save as compound". Saved compounds live in this browser; ' +
        'copy their YAML into data/moves.yaml to keep them for good.'));
      return;
    }
    const broken = Object.entries(ownErrors);
    const yaml = myCompounds.map(Share.compoundYaml).join('\n');
    box.replaceChildren(
      broken.length ? h('div', { class: 'errors' },
        'Broken compound moves (a part changed or was removed):\n' + broken.map(([, errs]) => errs.join('\n')).join('\n')) : '',
      h('pre', {}, yaml),
      h('div', { class: 'actions' },
        copyButton('Copy YAML', yaml),
        myCompounds.map((c) => button(`Delete "${c.name}"`, () => own.deleteCompound(c.id), { class: 'ghost' }))));
  }

  // ------------------------------------------------------------ toolbar, keyboard, boot
  /** Practice and "save as compound" need a combo without breaks. */
  function requireUnbroken(result) {
    if (!result.items.some((it) => it.broken)) return true;
    alert('Fix the breaks first (click a red "bridge").');
    return false;
  }

  function initToolbar() {
    for (const p of g.positions) $('start-pos').append(h('option', { value: p.id }, p.name));
    $('start-pos').addEventListener('change', (ev) => edit.setStart(ev.target.value));
    $('start-weight').addEventListener('change', (ev) => edit.setWeight(ev.target.value));
    $('max-level').addEventListener('change', (ev) => {
      state.maxLevel = Number(ev.target.value);
      store.set('bmc.maxLevel', state.maxLevel);
      render();
    });
    $('btn-undo').addEventListener('click', undo);
    $('btn-clear').addEventListener('click', edit.clear);
    $('btn-random').addEventListener('click', edit.random);
    $('btn-practice').addEventListener('click', () => {
      const result = evaluate();
      if (!result.items.length) return alert('Add some moves first.');
      if (!requireUnbroken(result)) return;
      window.Practice.open(result.items, { posName, sketchSVG: SK.sketchSVG, positions: g.posById }, state.selected ?? 0);
    });
    $('btn-share').addEventListener('click', (ev) => copyText(location.href.split('#')[0] + shareHash(), ev.currentTarget, 'Link copied'));
    $('btn-text').addEventListener('click', (ev) => {
      const result = evaluate();
      if (!result.items.length) return;
      const url = location.href.split('#')[0] + shareHash();
      copyText(Share.comboText(result, posName(state.startPos), posName(result.end), url), ev.currentTarget);
    });
    $('btn-save').addEventListener('click', () => {
      if (state.strip.length < 2) return alert('Add at least two dominoes first.');
      if (!requireUnbroken(evaluate())) return;
      const name = prompt('Name for this compound move:');
      if (!name) return;
      own.saveCompound(name);
      $('my-section').open = true;
    });
  }

  function onKey(ev) {
    if (document.querySelector('dialog[open]')) return;
    const tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    const last = state.strip.length - 1;
    const sel = state.selected;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); undo(); return; }
    if (ev.key === 'Escape') select(null);
    else if (ev.key === 'ArrowLeft' && state.strip.length) select(sel === null ? last : Math.max(0, sel - 1));
    else if (ev.key === 'ArrowRight' && sel !== null) select(sel < last ? sel + 1 : null);
    else if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel !== null) { ev.preventDefault(); edit.remove(sel); }
  }

  /** A shared link opened while the page is already open. */
  function onHashChange() {
    const combo = Share.parseHash(location.hash);
    if (!combo) return;
    if (combo.custom.length) { own.importShared(combo.custom); reloadData(); }
    edit.load(combo);
  }

  // Offline support where service workers are allowed (https or localhost, not file://).
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }

  // A shared link wins over what this browser remembers.
  const initial = Share.parseHash(location.hash) || store.get('bmc.state', {});
  own.importShared(initial.custom);
  recompile();
  loadCombo(initial);
  initToolbar();
  initMap();
  initMoveForm();
  initLibrary();
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', onHashChange);
  lastSnap = snapshot();
  persist();
  renderData();
  render();
})();
