/*
 * Position map: every position as a node, moves between positions as arrows.
 * Styling moves (start = end) are not drawn as arrows; they show as a ↺ count.
 *
 *   layoutMap(g)                    -> { nodes: {id: {x, y, w}}, links: [...] }  (force layout, deterministic)
 *   layoutHub(g, full, centerId)    -> one position in the middle, its neighbours on an inner ring, the rest outside
 *   hubSVG(g, hub, opts)            -> SVG markup of the hub
 *   overviewSVG(g, full, centerId)  -> small SVG of every position (dots and faint links)
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

  /**
   * The hub: one position in the middle, the positions one move away on an inner ring, every other
   * position on an outer ring. Only the middle has lines (spokes), so the picture stays readable.
   * A spoke's style says which kinds of moves link the two positions (in either direction): a solid
   * line for moves, a dotted line for adjusters, both side by side when there are both.
   * Rings keep the order of the force layout around the middle, so neighbours stay roughly where
   * they are on the overview.
   */
  function layoutHub(g, full, centerId, { compact = false } = {}) {
    let W = 700, H = 560, CX = 350, CY = 284;
    const kinds = {};
    for (const e of g.edges) {
      if (!MG.isTransition(g, e) || (e.from !== centerId && e.to !== centerId)) continue;
      const kind = g.moveById[e.move].kind;
      if (kind === 'compound' || kind === 'styling') continue;
      const other = e.from === centerId ? e.to : e.from;
      if (!kinds[other]) kinds[other] = { move: false, adjuster: false, out: false };
      kinds[other][kind === 'adjuster' ? 'adjuster' : 'move'] = true;
      if (e.from === centerId) kinds[other].out = true;
    }
    const c = full.nodes[centerId];
    const angle = (id) => Math.atan2(full.nodes[id].y - c.y, full.nodes[id].x - c.x);
    const byAngle = (a, b) => angle(a) - angle(b) || a.localeCompare(b);
    const near = Object.keys(kinds).sort(byAngle);
    const far = g.positions.map((p) => p.id).filter((id) => id !== centerId && !kinds[id]).sort(byAngle);
    // Crowded inner rings get wider; the outer ring stays outside it.
    const grow = Math.max(1, near.length / 13);
    const r1x = Math.min(135 * grow, 230), r1y = Math.min(120 * grow, 205);
    // Compact (phones): the outer ring is only dots, so it sits just outside the inner ring.
    const r2x = compact ? r1x + 48 : Math.max(255, r1x + 75), r2y = compact ? r1y + 44 : Math.max(222, r1y + 60);
    if (compact) { W = Math.round(2 * r2x + 240); H = Math.round(2 * r2y + 80); CX = W / 2; CY = H / 2; }
    const place = (ids, rx, ry, off) => ids.map((id, i) => {
      const a = -Math.PI / 2 + off + (i * 2 * Math.PI) / ids.length;
      return { id, a, x: CX + rx * Math.cos(a), y: CY + ry * Math.sin(a) };
    });
    const ring1 = place(near, r1x, r1y, 0.15).map((n) => ({ ...n, ...kinds[n.id] }));
    // Turn the outer ring so its labels sit between the inner ring's (wider gaps count more at the sides).
    let best = 0, bestGap = -1;
    for (let off = 0; far.length && off < (2 * Math.PI) / far.length; off += 0.01) {
      let gap = 9;
      for (const a of place(far, r2x, r2y, off)) {
        for (const b of ring1) {
          let d = Math.abs(a.a - b.a) % (2 * Math.PI);
          d = Math.min(d, 2 * Math.PI - d);
          gap = Math.min(gap, d * (1.2 + Math.abs(Math.cos(a.a))));
        }
      }
      if (gap > bestGap) { bestGap = gap; best = off; }
    }
    const ring2 = place(far, r2x, r2y, best);
    return {
      center: centerId, cx: CX, cy: CY, width: W, height: H, ring1, ring2, compact,
      rings: [[r1x, r1y], [r2x, r2y]], loops: MG.loopMoves(g, centerId).length,
    };
  }

  const labelOf = (g, id) => g.posById[id].short || g.posById[id].name;

  /** A station's label outside its dot, away from the middle; "Hammerlock L (cross)" goes on two lines. */
  function stationLabel(g, n, gap) {
    const cos = Math.cos(n.a), sin = Math.sin(n.a);
    const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
    const x = n.x + cos * gap;
    const y = n.y + sin * gap + (sin > 0.6 ? 12 : sin < -0.6 ? -4 : 5);
    const [first, rest] = labelOf(g, n.id).split(' (');
    const line = (t, yy) => `<text x="${r1(x)}" y="${r1(yy)}" text-anchor="${anchor}" class="hub-label">${esc(t)}</text>`;
    return rest ? line(first, sin < -0.6 ? y - 17 : y - 8) + line('(' + rest, sin < -0.6 ? y : y + 9) : line(first, y);
  }

  /**
   * Draw the hub. opts.end: where the combo ends (its station is filled); opts.link: the other end of
   * a tapped spoke (it is drawn thicker). Stations carry data-pos, spokes data-link="from>to"
   * (pointing out of the middle when a move goes that way).
   */
  function hubSVG(g, hub, opts = {}) {
    const { cx, cy } = hub;
    const spokes = hub.ring1.map((n) => {
      const dx = n.x - cx, dy = n.y - cy, d = Math.hypot(dx, dy) || 1;
      const ox = -dy / d, oy = dx / d;
      const both = n.move && n.adjuster;
      const line = (cls, o) => `<line x1="${r1(cx + ox * o)}" y1="${r1(cy + oy * o)}" x2="${r1(n.x + ox * o)}" y2="${r1(n.y + oy * o)}" class="${cls}"/>`;
      const lines = both ? line('hub-move', -4.5) + line('hub-adj', 4.5) : line(n.move ? 'hub-move' : 'hub-adj', 0);
      const link = n.out ? `${hub.center}>${n.id}` : `${n.id}>${hub.center}`;
      const what = [n.move ? 'moves' : '', n.adjuster ? 'adjusters' : ''].filter(Boolean).join(' and ');
      return `<g class="hub-spoke${both ? ' hub-pair' : ''}${opts.link === n.id ? ' on' : ''}" data-link="${esc(link)}">` +
        `<title>${esc(g.posById[hub.center].name)} and ${esc(g.posById[n.id].name)}: ${what}</title>${lines}` +
        `<line x1="${r1(cx)}" y1="${r1(cy)}" x2="${r1(n.x)}" y2="${r1(n.y)}" class="hub-hit mp-hit"/></g>`;
    }).join('\n');
    const station = (n, near) => {
      const p = g.posById[n.id];
      return `<g class="hub-node ${near ? 'hub-near' : 'hub-far'}${opts.end === n.id ? ' hub-end' : ''}" data-pos="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(p.name)}${near ? ', one move away' : ''}">` +
        `<title>${esc(p.name)}</title><circle cx="${r1(n.x)}" cy="${r1(n.y)}" r="${near ? 12 : 7}" class="hub-dot"/>${stationLabel(g, n, near ? 18 : 14)}</g>`;
    };
    const name = labelOf(g, hub.center);
    const w = Math.max(92, name.length * 9 + 28);
    const center = `<g class="hub-center hub-node" data-pos="${esc(hub.center)}" tabindex="0" role="button" aria-label="${esc(g.posById[hub.center].name)}, the middle of the map">` +
      `<title>${esc(g.posById[hub.center].name)}</title><rect x="${r1(cx - w / 2)}" y="${r1(cy - 16)}" width="${r1(w)}" height="32" rx="16"/>` +
      `<text x="${cx}" y="${cy + 6}" text-anchor="middle">${esc(name)}</text></g>`;
    const rings = hub.rings.map(([rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${r1(rx)}" ry="${r1(ry)}" class="hub-ring"/>`).join('');
    return `<svg viewBox="-30 0 ${hub.width + 60} ${hub.height}" class="hubmap${hub.compact ? ' compact' : ''}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Map around ${esc(g.posById[hub.center].name)}">
${rings}
${spokes}
${hub.ring2.map((n) => station(n, false)).join('\n')}
${hub.ring1.map((n) => station(n, true)).join('\n')}
${center}
</svg>`;
  }

  /**
   * The overview: every position where the force layout puts it, with faint links. The middle of the
   * hub is filled, its neighbours ringed. Dots carry data-center (tap to move the middle there).
   */
  function overviewSVG(g, full, centerId) {
    const pairs = new Map();
    for (const l of full.links) {
      if (isHubLink(g, l)) continue;
      pairs.set([l.from, l.to].sort().join('|'), [l.from, l.to]);
    }
    const near = new Set();
    for (const [a, b] of pairs.values()) { if (a === centerId) near.add(b); if (b === centerId) near.add(a); }
    const N = full.nodes;
    const lines = [...pairs.values()].map(([a, b]) => {
      const on = a === centerId || b === centerId;
      return `<line x1="${r1(N[a].x)}" y1="${r1(N[a].y)}" x2="${r1(N[b].x)}" y2="${r1(N[b].y)}" class="ov-link${on ? ' near' : ''}"/>`;
    }).join('');
    const dots = g.positions.map((p) => {
      const n = N[p.id];
      const cls = p.id === centerId ? ' center' : near.has(p.id) ? ' near' : '';
      return `<g data-center="${esc(p.id)}"><title>${esc(p.name)}</title><circle cx="${r1(n.x)}" cy="${r1(n.y)}" r="26" class="ov-hit"/><circle cx="${r1(n.x)}" cy="${r1(n.y)}" r="${p.id === centerId ? 13 : 10}" class="ov-dot${cls}"/></g>`;
    }).join('');
    return `<svg viewBox="20 20 ${full.width - 40} ${full.height - 40}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="All positions">${lines}${dots}</svg>`;
  }

  return { layoutMap, layoutHub, hubSVG, overviewSVG, linksOf, isHubLink };
});
