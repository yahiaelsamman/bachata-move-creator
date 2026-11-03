/* Domino-strip UI. Depends on window.BACHATA_DATA (data.js) and window.MoveGraph (graph.js). */
(function () {
  'use strict';
  const MG = window.MoveGraph;
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

  const saved = store.get('bmc.state', {});
  const state = {
    startPos: saved.startPos || 'open_LR',
    startWeight: saved.startWeight || 'mirrored',
    strip: Array.isArray(saved.strip) ? saved.strip : [],
    selected: null, // index into strip, or null = "what comes next"
    kindFilter: 'all',
    search: '',
  };
  let myCompounds = store.get('bmc.compounds', []);
  let g;

  function recompile() {
    g = MG.compile({ positions: BASE.positions, moves: [...BASE.moves, ...myCompounds] });
    if (!g.posById[state.startPos]) state.startPos = BASE.positions[0].id;
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
  const $ = (id) => document.getElementById(id);

  function persist() {
    store.set('bmc.state', { startPos: state.startPos, startWeight: state.startWeight, strip: state.strip });
  }

  function update() {
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
    renderPositions();
    renderCompounds();
  }

  function renderErrors() {
    const box = $('errors');
    box.hidden = g.errors.length === 0;
    box.textContent = g.errors.length ? 'Data problems:\n' + g.errors.join('\n') : '';
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

    strip.append(h('span', { class: 'joint', 'aria-hidden': 'true' }, '›'));
    strip.append(h('button', {
      type: 'button',
      class: 'domino add' + (state.selected === null ? ' selected' : ''),
      onclick: () => select(null),
    }, '+ next move'));

    const warnings = result.items.filter((it) => it.timingWarn || it.weightWarn).length;
    const breaks = result.items.filter((it) => it.broken).length;
    $('summary').textContent = state.strip.length
      ? `${state.strip.length} dominoes · ${result.totalCounts} counts (${(result.totalCounts / 8).toFixed(1)} × 8) · ` +
        `ends in ${posName(result.end)}, ${result.weight} weight` +
        (breaks ? ` · ${breaks} break${breaks > 1 ? 's' : ''}` : '') +
        (warnings ? ` · ${warnings} soft warning${warnings > 1 ? 's' : ''}` : '')
      : 'Empty combo. Pick a start position, then add moves below.';
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
      h('div', { class: 'meta' }, `${m.counts} ct · beat ${it.beat}`, flags));
  }

  function select(i) {
    state.selected = i;
    state.search = '';
    render();
  }

  // ------------------------------------------------------------ panel
  function renderPanel(result) {
    const panel = $('panel');
    panel.replaceChildren();
    if (state.selected === null) panel.append(nextPanel(result.end));
    else panel.append(detailPanel(result.items[state.selected], state.selected, result));
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
      return !state.search || m.name.toLowerCase().includes(state.search.toLowerCase());
    });
    const search = h('input', {
      class: 'search', type: 'search', placeholder: 'Filter moves…', value: state.search,
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
            h('span', { class: 'to' }, e.to === e.from ? '↺ same' : '→ ' + short(e.to), ` · ${m.counts} ct`)));
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
      const bridges = it.from ? MG.findBridges(g, it.expected, it.from) : [];
      wrap.append(h('h2', {}, `Bridge: ${posName(it.expected)} → ${posName(it.from)}`),
        bridges.length
          ? h('ul', { class: 'options' }, bridges.map((path) => h('li', {}, h('button', {
            type: 'button',
            onclick: () => { state.strip.splice(i, 0, ...path); state.selected = null; update(); },
          }, h('span', {}, path.map((id) => g.moveById[id].name).join(' › ')),
            h('span', { class: 'to' }, `${path.length} step${path.length > 1 ? 's' : ''}`)))))
          : h('p', { class: 'muted' }, 'No bridge within 3 moves. Remove this domino or add an adjuster to the data.'));
    } else {
      const alts = MG.alternatives(g, it.from, it.to, m.id);
      wrap.append(h('h2', {}, `Replace with (same start and end)`),
        alts.length
          ? h('ul', { class: 'options' }, alts.map((id) => h('li', {}, h('button', {
            type: 'button',
            onclick: () => { state.strip[i] = id; update(); },
          }, h('span', {}, g.moveById[id].name, ' ', badge(g.moveById[id].kind)),
            h('span', { class: 'to' }, `${g.moveById[id].counts} ct`)))))
          : h('p', { class: 'muted' }, 'No alternatives yet.'));
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

  // ------------------------------------------------------------ reference sections
  function renderPositions() {
    const healthById = Object.fromEntries(g.health.map((x) => [x.id, x]));
    $('positions').replaceChildren(h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Position'), h('th', {}, 'Notation'), h('th', {}, 'Ways in / out'))),
      h('tbody', {}, g.positions.map((p) => {
        const hl = healthById[p.id];
        return h('tr', {},
          h('td', {}, p.name, h('br'), h('code', { class: 'muted' }, p.id)),
          h('td', {}, h('code', {}, MG.notation(p))),
          h('td', { class: hl.thin ? 'flag' : '' }, `${hl.in} / ${hl.out}`));
      })))),
    h('p', { class: 'muted' }, 'Ways in/out count distinct moves that change position. Aim for at least 3 each.'));
  }

  function compoundYaml(c) {
    return `- id: ${c.id}\n  name: ${c.name}\n  kind: compound\n  sequence: [${c.sequence.join(', ')}]\n`;
  }

  function renderCompounds() {
    const box = $('compounds');
    if (!myCompounds.length) {
      box.replaceChildren(h('p', { class: 'muted' },
        'Build a combo without breaks, then use "Save as compound". Saved compounds live in this browser; ' +
        'copy their YAML into data/moves.yaml to keep them for good.'));
      return;
    }
    box.replaceChildren(
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

    const ws = $('start-weight');
    ws.value = state.startWeight;
    ws.addEventListener('change', () => { state.startWeight = ws.value; update(); });

    $('btn-clear').addEventListener('click', () => { state.strip = []; state.selected = null; update(); });
    $('btn-random').addEventListener('click', () => {
      state.strip = MG.randomWalk(g, state.startPos, 5);
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

  recompile();
  initToolbar();
  render();
})();
