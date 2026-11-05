/*
 * The move review page: every move in a group that says how to look at it.
 * Simple groups (in place, let go / catch) are tables; turns and paths get a filmstrip of the
 * animation. Marks (✓ / ✗ and a note) are kept in this browser; "Copy my notes" lists the ✗ ones.
 */
(function () {
  'use strict';
  const MG = window.MoveGraph;
  const Motion = window.Motion;
  const Rev = window.MoveReview;
  const g = MG.compile(window.BACHATA_DATA);
  const groups = Rev.classify(g, Motion, window.MoveMirror.mirrorMoves(g, Motion));

  const KEY = 'bmc-review-v1';
  let marks = {};
  try { marks = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { marks = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(marks)); } catch (e) { /* private window: marks last until reload */ } };

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v);
    }
    for (const kid of kids.flat(Infinity)) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }

  const posName = (id) => { const p = g.posById[id]; return p ? p.short || p.name : id; };
  const dots = (level) => '●'.repeat(level) + '○'.repeat(3 - level);
  const meta = (m) => `${m.kind} · ${dots(m.level || 1)} · ${m.counts ? m.counts + ' counts' : 'on the fly'}${m.on ? ' · usually on ' + m.on : ''}`;

  /** Name, kind, notes and the check flag: the first column of every table. */
  function nameCell(m) {
    return h('td', {},
      h('div', { class: 'rv-name' }, m.name),
      h('div', { class: 'rv-meta' }, meta(m)),
      m.notes ? h('div', { class: 'rv-notes' }, m.notes) : null,
      m.check ? h('div', { class: 'rv-check' }, '⚑ check: ' + m.check) : null);
  }

  // ---- the filmstrip ------------------------------------------------------------------------------------
  const FRAMES = [0, 0.2, 0.4, 0.6, 0.8, 1];
  function strip(move, edge) {
    const A = g.posById[edge.from], B = g.posById[edge.to];
    const bounds = Motion.movieBounds(move, A, B);
    return h('div', {},
      h('div', { class: 'rv-label' }, `${posName(edge.from)} → ${edge.from === edge.to ? 'same position' : posName(edge.to)}`),
      h('div', { class: 'rv-strip' }, FRAMES.map((t) => {
        const art = h('div');
        art.innerHTML = Motion.frameSVG(move, A, B, t, bounds);
        return h('div', { class: 'rv-frame' }, art, h('div', { class: 'rv-t' }, Math.round(t * 100) + '%'));
      })));
  }

  /** The first start's filmstrip, and the others (if any) in a fold-out that draws them when opened. */
  function strips(item) {
    const [first, ...rest] = item.edges;
    const out = [first ? strip(item.move, first) : null];
    if (rest.length) {
      const more = h('details', { class: 'rv-more' }, h('summary', {}, `also from ${rest.length} other position${rest.length > 1 ? 's' : ''}`));
      let drawn = false;
      more.addEventListener('toggle', () => {
        if (!more.open || drawn) return;
        drawn = true;
        for (const e of rest) more.append(strip(item.move, e));
      });
      out.push(more);
    }
    return out;
  }

  /** A warning when the animation turns someone by a different amount than the reading says. */
  function mismatch(it) {
    const r = it.turn, shown = it.shown;
    if (!shown || r.who === 'couple') return null;
    if (Math.abs((shown[r.who] || 0) - r.degrees) <= 10) return null;
    if (r.who === 'leader' && !shown.leader) return h('span', { class: 'rv-info' }, ' · his turn is drawn as her going round him (the picture stays in his view)');
    return h('span', { class: 'rv-warn' }, ` ⚠ differs from the reading (${r.degrees}°): the start and end positions decide how far she can turn`);
  }

  // ---- hands in words ---------------------------------------------------------------------------------
  function changeList(c) {
    const items = [];
    for (const t of c.lets) items.push(h('li', { class: 'lets' }, 'lets go: ' + t));
    for (const t of c.takes) items.push(h('li', {}, 'takes: ' + t));
    for (const t of c.keeps) items.push(h('li', { class: 'keeps' }, 'keeps: ' + t));
    for (const t of c.other) items.push(h('li', {}, t));
    return items.length ? h('ul', {}, items) : h('span', { class: 'rv-meta' }, '(no change)');
  }

  function edgeChanges(item) {
    const shown = item.edges.slice(0, 4), rest = item.edges.slice(4);
    const one = (e) => h('div', {},
      h('div', { class: 'rv-label' }, `${posName(e.from)} → ${e.from === e.to ? 'same position' : posName(e.to)}`),
      changeList(Rev.holdChange(g.posById[e.from], g.posById[e.to])));
    return [shown.map(one), rest.length ? h('details', { class: 'rv-more' }, h('summary', {}, `${rest.length} more start${rest.length > 1 ? 's' : ''}`), rest.map(one)) : null];
  }

  // ---- marks --------------------------------------------------------------------------------------------
  const sections = [];

  /** A move that has mirror images passes its mark on to them (they animate as exact mirror images). */
  function share(item) {
    for (const t of item.twinItems || []) {
      const m = marks[item.move.id];
      if (m && m.s) marks[t.move.id] = { ...m }; else delete marks[t.move.id];
      t.paint();
    }
  }

  function markCell(item, tr) {
    const id = item.move.id;
    const ok = h('button', { type: 'button', title: 'Right', 'aria-label': 'Right: ' + item.move.name }, '✓');
    const bad = h('button', { type: 'button', title: 'Wrong', 'aria-label': 'Wrong: ' + item.move.name }, '✗');
    const note = h('input', { type: 'text', placeholder: 'What is wrong?', 'aria-label': 'Note for ' + item.move.name });
    function paint() {
      const m = marks[id] || {};
      ok.className = m.s === 'ok' ? 'on-ok' : '';
      bad.className = m.s === 'wrong' ? 'on-wrong' : '';
      tr.className = m.s === 'ok' ? 'rv-ok' : m.s === 'wrong' ? 'rv-wrong' : '';
      note.hidden = m.s !== 'wrong';
      note.value = m.note || '';
    }
    const set = (s) => { marks[id] = marks[id] && marks[id].s === s ? {} : { ...(marks[id] || {}), s }; share(item); save(); paint(); updateCounts(); };
    ok.addEventListener('click', () => set('ok'));
    bad.addEventListener('click', () => { set('wrong'); if (marks[id].s === 'wrong') note.focus(); });
    note.addEventListener('input', () => { marks[id] = { ...(marks[id] || {}), s: 'wrong', note: note.value }; share(item); save(); });
    item.paint = paint;
    paint();
    return h('td', { class: 'rv-mark' }, ok, ' ', bad, note);
  }

  function updateCounts() {
    let ok = 0, wrong = 0, total = 0;
    for (const s of sections) {
      const done = s.items.filter((it) => (marks[it.move.id] || {}).s).length;
      s.count.textContent = `${done} of ${s.items.length} checked`;
      total += s.items.length;
      for (const it of s.items) { const m = (marks[it.move.id] || {}).s; if (m === 'ok') ok++; else if (m === 'wrong') wrong++; }
    }
    document.getElementById('rv-progress').textContent = `${ok + wrong} of ${total} checked · ${ok} right · ${wrong} wrong`;
  }

  // ---- sections -----------------------------------------------------------------------------------------
  function section({ id, title, help, head, items, cells, open }) {
    const count = h('span', { class: 'rv-count' });
    const body = h('tbody');
    const byId = new Map(items.map((it) => [it.move.id, it]));
    const primaries = items.filter((it) => !it.mirrorOf), twins = items.filter((it) => it.mirrorOf);
    for (const it of primaries) it.twinItems = (it.mirrors || []).map((id) => byId.get(id));
    const markAll = h('button', { type: 'button', class: 'ghost', onclick: () => {
      for (const it of primaries) if (!(marks[it.move.id] || {}).s) { marks[it.move.id] = { s: 'ok' }; share(it); }
      save(); items.forEach((it) => it.paint()); updateCounts();
    } }, 'Mark the unchecked ones ✓');
    for (const item of primaries) {
      const tr = h('tr');
      tr.append(nameCell(item.move), ...cells(item), markCell(item, tr));
      body.append(tr);
    }
    // Mirror images: covered by the move they mirror, shown here only so nothing seems missing.
    const mirrorBody = h('tbody');
    for (const item of twins) {
      const tr = h('tr');
      const status = h('td', { class: 'rv-status' });
      item.paint = () => {
        const m = marks[item.move.id] || {};
        tr.className = m.s === 'ok' ? 'rv-ok' : m.s === 'wrong' ? 'rv-wrong' : '';
        status.textContent = m.s === 'ok' ? '✓ right' : m.s === 'wrong' ? '✗ wrong' : 'not checked';
      };
      item.paint();
      tr.append(nameCell(item.move), h('td', {}, 'mirror image of ', h('strong', {}, byId.get(item.mirrorOf).move.name)), status);
      mirrorBody.append(tr);
    }
    const el = h('details', { class: 'rv-section', id: 'sec-' + id, open: open ? '' : null },
      h('summary', {}, title, count),
      h('p', { class: 'rv-help' }, help),
      h('div', { class: 'rv-tools' }, markAll),
      h('div', { class: 'table-wrap' }, h('table', { class: 'rv' }, h('thead', {}, h('tr', {}, head.map((t) => h('th', {}, t)))), body)),
      twins.length ? h('details', { class: 'rv-more rv-mirrors' },
        h('summary', {}, `${twins.length} more move${twins.length > 1 ? 's are' : ' is'} the mirror image of one above (left and right swapped): your mark above covers ${twins.length > 1 ? 'them' : 'it'}`),
        h('div', { class: 'table-wrap' }, h('table', { class: 'rv rv-mirror' }, h('thead', {}, h('tr', {}, ['Move', 'Covered by', 'Mark'].map((t) => h('th', {}, t)))), mirrorBody))) : null);
    sections.push({ id, title, items, count });
    return el;
  }

  const main = document.getElementById('rv-main');
  const guessed = groups.turns.filter((it) => it.turn.source !== 'data').length;

  main.append(
    section({
      id: 'turns', title: 'Turns', open: true, items: groups.turns,
      help: `Check the direction and size of the turn in the reading, then look at the pictures (start, then every 20% of the move). ` +
        `The first ${guessed} had their direction read from the move's name or note: those are the ones most likely to be wrong.`,
      head: ['Move', 'What the animation does', 'Right?'],
      cells: (it) => [h('td', {},
        h('div', { class: 'rv-reading' }, 'Read: ' + it.turn.text),
        h('div', { class: 'rv-shown' }, 'The animation shows: ' + Rev.shownText(it.shown), mismatch(it)),
        strips(it))],
    }),
    section({
      id: 'letgo', title: 'Letting go and catching', open: true, items: groups.letgo,
      help: 'Moves where a hand lets go or takes hold, nothing else. Check the hands: which one lets go, which one takes hold, and what it holds.',
      head: ['Move', 'What happens to the hands', 'Right?'],
      cells: (it) => [h('td', {}, edgeChanges(it))],
    }),
    section({
      id: 'inplace', title: 'In place (the hands stay)', open: true, items: groups.inplace,
      help: 'Styling that keeps the position. Check that it makes sense in every position listed.',
      head: ['Move', 'Works in', 'Right?'],
      cells: (it) => [h('td', {}, it.starts.map(posName).join(' · '))],
    }),
    section({
      id: 'path', title: 'Position changes without a turn', open: true, items: groups.path,
      help: 'Steps and walks that end in a different position. Check the path in the pictures and the hands.',
      head: ['Move', 'What the animation does', 'Right?'],
      cells: (it) => [h('td', {}, strips(it), h('div', { class: 'rv-label' }, 'hands'), changeList(Rev.holdChange(g.posById[it.edges[0].from], g.posById[it.edges[0].to])))],
    }));
  if (groups.combos.length) {
    main.append(h('p', { class: 'rv-help' }, `${groups.combos.length} combo blocks (${groups.combos.map((c) => c.move.name).join(', ')}) play the moves they are made of, so they need no review of their own.`));
  }

  // ---- notes to copy ------------------------------------------------------------------------------------
  function notesText() {
    const lines = [];
    let ok = 0, unchecked = 0;
    for (const s of sections) {
      for (const it of s.items) {
        const m = marks[it.move.id] || {};
        if (m.s === 'ok') ok++;
        else if (m.s === 'wrong') {
          if (it.mirrorOf) continue;                                   // listed with the move it mirrors
          const twins = (it.twinItems || []).map((t) => t.move.name);
          lines.push(`- [${s.title}] ${it.move.name} (${it.move.id})${m.note ? ': ' + m.note : ''}${twins.length ? `  [its mirror image too: ${twins.join(', ')}]` : ''}`);
        } else unchecked++;
      }
    }
    return `Move review: ${lines.length} wrong, ${ok} right, ${unchecked} not checked yet\n` + (lines.length ? '\nWrong:\n' + lines.join('\n') : '');
  }

  const text = document.getElementById('rv-text');
  document.getElementById('rv-copy').addEventListener('click', () => {
    text.value = notesText();
    text.hidden = false;
    text.select();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text.value).catch(() => {});
  });
  document.getElementById('rv-reset').addEventListener('click', () => {
    if (!window.confirm('Clear every ✓ and ✗ and note on this page?')) return;
    marks = {}; save(); sections.forEach((s) => s.items.forEach((it) => it.paint())); updateCounts(); text.hidden = true;
  });

  updateCounts();
})();
