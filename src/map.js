/*
 * Position map: every position as a node, moves between positions as arrows.
 * Styling moves (start = end) are not drawn as arrows; they show as a ↺ count.
 *
 *   layoutMap(g)              -> { nodes: {id: {x, y, w}}, links: [...] }  (deterministic)
 *   mapSVG(g, layout, opts)   -> SVG markup string
 *     opts.selected  position id to focus (its ways in and out light up)
 *     opts.path      [{from, to}] steps of the current combo, drawn as a path
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./graph.js'));
  else root.PositionMap = factory(root.MoveGraph);
})(typeof self !== 'undefined' ? self : this, function (MG) {
  'use strict';

  const W = 760;
  const H = 520;
  const PAD = 70;

  /** Group parallel edges into one link per ordered pair of positions. */
  function linksOf(g) {
    const byPair = new Map();
    for (const e of g.edges) {
      if (!MG.isTransition(g, e)) continue;
      const key = e.from + '>' + e.to;
      if (!byPair.has(key)) byPair.set(key, { from: e.from, to: e.to, moves: [] });
      byPair.get(key).moves.push(e.move);
    }
    const links = [...byPair.values()];
    for (const l of links) l.twoWay = byPair.has(l.to + '>' + l.from);
    return links;
  }

  /** Links into a no-contact position (e.g. "release all" from everywhere) would clutter the map. */
  function isHubLink(g, l) {
    return g.posById[l.to].frame === 'apart';
  }

  /** Small force-directed layout, deterministic for the same data. */
  function layoutMap(g, { iterations = 600 } = {}) {
    const ids = g.positions.map((p) => p.id);
    const n = ids.length;
    const pos = {};
    ids.forEach((id, i) => {
      const a = (2 * Math.PI * i) / n;
      pos[id] = { x: Math.cos(a) * 200, y: Math.sin(a) * 160 };
    });
    const links = linksOf(g);
    const pairs = new Map();
    for (const l of links) {
      if (isHubLink(g, l)) continue;
      const key = [l.from, l.to].sort().join('|');
      pairs.set(key, (pairs.get(key) || 0) + l.moves.length);
    }
    for (let it = 0; it < iterations; it++) {
      const t = 1 - it / iterations;
      const force = Object.fromEntries(ids.map((id) => [id, { x: 0, y: 0 }]));
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = pos[ids[i]], b = pos[ids[j]];
          let dx = a.x - b.x, dy = a.y - b.y;
          const d2 = Math.max(dx * dx + dy * dy, 25);
          const f = 12000 / d2;
          const d = Math.sqrt(d2);
          dx /= d; dy /= d;
          force[ids[i]].x += dx * f; force[ids[i]].y += dy * f;
          force[ids[j]].x -= dx * f; force[ids[j]].y -= dy * f;
        }
      }
      for (const [key, weight] of pairs) {
        const [ia, ib] = key.split('|');
        const a = pos[ia], b = pos[ib];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.max(Math.hypot(dx, dy), 1);
        const f = (d - 120) * 0.03 * Math.min(1 + weight * 0.15, 2);
        force[ia].x += (dx / d) * f; force[ia].y += (dy / d) * f;
        force[ib].x -= (dx / d) * f; force[ib].y -= (dy / d) * f;
      }
      for (const id of ids) {
        force[id].x -= pos[id].x * 0.02;
        force[id].y -= pos[id].y * 0.03;
        const step = 0.6 * t + 0.05;
        pos[id].x += Math.max(-30, Math.min(30, force[id].x * step));
        pos[id].y += Math.max(-30, Math.min(30, force[id].y * step));
      }
    }
    // Fit into the drawing area.
    const xs = ids.map((id) => pos[id].x), ys = ids.map((id) => pos[id].y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const sx = (W - 2 * PAD) / Math.max(maxX - minX, 1);
    const sy = (H - 2 * PAD) / Math.max(maxY - minY, 1);
    const nodes = {};
    for (const p of g.positions) {
      const label = p.short || p.name;
      nodes[p.id] = {
        x: PAD + (pos[p.id].x - minX) * sx,
        y: PAD + (pos[p.id].y - minY) * sy,
        w: Math.max(56, label.length * 7.2 + 18),
        label,
        loops: MG.loopMoves(g, p.id).length,
      };
    }
    return { nodes, links, width: W, height: H };
  }

  const r1 = (v) => Math.round(v * 10) / 10;
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  /** Point where the segment from the node centre towards (tx, ty) leaves the node's box. */
  function boxExit(node, tx, ty) {
    const dx = tx - node.x, dy = ty - node.y;
    const hw = node.w / 2 + 4, hh = 15;
    const s = Math.min(hw / Math.max(Math.abs(dx), 1e-6), hh / Math.max(Math.abs(dy), 1e-6));
    return [node.x + dx * s, node.y + dy * s];
  }

  /**
   * One position and its direct neighbours: the position in the middle, the others in a circle.
   * Readable on a phone, and tapping a neighbour re-centres on it.
   */
  function layoutFocus(g, full, centerId) {
    const W = 400, H = 400;
    const links = full.links.filter((l) => (l.from === centerId || l.to === centerId) && !isHubLink(g, l));
    const around = [...new Set(links.flatMap((l) => [l.from, l.to]))].filter((id) => id !== centerId).sort();
    const node = (id, x, y) => {
      const label = full.nodes[id].label;
      return { ...full.nodes[id], x, y, w: Math.max(60, label.length * 8.4 + 20) };
    };
    const nodes = { [centerId]: node(centerId, W / 2, H / 2) };
    around.forEach((id, i) => {
      const a = (2 * Math.PI * i) / around.length - Math.PI / 2;
      nodes[id] = node(id, W / 2 + Math.cos(a) * 135, H / 2 + Math.sin(a) * 160);
    });
    return { nodes, links, width: W, height: H, focus: true };
  }

  function mapSVG(g, layout, opts = {}) {
    const sel = opts.selected || null;
    const onPath = new Set((opts.path || []).filter((s) => s.from && s.to && s.from !== s.to).map((s) => s.from + '>' + s.to));
    const pathNodes = new Set((opts.path || []).flatMap((s) => [s.from, s.to]).filter(Boolean));

    const linkSvg = layout.links.filter((l) => !isHubLink(g, l) || (sel && (l.from === sel || l.to === sel))).map((l) => {
      const a = layout.nodes[l.from], b = layout.nodes[l.to];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.max(Math.hypot(dx, dy), 1);
      const bend = l.twoWay ? 22 : 0;
      const cx = (a.x + b.x) / 2 + (-dy / d) * bend;
      const cy = (a.y + b.y) / 2 + (dx / d) * bend;
      const [sx, sy] = boxExit(a, cx, cy);
      const [ex, ey] = boxExit(b, cx, cy);
      let cls = 'mp-link';
      let marker = 'mp-a';
      if (onPath.has(l.from + '>' + l.to)) { cls += ' mp-path'; marker = 'mp-a-path'; }
      if (sel) {
        if (l.from === sel) { cls += ' mp-out'; marker = 'mp-a-out'; }
        else if (l.to === sel) { cls += ' mp-in'; marker = 'mp-a-in'; }
        else { cls += ' mp-dim'; marker = 'mp-a'; }
      }
      const names = l.moves.map((id) => g.moveById[id].name).join(', ');
      const width = Math.min(1.2 + l.moves.length * 0.6, 4);
      const pathD = `M${r1(sx)},${r1(sy)} Q${r1(cx)},${r1(cy)} ${r1(ex)},${r1(ey)}`;
      // A wide invisible twin makes the arrow easy to tap.
      return `<g class="mp-hit-wrap" data-link="${esc(l.from)}>${esc(l.to)}"><path d="${pathD}" class="mp-hit"/><path d="${pathD}" class="${cls}" style="stroke-width:${r1(width)}" marker-end="url(#${marker})"/><title>${esc(g.posById[l.from].name)} → ${esc(g.posById[l.to].name)}: ${esc(names)}</title></g>`;
    }).join('\n');

    const nodeSvg = g.positions.filter((p) => layout.nodes[p.id]).map((p) => {
      const nd = layout.nodes[p.id];
      let cls = 'mp-node';
      if (p.id === sel) cls += ' mp-selected';
      if (pathNodes.has(p.id)) cls += ' mp-visited';
      if (sel && p.id !== sel && !layout.links.some((l) => (l.from === sel && l.to === p.id) || (l.to === sel && l.from === p.id))) cls += ' mp-dim';
      return `<g class="${cls}" data-pos="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(p.name)}">
  <title>${esc(p.name)}${nd.loops ? ` (${nd.loops} in-place moves)` : ''}</title>
  <rect x="${r1(nd.x - nd.w / 2)}" y="${r1(nd.y - 14)}" width="${r1(nd.w)}" height="28" rx="14"/>
  <text x="${r1(nd.x)}" y="${r1(nd.y + 4)}" text-anchor="middle">${esc(nd.label)}</text>
  ${nd.loops ? `<text x="${r1(nd.x + nd.w / 2 - 2)}" y="${r1(nd.y - 17)}" text-anchor="end" class="mp-loops">↺${nd.loops}</text>` : ''}
</g>`;
    }).join('\n');

    return `<svg viewBox="0 0 ${layout.width} ${layout.height}" class="posmap${layout.focus ? ' focus' : ''}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map of positions">
<defs>${['mp-a', 'mp-a-path', 'mp-a-out', 'mp-a-in'].map((id) =>
    `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" class="${id}"/></marker>`).join('')}</defs>
${linkSvg}
${nodeSvg}
</svg>`;
  }

  return { layoutMap, layoutFocus, mapSVG, linksOf, isHubLink };
});
