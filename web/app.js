/* Domino-strip UI. Depends on window.BACHATA_DATA (data.js) and window.MoveGraph (graph.js). */
(function () {
  'use strict';
  const MG = window.MoveGraph;
  const SK = window.LeaderSketch;
  const PM = window.PositionMap;
  const BASE = window.BACHATA_DATA;
  const KIND_LABEL = { move: 'move', styling: 'styling', adjuster: 'adjuster', compound: 'compound' };

  // ------------------------------------------------------------ storage (per-browser convenience)
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
  };

  // A shared link (#start=…&weight=…&moves=a,b,c) wins over what this browser remembers.
  function fromHash() {
    const q = new URLSearchParams(location.hash.slice(1));
    if (!q.has('moves') && !q.has('start')) return null;
    return {
      startPos: q.get('start') || undefined,
      startWeight: q.get('weight') || undefined,
      strip: (q.get('moves') || '').split(',').filter(Boolean),
      custom: decodeMoves(q.get('custom')),
    };
  }

  // Moves added in the app travel inside share links as base64url JSON.
  function encodeMoves(moves) {
    const json = JSON.stringify(moves);
    return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeMoves(text) {
    if (!text) return [];
    try {
      const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
      const list = JSON.parse(decodeURIComponent(escape(atob(b64))));
      if (!Array.isArray(list)) return [];
      const str = (v, max) => typeof v === 'string' && v.length <= max;
      return list.filter((m) => m && str(m.id, 80) && m.id.startsWith('my-') && str(m.name, 60) &&
        ['move', 'styling', 'adjuster'].includes(m.kind) && [1, 2, 3].includes(m.level) &&
        Array.isArray(m.from) && m.from.every((f) => str(f, 40)) && str(m.to, 40) &&
        Number.isInteger(m.counts) && m.counts >= 0 && m.counts <= 64 && (m.notes === undefined || str(m.notes, 200)))
        .map((m) => ({ id: m.id, name: m.name, kind: m.kind, level: m.level, from: m.from, to: m.to, counts: m.counts, ...(m.notes ? { notes: m.notes } : {}) }));
    } catch { return []; }
  }
  const saved = fromHash() || store.get('bmc.state', {});
  const state = {
    startPos: saved.startPos || 'open_LR',
    startWeight: saved.startWeight === 'parallel' ? 'parallel' : 'mirrored',
    strip: Array.isArray(saved.strip) ? saved.strip : [],
    selected: null, // index into strip, or null = "what comes next"
    kindFilter: 'all',
    search: '',
    showAllInsert: false,
    mapSelected: null,
    maxLevel: [1, 2, 3].includes(store.get('bmc.maxLevel', 3)) ? store.get('bmc.maxLevel', 3) : 3,
  };
  let mapLayout = null;
  const undoStack = [];
  let lastSnap = null;
  const snapshot = () => JSON.stringify({ startPos: state.startPos, startWeight: state.startWeight, strip: state.strip });
  let myCompounds = store.get('bmc.compounds', []);
  let myMoves = store.get('bmc.moves', []);
  let importedNote = '';
  function importShared(custom) {
    const fresh = (custom || []).filter((m) => !myMoves.some((x) => x.id === m.id));
    if (!fresh.length) return;
    myMoves = myMoves.concat(fresh);
    store.set('bmc.moves', myMoves);
    importedNote = `Added ${fresh.length} move${fresh.length > 1 ? 's' : ''} from the shared link: ${fresh.map((m) => m.name).join(', ')}. They're under "My moves".`;
  }
  importShared(saved.custom);
  let g;
  let dataErrors = [];   // problems in data/*.yaml
  let myErrors = {};     // compound id -> problems with compounds saved in this browser

  function recompile() {
    g = MG.compile({ positions: BASE.positions, moves: [...BASE.moves, ...myMoves, ...myCompounds] });
    myErrors = {};
    dataErrors = g.errors.filter((e) => {
      const own = [...myMoves, ...myCompounds].find((c) => e.includes(`"${c.id}"`));
      if (own) (myErrors[own.id] = myErrors[own.id] || []).push(e);
      return !own;
    });
    if (!g.posById[state.startPos]) state.startPos = BASE.positions[0].id;
    mapLayout = PM ? PM.layoutMap(g) : null;
    state.strip = state.strip.filter((id) => g.moveById[id]);
  }

  // ------------------------------------------------------------ helpers
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
  const short = (id) => (g.posById[id] ? g.posById[id].short || g.posById[id].name : '?');
  const posName = (id) => (g.posById[id] ? g.posById[id].name : '?');
  const badge = (kind) => h('span', { class: `badge k-${kind}` }, KIND_LABEL[kind] || kind);
  const LEVEL_NAME = { 1: 'beginner', 2: 'intermediate', 3: 'advanced' };
  const dots = (lvl) => h('span', { class: 'lvl', title: LEVEL_NAME[lvl] || '' }, '●'.repeat(lvl) + '○'.repeat(3 - lvl));
  const allowed = (id) => (g.moveById[id] ? g.moveById[id].level <= state.maxLevel : false);
  const $ = (id) => document.getElementById(id);

  /** Share link: compounds saved only in this browser are spelled out into their parts. */
  function shareHash() {
    const mine = Object.fromEntries(myCompounds.map((c) => [c.id, c]));
    const flat = (id) => (mine[id] ? mine[id].sequence.flatMap(flat) : [id]);
    const q = new URLSearchParams({ start: state.startPos, weight: state.startWeight });
    const ids = state.strip.flatMap(flat);
    q.set('moves', ids.join(','));
    const custom = myMoves.filter((m) => ids.includes(m.id));
    if (custom.length) q.set('custom', encodeMoves(custom));
    return '#' + q.toString().replace(/%2C/g, ',');
  }

  function persist() {
    store.set('bmc.state', { startPos: state.startPos, startWeight: state.startWeight, strip: state.strip });
    try { history.replaceState(null, '', state.strip.length ? shareHash() : location.pathname + location.search); } catch { /* file:// in some browsers */ }
  }

  /** Call after every change to the combo: records undo, saves, re-renders. */
  function update() {
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
    $('start-pos').value = state.startPos;
    $('start-weight').value = state.startWeight;
    persist();
    render();
  }

  // ------------------------------------------------------------ render
  function render() {
    const result = MG.evaluateStrip(g, state.startPos, state.startWeight, state.strip);
    if (state.selected !== null && state.selected >= state.strip.length) state.selected = null;
    renderErrors();
    renderStrip(result);
    renderPanel(result);
    renderMap(result);
    renderPositions();
    renderCompounds();
    renderMyMoves();
    renderLibrary(result);
    $('btn-undo').disabled = undoStack.length === 0;
    $('btn-practice').disabled = state.strip.length === 0;
    $('btn-text').disabled = state.strip.length === 0;
    $('btn-clear').disabled = state.strip.length === 0;
  }

  function renderErrors() {
    const note = $('notice');
    if (note) { note.hidden = !importedNote; note.textContent = importedNote; }
    const box = $('errors');
    box.hidden = dataErrors.length === 0;
    box.textContent = dataErrors.length ? 'Data problems:\n' + dataErrors.join('\n') : '';
  }

  function renderStrip(result) {
    const strip = $('strip');
    strip.replaceChildren();
    strip.append(h('span', { class: 'start-pill', title: posName(state.startPos) }, 'Start: ' + short(state.startPos)));

    result.items.forEach((it, i) => {
      if (it.broken) {
        strip.append(h('span', { class: 'joint broken' },
          h('button', { type: 'button', onclick: () => select(i), title: 'These dominoes do not connect' },
            '✕ bridge')));
      } else {
        strip.append(h('span', { class: 'joint', 'aria-hidden': 'true' }, '›'));
      }
      strip.append(domino(it, i));
    });

    if (!state.strip.length) {
      const examples = g.moves.filter((m) => m.kind === 'compound' && !m.id.startsWith('my-'))
        .filter((m) => (g.edgesByMove[m.id] || []).some((e) => e.from === state.startPos));
      strip.append(h('div', { class: 'empty' },
        h('p', {}, 'Start a combo: pick moves below, roll a random one, or load an example.'),
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'primary', onclick: () => $('btn-random').click() }, 'Random combo'),
          examples.map((m) => h('button', {
            type: 'button',
            onclick: () => { state.strip = [...m.sequence]; update(); },
          }, 'Example: ' + m.name)))));
      return renderSummary(result);
    }

    strip.append(h('span', { class: 'joint', 'aria-hidden': 'true' }, '›'));
    strip.append(h('button', {
      type: 'button',
      class: 'domino add' + (state.selected === null ? ' selected' : ''),
      onclick: () => select(null),
    }, '+ next move'));

    renderSummary(result);
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
      return h('button', { type: 'button', class: 'domino broken', onclick: () => select(i) },
        h('div', { class: 'name' }, `Unknown move "${it.id}"`));
    }
    const flags = [];
    if (it.timingWarn) flags.push(h('span', { class: 'flag', title: 'Starts mid-phrase' }, ` · starts on ${it.beat}`));
    if (it.weightWarn) flags.push(h('span', { class: 'flag', title: 'Weight mismatch' }, ` · needs ${m.weight.from || g.weightOf(m.id).from}`));
    if (m.check) flags.push(h('span', { class: 'flag', title: m.check }, ' · ⚑'));
    return h('button', {
      type: 'button',
      class: `domino k-${m.kind}` + (it.broken ? ' broken' : '') + (state.selected === i ? ' selected' : ''),
      onclick: () => select(i),
      title: `${posName(it.from)} → ${posName(it.to)}`,
    },
      h('div', { class: 'halves' }, h('span', {}, short(it.from)), h('span', {}, short(it.to))),
      h('div', { class: 'name' }, m.name),
      h('div', { class: 'meta' }, countLabel(it), flags));
  }

  /** "1→4" style range within the 8-count; 0-count adjusters happen on the fly. */
  function countLabel(it) {
    const n = it.move.counts;
    if (!n) return 'on the fly';
    const end = ((it.countFrom + n - 1) % 8) + 1;
    return `${n} ct · ${it.beat}→${end}`;
  }

  function select(i) {
    state.selected = i;
    state.search = '';
    state.showAllInsert = false;
    render();
  }

  // ------------------------------------------------------------ panel
  function renderPanel(result) {
    const panel = $('panel');
    panel.replaceChildren();
    const it = state.selected === null ? null : result.items[state.selected];
    const main = it ? detailPanel(it, state.selected, result) : nextPanel(result.end);
    let side;
    if (!it) side = [sketchFigure(result.end, 'Where you are now')];
    else if (it.missing || !it.from) side = [];
    else if (it.from === it.to) side = [sketchFigure(it.from, 'Start and end (same position)')];
    else side = [sketchFigure(it.from, 'Start'), sketchFigure(it.to, 'End')];
    panel.append(h('div', { class: 'panel-grid' },
      h('div', { class: 'panel-main' }, main),
      side.length ? h('aside', { class: 'leader-view', 'aria-label': 'Leader view' },
        h('h3', {}, 'Leader view'), side) : null));
  }

  /** Top-down sketch of a position as the leader sees it. */
  function sketchFigure(posId, caption) {
    const p = g.posById[posId];
    if (!p || !SK) return null;
    const art = h('div', { class: 'sk-art' });
    art.innerHTML = SK.sketchSVG(p, { title: p.name });
    return h('figure', { class: 'sk-fig' }, art,
      h('figcaption', {}, h('strong', {}, caption + ': '), p.name, h('br'),
        h('span', { class: 'muted' }, SK.describe(p))));
  }

  function kindChips() {
    return h('div', { class: 'chips' }, ['all', 'move', 'styling', 'adjuster', 'compound'].map((k) =>
      h('button', {
        type: 'button',
        class: state.kindFilter === k ? 'on' : '',
        onclick: () => { state.kindFilter = k; render(); },
      }, k)));
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
      oninput: (ev) => {
        state.search = ev.target.value;
        const pos = ev.target.selectionStart;
        render();
        const again = document.querySelector('.search');
        if (again) { again.focus(); again.setSelectionRange(pos, pos); }
      },
    });
    return h('div', {},
      h('div', { class: 'panel-head' },
        h('h2', {}, `What can follow ${posName(end)}`), kindChips()),
      search,
      options.length
        ? h('ul', { class: 'options' }, options.map((e) => {
          const m = g.moveById[e.move];
          return h('li', {}, h('button', {
            type: 'button',
            onclick: () => { state.strip.push(m.id); state.search = ''; update(); },
          },
            h('span', {}, m.name, ' ', badge(m.kind)),
            h('span', { class: 'to' }, e.to === e.from ? '↺ same' : '→ ' + short(e.to), ` · ${m.counts} ct `, dots(m.level))));
        }))
        : h('p', { class: 'muted' }, 'Nothing matches. This position needs more moves in data/moves.yaml.'));
  }

  function detailPanel(it, i, result) {
    const m = it.move;
    const wrap = h('div', { class: 'detail' });
    if (it.missing) {
      wrap.append(h('p', {}, `Move "${it.id}" no longer exists.`),
        h('button', { type: 'button', onclick: () => removeAt(i) }, 'Remove'));
      return wrap;
    }
    const w = g.weightOf(m.id);
    wrap.append(...[
      h('div', { class: 'panel-head' }, h('h2', {}, m.name, ' ', badge(m.kind)),
        h('button', { type: 'button', class: 'ghost', onclick: () => select(null) }, 'Close')),
      m.check ? h('div', { class: 'check' }, '⚑ Needs review: ' + m.check) : null,
      h('dl', {},
        h('dt', {}, 'From'), h('dd', {}, posName(it.from), h('br'), h('code', {}, MG.notation(g.posById[it.from]))),
        h('dt', {}, 'To'), h('dd', {}, posName(it.to), h('br'), h('code', {}, MG.notation(g.posById[it.to]))),
        h('dt', {}, 'Counts'), h('dd', {}, `${m.counts} (starts on beat ${it.beat})`),
        h('dt', {}, 'Level'), h('dd', {}, dots(m.level), ' ', LEVEL_NAME[m.level] || ''),
        h('dt', {}, 'Weight'), h('dd', {}, `${w.from || 'any'} → ${w.to || 'unchanged'}` + (it.weightWarn ? ` (you arrive ${it.weightIn})` : '')),
        m.opposite ? [h('dt', {}, 'Opposite'), h('dd', {}, g.moveById[m.opposite] ? g.moveById[m.opposite].name : m.opposite)] : null,
        m.sequence ? [h('dt', {}, 'Made of'), h('dd', {}, m.sequence.map((id) => g.moveById[id] ? g.moveById[id].name : id).join(' › '))] : null,
        m.notes ? [h('dt', {}, 'Notes'), h('dd', {}, m.notes)] : null),
      h('div', { class: 'actions' },
        h('button', { type: 'button', onclick: () => removeAt(i) }, 'Remove'),
        i > 0 ? h('button', { type: 'button', onclick: () => moveBy(i, -1) }, '‹ Move left') : null,
        i < state.strip.length - 1 ? h('button', { type: 'button', onclick: () => moveBy(i, 1) }, 'Move right ›') : null,
        m.sequence ? h('button', { type: 'button', onclick: () => expand(i) }, 'Expand into parts') : null,
        h('button', { type: 'button', onclick: () => { state.strip.length = i + 1; state.selected = null; update(); } }, 'Cut here')),
    ].filter(Boolean));

    if (it.broken) {
      const bridges = it.from ? MG.findBridges(g, it.expected, it.from, { maxLevel: state.maxLevel }) : [];
      wrap.append(h('h2', {}, `Bridge: ${posName(it.expected)} → ${posName(it.from)}`),
        bridges.length
          ? h('ul', { class: 'options' }, bridges.map((path) => h('li', {}, h('button', {
            type: 'button',
            onclick: () => { state.strip.splice(i, 0, ...path); state.selected = null; update(); },
          }, h('span', {}, path.map((id) => g.moveById[id].name).join(' › ')),
            h('span', { class: 'to' }, `${path.length} step${path.length > 1 ? 's' : ''}`)))))
          : h('p', { class: 'muted' }, 'No bridge within 3 moves. Remove this domino or add an adjuster to the data.'));
    } else {
      const alts = MG.alternatives(g, it.from, it.to, m.id).filter(allowed);
      wrap.append(h('h2', {}, `Replace with (same start and end)`),
        alts.length
          ? h('ul', { class: 'options' }, alts.map((id) => h('li', {}, h('button', {
            type: 'button',
            onclick: () => { state.strip[i] = id; update(); },
          }, h('span', {}, g.moveById[id].name, ' ', badge(g.moveById[id].kind)),
            h('span', { class: 'to' }, `${g.moveById[id].counts} ct`)))))
          : h('p', { class: 'muted' }, 'No alternatives yet.'));
    }

    if (it.to) {
      const next = state.strip[i + 1];
      const nextEdges = next ? g.edgesByMove[next] || [] : null;
      const fits = (e) => !nextEdges || nextEdges.some((x) => x.from === e.to);
      const all = MG.nextMoves(g, it.to).filter((e) => g.moveById[e.move].kind !== 'compound' && allowed(e.move));
      const good = all.filter(fits);
      const shown = state.showAllInsert ? all : good;
      wrap.append(...[h('h2', {}, 'Insert after this'),
        h('p', { class: 'muted' }, next
          ? `${good.length} of ${all.length} moves keep the next domino connected.`
          : 'This is the last domino.'),
        h('ul', { class: 'options' }, shown.map((e) => {
          const mm = g.moveById[e.move];
          return h('li', {}, h('button', {
            type: 'button',
            onclick: () => { state.strip.splice(i + 1, 0, mm.id); state.selected = i + 1; update(); },
          }, h('span', {}, mm.name, ' ', badge(mm.kind)),
            h('span', { class: 'to' }, (fits(e) ? '' : '⚠ ') + (e.to === e.from ? '↺ same' : '→ ' + short(e.to)))));
        })),
        next && good.length < all.length ? h('button', {
          type: 'button', class: 'ghost',
          onclick: () => { state.showAllInsert = !state.showAllInsert; render(); },
        }, state.showAllInsert ? 'Show only moves that fit' : `Show all ${all.length} (some will need a bridge)`) : null].filter(Boolean));
    }
    return wrap;
  }

  function removeAt(i) { state.strip.splice(i, 1); state.selected = null; update(); }
  function moveBy(i, d) {
    const [x] = state.strip.splice(i, 1);
    state.strip.splice(i + d, 0, x);
    state.selected = i + d;
    update();
  }
  function expand(i) {
    const m = g.moveById[state.strip[i]];
    state.strip.splice(i, 1, ...m.sequence);
    state.selected = null;
    update();
  }

  // ------------------------------------------------------------ map
  function renderMap(result) {
    if (!mapLayout) return;
    const path = result.items.filter((it) => !it.broken && it.from).map((it) => ({ from: it.from, to: it.to }));
    if (!path.length) path.push({ from: state.startPos, to: state.startPos });
    $('map').innerHTML = PM.mapSVG(g, mapLayout, { selected: state.mapSelected, path });
    renderMapInfo(result);
  }

  function renderMapInfo(result) {
    const box = $('map-info');
    const id = state.mapSelected;
    if (!id || !g.posById[id]) {
      box.replaceChildren(h('p', { class: 'muted' },
        `${g.positions.length} positions, ${g.edges.filter((e) => e.from !== e.to && g.moveById[e.move].kind !== 'compound').length} position-changing connections. ` +
        'Pick a position on the map to see its ways in and out.'));
      return;
    }
    const group = (edges, key) => {
      const by = {};
      for (const e of edges) {
        if (e.from === e.to || g.moveById[e.move].kind === 'compound') continue;
        (by[e[key]] = by[e[key]] || new Set()).add(g.moveById[e.move].name);
      }
      return Object.entries(by).sort((a, b) => posName(a[0]).localeCompare(posName(b[0])));
    };
    const outs = group(g.outgoing[id], 'to');
    const ins = group(g.incoming[id], 'from');
    const loops = [...new Set(g.outgoing[id].filter((e) => e.to === id && g.moveById[e.move].kind !== 'compound').map((e) => g.moveById[e.move].name))].sort();
    const list = (rows, arrow) => rows.length
      ? h('ul', { class: 'map-list' }, rows.map(([pid, names]) => h('li', {},
        h('button', { type: 'button', class: 'link', onclick: () => { state.mapSelected = pid; render(); } }, arrow + ' ' + short(pid)),
        ': ', [...names].sort().join(', '))))
      : h('p', { class: 'muted' }, 'None yet.');
    const bridges = result.end !== id ? MG.findBridges(g, result.end, id, { limit: 3, maxLevel: state.maxLevel }) : [];
    box.replaceChildren(h('div', {},
      h('div', { class: 'panel-head' }, h('h3', {}, posName(id)),
        h('button', { type: 'button', class: 'ghost', onclick: () => { state.mapSelected = null; render(); } }, 'Close')),
      sketchFigure(id, 'Leader view'),
      h('div', { class: 'actions' },
        h('button', {
          type: 'button',
          onclick: () => { state.startPos = id; state.strip = []; state.selected = null; $('start-pos').value = id; update(); },
        }, 'Start a new combo here'),
        result.end === id ? h('span', { class: 'muted' }, 'Your combo ends here.') : null),
      bridges.length ? [h('h4', {}, `Get here from the end of your combo (${short(result.end)})`),
        h('ul', { class: 'options' }, bridges.map((pathIds) => h('li', {}, h('button', {
          type: 'button',
          onclick: () => { state.strip.push(...pathIds); state.selected = null; update(); },
        }, h('span', {}, pathIds.map((m) => g.moveById[m].name).join(' › ')),
          h('span', { class: 'to' }, `+${pathIds.length}`)))))] : null,
      h('h4', {}, `Ways out (${outs.reduce((n, [, s]) => n + s.size, 0)})`), list(outs, '→'),
      h('h4', {}, `Ways in (${ins.reduce((n, [, s]) => n + s.size, 0)})`), list(ins, '←'),
      loops.length ? [h('h4', {}, `In place (${loops.length})`), h('p', { class: 'small' }, loops.join(', '))] : null));
  }

  function initMap() {
    const pick = (ev) => {
      const node = ev.target.closest && ev.target.closest('[data-pos]');
      if (!node) return;
      const id = node.getAttribute('data-pos');
      state.mapSelected = state.mapSelected === id ? null : id;
      render();
      if (window.matchMedia('(max-width: 720px)').matches) $('map-info').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    $('map').addEventListener('click', pick);
    $('map').addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(ev); } });
  }

  // ------------------------------------------------------------ reference sections
  function renderPositions() {
    const healthById = Object.fromEntries(g.health.map((x) => [x.id, x]));
    $('positions').replaceChildren(h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Position'), h('th', {}, 'Notation'), h('th', {}, 'Ways in / out'))),
      h('tbody', {}, g.positions.map((p) => {
        const hl = healthById[p.id];
        const thumb = h('div', { class: 'thumb' });
        thumb.innerHTML = SK ? SK.sketchSVG(p) : '';
        return h('tr', {},
          h('td', {}, thumb),
          h('td', {}, h('button', { type: 'button', class: 'link', onclick: () => { state.mapSelected = p.id; render(); document.querySelector('.map-section').scrollIntoView({ behavior: 'smooth' }); } }, p.name),
            h('br'), h('code', { class: 'muted' }, p.id), h('br'), h('span', { class: 'muted small' }, SK ? SK.describe(p) : '')),
          h('td', {}, h('code', {}, MG.notation(p))),
          h('td', { class: hl.thin ? 'flag' : '' }, `${hl.in} / ${hl.out}`));
      })))),
    h('p', { class: 'muted small' }, 'Notation: FEO facing each other · SHD shadow (leader behind) · SBS-R/L side by side, follower on the right/left · ' +
      'open / semi / closed / apart = distance · L>R leader\'s left holds follower\'s right · R>back leader\'s right hand on her back · ' +
      'cross R/L = leader\'s right hand on top.'),
    h('p', { class: 'muted small' }, 'Ways in/out count distinct moves that change position. Aim for at least 3 each. Click a name to see it on the map.'));
  }

  function compoundYaml(c) {
    return `- id: ${c.id}\n  name: ${JSON.stringify(c.name)}\n  kind: compound\n  sequence: [${c.sequence.join(', ')}]\n`;
  }

  function moveYaml(m) {
    return `- id: ${m.id}\n  name: ${JSON.stringify(m.name)}\n  kind: ${m.kind}\n  level: ${m.level}\n` +
      `  from: [${m.from.join(', ')}]\n  to: ${m.to}\n  counts: ${m.counts}\n` +
      (m.notes ? `  notes: ${JSON.stringify(m.notes)}\n` : '');
  }

  function copyButton(label, text) {
    return h('button', {
      type: 'button',
      onclick: (ev) => {
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
          .then(() => { ev.target.textContent = 'Copied'; }, () => { ev.target.textContent = 'Copy failed: select the text above'; });
      },
    }, label);
  }

  function renderMyMoves() {
    const box = $('my-moves');
    if (!myMoves.length) { box.replaceChildren(); return; }
    const broken = myMoves.filter((m) => myErrors[m.id]);
    box.replaceChildren(h('div', {},
      h('h3', {}, `Your moves (${myMoves.length})`),
      broken.length ? h('div', { class: 'errors' }, broken.map((m) => myErrors[m.id].join('\n')).join('\n')) : null,
      h('pre', {}, myMoves.map(moveYaml).join('\n')),
      h('div', { class: 'actions' },
        copyButton('Copy YAML', myMoves.map(moveYaml).join('\n')),
        myMoves.map((m) => h('button', {
          type: 'button',
          class: 'ghost',
          onclick: () => {
            if (myCompounds.some((c) => c.sequence.includes(m.id)) && !confirm(`"${m.name}" is used in a compound move, which will break. Delete anyway?`)) return;
            myMoves = myMoves.filter((x) => x.id !== m.id);
            store.set('bmc.moves', myMoves);
            recompile();
            render();
          },
        }, `Delete "${m.name}"`)))));
  }

  // ------------------------------------------------------------ move library
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
    const list = (ids) => ids.map(short).join(', ');
    box.replaceChildren(
      h('p', { class: 'muted small' }, `${rows.length} of ${g.moves.length} moves` +
        (state.maxLevel < 3 ? ` (level filter: up to ${LEVEL_NAME[state.maxLevel]})` : '') + '. “Add” appears when a move can follow the end of your combo.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'lib' },
        h('thead', {}, h('tr', {}, ['Move', 'Starts in', 'Ends in', 'Counts', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, rows.map(({ m, ep }) => h('tr', {},
          h('td', {}, h('strong', {}, m.name), ' ', badge(m.kind), ' ', dots(m.level),
            m.check ? h('span', { class: 'flag', title: m.check }, ' ⚑') : null,
            m.notes ? [h('br'), h('span', { class: 'muted small' }, m.notes)] : null),
          h('td', { class: 'small' }, ep.all ? 'any position' : list(ep.froms)),
          h('td', { class: 'small' }, ep.tos ? list(ep.tos) : '↺ same'),
          h('td', {}, String(m.counts)),
          h('td', {}, fitsEnd(m.id) ? h('button', {
            type: 'button',
            onclick: () => { state.strip.push(m.id); state.selected = null; update(); },
          }, 'Add') : null)))))));
  }

  function initLibrary() {
    const rerender = () => render();
    $('lib-search').addEventListener('input', rerender);
    $('lib-kind').addEventListener('change', rerender);
    $('lib-check').addEventListener('change', rerender);
    $('library-section').addEventListener('toggle', rerender);
  }

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
      myMoves.push(move);
      store.set('bmc.moves', myMoves);
      recompile();
      render();
      form.reset();
      fromBox.querySelectorAll('input').forEach((i) => { i.checked = false; });
      syncKind();
      status.className = 'small';
      status.textContent = `Saved "${name}". It now appears under "what can follow" for ${from.map(short).join(', ')}.`;
    });
  }

  function renderCompounds() {
    const box = $('compounds');
    if (!myCompounds.length) {
      box.replaceChildren(h('p', { class: 'muted' },
        'Build a combo without breaks, then use "Save as compound". Saved compounds live in this browser; ' +
        'copy their YAML into data/moves.yaml to keep them for good.'));
      return;
    }
    const broken = Object.entries(myErrors);
    box.replaceChildren(
      broken.length ? h('div', { class: 'errors' },
        'Broken compound moves (a part changed or was removed):\n' + broken.map(([, errs]) => errs.join('\n')).join('\n')) : '',
      h('pre', {}, myCompounds.map(compoundYaml).join('\n')),
      h('div', { class: 'actions' },
        h('button', {
          type: 'button',
          onclick: (ev) => {
            const text = myCompounds.map(compoundYaml).join('\n');
            (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
              .then(() => { ev.target.textContent = 'Copied'; }, () => { ev.target.textContent = 'Copy failed: select the text above'; });
          },
        }, 'Copy YAML'),
        myCompounds.map((c) => h('button', {
          type: 'button',
          class: 'ghost',
          onclick: () => { myCompounds = myCompounds.filter((x) => x.id !== c.id); store.set('bmc.compounds', myCompounds); recompile(); render(); },
        }, `Delete "${c.name}"`))));
  }

  // ------------------------------------------------------------ toolbar
  function initToolbar() {
    const sel = $('start-pos');
    for (const p of g.positions) sel.append(h('option', { value: p.id }, p.name));
    sel.value = state.startPos;
    sel.addEventListener('change', () => { state.startPos = sel.value; update(); });

    const lv = $('max-level');
    lv.value = String(state.maxLevel);
    lv.addEventListener('change', () => { state.maxLevel = Number(lv.value); store.set('bmc.maxLevel', state.maxLevel); render(); });

    const ws = $('start-weight');
    ws.value = state.startWeight;
    ws.addEventListener('change', () => { state.startWeight = ws.value; update(); });

    $('btn-undo').addEventListener('click', undo);
    $('btn-practice').addEventListener('click', () => {
      const result = MG.evaluateStrip(g, state.startPos, state.startWeight, state.strip);
      if (!result.items.length) return alert('Add some moves first.');
      if (result.items.some((it) => it.broken)) return alert('Fix the breaks first (click a red "bridge").');
      window.Practice.open(result.items, { posName, sketchSVG: SK.sketchSVG, positions: g.posById });
    });
    $('btn-text').addEventListener('click', (ev) => {
      const result = MG.evaluateStrip(g, state.startPos, state.startWeight, state.strip);
      if (!result.items.length) return;
      const parts = result.items.filter((it) => it.move).map((it) => `${it.move.name} (${it.move.counts ? it.move.counts : 'on the fly'})`);
      const text = `Bachata combo, starting in ${posName(state.startPos)}:\n${parts.join(' › ')}\n` +
        `${result.totalCounts} counts, ends in ${posName(result.end)}.\n${location.href.split('#')[0] + shareHash()}`;
      const done = (msg) => { ev.target.textContent = msg; setTimeout(() => { ev.target.textContent = 'Copy as text'; }, 1800); };
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
        .then(() => done('Copied'), () => { prompt('Copy this text:', text); });
    });
    $('btn-share').addEventListener('click', (ev) => {
      const url = location.href.split('#')[0] + shareHash();
      const done = (msg) => { ev.target.textContent = msg; setTimeout(() => { ev.target.textContent = 'Share link'; }, 1800); };
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
        .then(() => done('Link copied'), () => { prompt('Copy this link:', url); });
    });
    document.addEventListener('keydown', (ev) => {
      if (document.querySelector('dialog[open]')) return;
      const tag = (ev.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); undo(); return; }
      if (ev.key === 'Escape') select(null);
      else if (ev.key === 'ArrowLeft' && state.strip.length) select(state.selected === null ? state.strip.length - 1 : Math.max(0, state.selected - 1));
      else if (ev.key === 'ArrowRight' && state.selected !== null) select(state.selected + 1 < state.strip.length ? state.selected + 1 : null);
      else if ((ev.key === 'Delete' || ev.key === 'Backspace') && state.selected !== null) { ev.preventDefault(); removeAt(state.selected); }
    });
    window.addEventListener('hashchange', () => {
      const next = fromHash();
      if (!next) return;
      if (next.custom && next.custom.length) { importShared(next.custom); recompile(); }
      Object.assign(state, { startPos: next.startPos || state.startPos, startWeight: next.startWeight || state.startWeight, strip: next.strip.filter((id) => g.moveById[id]) });
      sel.value = state.startPos;
      ws.value = state.startWeight;
      state.selected = null;
      update();
    });

    $('btn-clear').addEventListener('click', () => { state.strip = []; state.selected = null; update(); });
    $('btn-random').addEventListener('click', () => {
      state.strip = MG.randomCombo(g, state.startPos, { steps: 4, maxLevel: state.maxLevel });
      state.selected = null;
      update();
    });
    $('btn-save').addEventListener('click', () => {
      const result = MG.evaluateStrip(g, state.startPos, state.startWeight, state.strip);
      if (state.strip.length < 2) return alert('Add at least two dominoes first.');
      if (result.items.some((it) => it.broken)) return alert('Fix the breaks first (click a red "bridge").');
      const name = prompt('Name for this compound move:');
      if (!name) return;
      const base = 'my-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let id = base || 'my-compound';
      for (let n = 2; g.moveById[id]; n++) id = `${base}-${n}`;
      myCompounds.push({ id, name, kind: 'compound', sequence: [...state.strip] });
      store.set('bmc.compounds', myCompounds);
      recompile();
      state.strip = [id];
      state.selected = 0;
      update();
      document.querySelector('details.ref:last-of-type').open = true;
    });
  }

  // Offline support where service workers are allowed (https or localhost, not file://).
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }

  recompile();
  initToolbar();
  initMap();
  initMoveForm();
  initLibrary();
  lastSnap = snapshot();
  persist();
  render();
})();
