/*
 * Move graph core. Shared by the browser app and the Node build/tests.
 *
 *   positions = nodes, moves = edges (a directed multigraph).
 *   A move's `from` is a pattern; its `to` is "same", a position id or an
 *   attribute change. compile() expands every move into concrete edges.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MoveGraph = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ATTRS = ['orientation', 'frame', 'hands', 'crossed', 'arms'];
  const KINDS = ['move', 'styling', 'adjuster', 'compound'];
  const WEIGHTS = ['mirrored', 'parallel'];

  function canonHands(h) {
    return String(h ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .sort()
      .join(',');
  }

  function canon(attr, value) {
    return attr === 'hands' ? canonHands(value) : String(value ?? '');
  }

  function positionKey(p) {
    return ATTRS.map((a) => canon(a, p[a])).join('|');
  }

  /** Does position `pos` satisfy a `from` pattern? */
  function matchPattern(pos, pattern) {
    if (pattern === 'any') return true;
    if (typeof pattern === 'string') return pos.id === pattern;
    if (Array.isArray(pattern)) return pattern.includes(pos.id);
    if (pattern && typeof pattern === 'object') {
      return Object.entries(pattern).every(([attr, expected]) => {
        const options = Array.isArray(expected) ? expected : [expected];
        return options.some((o) => canon(attr, o) === canon(attr, pos[attr]));
      });
    }
    return false;
  }

  /** Position ids referenced by a pattern (for validation). */
  function referencedIds(pattern) {
    if (typeof pattern === 'string' && pattern !== 'any' && pattern !== 'same') return [pattern];
    if (Array.isArray(pattern)) return pattern;
    return [];
  }

  function normalizeMove(raw) {
    const m = { ...raw };
    m.kind = m.kind || (m.sequence ? 'compound' : 'move');
    if (m.kind !== 'compound') {
      if (m.to === undefined) m.to = 'same';
      m.counts = m.counts ?? 0;
    }
    m.weight = m.weight || {};
    return m;
  }

  /** Index positions by id and by attributes, reporting missing fields and duplicates. */
  function indexPositions(positions, errors) {
    const posById = {};
    const posByKey = {};
    for (const p of positions) {
      if (!p.id) { errors.push('A position has no id.'); continue; }
      if (posById[p.id]) errors.push(`Duplicate position id "${p.id}".`);
      for (const a of ATTRS) {
        if (p[a] === undefined) errors.push(`Position "${p.id}" is missing "${a}".`);
      }
      posById[p.id] = p;
      const key = positionKey(p);
      if (posByKey[key]) errors.push(`Positions "${posByKey[key].id}" and "${p.id}" have identical attributes (same node).`);
      else posByKey[key] = p;
    }
    return { posById, posByKey };
  }

  /** Index moves by id, reporting duplicates and invalid kind, counts, level or weight. */
  function indexMoves(moves, errors) {
    const moveById = {};
    for (const m of moves) {
      if (!m.id) { errors.push('A move has no id.'); continue; }
      if (moveById[m.id]) errors.push(`Duplicate move id "${m.id}".`);
      moveById[m.id] = m;
      if (!KINDS.includes(m.kind)) errors.push(`Move "${m.id}" has unknown kind "${m.kind}".`);
      if (m.kind !== 'compound' && !(Number.isInteger(m.counts) && m.counts >= 0)) {
        errors.push(`Move "${m.id}" needs counts as a whole number >= 0.`);
      }
      if (m.level !== undefined && ![1, 2, 3].includes(m.level)) errors.push(`Move "${m.id}" has level ${m.level}; use 1, 2 or 3.`);
      for (const side of ['from', 'to']) {
        const w = m.weight[side];
        if (w !== undefined && !WEIGHTS.includes(w)) errors.push(`Move "${m.id}" has unknown weight.${side} "${w}".`);
      }
    }
    return moveById;
  }

  /** Data -> graph: index positions and moves, expand moves into edges, derive weight and level, check opposites. */
  function compile(data) {
    const errors = [];
    const warnings = [];
    const positions = data.positions || [];
    const { posById, posByKey } = indexPositions(positions, errors);
    const moves = (data.moves || []).map(normalizeMove);
    const moveById = indexMoves(moves, errors);

    const edgesByMove = {};
    const weightByMove = {};

    function resolveEnd(m, start) {
      if (m.to === 'same') return start;
      if (typeof m.to === 'string') return posById[m.to] || null;
      if (m.to && typeof m.to === 'object') {
        const merged = { ...start, ...m.to };
        return posByKey[positionKey(merged)] || null;
      }
      return null;
    }

    function primitiveEdges(m) {
      for (const id of [...referencedIds(m.from), ...referencedIds(m.to)]) {
        if (!posById[id]) errors.push(`Move "${m.id}" refers to unknown position "${id}".`);
      }
      const edges = [];
      for (const start of positions) {
        if (!matchPattern(start, m.from)) continue;
        const end = resolveEnd(m, start);
        if (!end) {
          errors.push(`Move "${m.id}" from "${start.id}" lands on a position that does not exist (${JSON.stringify(m.to)}).`);
          continue;
        }
        edges.push({ move: m.id, from: start.id, to: end.id });
      }
      if (!edges.length) errors.push(`Move "${m.id}" cannot start from any position.`);
      return edges;
    }

    // Compound moves are live references: walk the sequence from every position.
    function compoundEdges(m, stack) {
      if (!Array.isArray(m.sequence) || m.sequence.length === 0) {
        errors.push(`Compound "${m.id}" needs a non-empty sequence.`);
        return [];
      }
      const missing = m.sequence.filter((id) => !moveById[id]);
      if (missing.length) {
        errors.push(`Compound "${m.id}" uses unknown move(s): ${missing.join(', ')}.`);
        return [];
      }
      const edges = [];
      for (const start of positions) {
        let cur = start.id;
        let ok = true;
        for (const sub of m.sequence) {
          const e = edgesFor(sub, stack).find((x) => x.from === cur);
          if (!e) { ok = false; break; }
          cur = e.to;
        }
        if (ok) edges.push({ move: m.id, from: start.id, to: cur });
      }
      if (!edges.length) errors.push(`Compound "${m.id}" is broken: its parts no longer connect.`);
      m.counts = m.sequence.reduce((sum, id) => sum + (moveById[id].counts || 0), 0);
      return edges;
    }

    function edgesFor(id, stack = []) {
      if (edgesByMove[id]) return edgesByMove[id];
      const m = moveById[id];
      if (!m) return [];
      if (stack.includes(id)) {
        errors.push(`Compound "${id}" contains itself.`);
        return [];
      }
      const edges = m.kind === 'compound' ? compoundEdges(m, [...stack, id]) : primitiveEdges(m);
      edgesByMove[id] = edges;
      return edges;
    }

    // Weight: what a move requires (from) and leaves behind (to). Compounds derive it.
    function weightOf(id, stack = []) {
      if (weightByMove[id]) return weightByMove[id];
      const m = moveById[id];
      if (!m) return {};
      if (m.kind !== 'compound' || stack.includes(id)) return (weightByMove[id] = { ...m.weight });
      let from, cur;
      for (const sub of m.sequence || []) {
        const w = weightOf(sub, [...stack, id]);
        if (w.from) {
          if (cur === undefined && from === undefined) from = w.from;
          else if (cur !== undefined && cur !== w.from) {
            warnings.push(`Compound "${m.id}": "${sub}" expects ${w.from} weight but gets ${cur}.`);
          }
        }
        if (w.to) cur = w.to;
      }
      return (weightByMove[id] = { from, to: cur });
    }

    for (const m of moves) if (m.id) edgesFor(m.id);
    for (const m of moves) if (m.id) weightOf(m.id);

    // Level: compounds are as hard as their hardest part.
    const levelOf = (id, stack = []) => {
      const m = moveById[id];
      if (!m) return 1;
      if (m.kind !== 'compound') return m.level || 1;
      if (stack.includes(id)) return 1;
      return Math.max(1, ...(m.sequence || []).map((sub) => levelOf(sub, [...stack, id])));
    };
    for (const m of moves) if (m.id) m.level = levelOf(m.id);

    for (const m of moves) {
      if (!m.opposite) continue;
      const o = moveById[m.opposite];
      if (!o) errors.push(`Move "${m.id}" lists unknown opposite "${m.opposite}".`);
      else if (o.opposite !== m.id) warnings.push(`"${m.id}" lists "${o.id}" as opposite, but not the other way round.`);
    }

    const edges = Object.values(edgesByMove).flat();
    const outgoing = {};
    const incoming = {};
    for (const p of positions) { outgoing[p.id] = []; incoming[p.id] = []; }
    for (const e of edges) {
      if (outgoing[e.from]) outgoing[e.from].push(e);
      if (incoming[e.to]) incoming[e.to].push(e);
    }

    const g = {
      positions, posById, moves, moveById, edges, edgesByMove, outgoing, incoming,
      weightOf: (id) => weightByMove[id] || {},
      errors, warnings,
    };
    g.health = positions.map((p) => vocabularyHealth(g, p.id));
    return g;
  }

  /** A move that changes position: not an in-place move, not a compound. */
  function isTransition(g, e) {
    return e.from !== e.to && g.moveById[e.move].kind !== 'compound';
  }

  /** Ids of the in-place moves (no compounds) at a position. */
  function loopMoves(g, posId) {
    const loops = (g.outgoing[posId] || []).filter((e) => e.to === posId && g.moveById[e.move].kind !== 'compound');
    return [...new Set(loops.map((e) => e.move))];
  }

  /** "Three ways in, three ways out": distinct position-changing moves into and out of a position. */
  function vocabularyHealth(g, posId) {
    const count = (edges) => new Set(edges.filter((e) => isTransition(g, e)).map((e) => e.move)).size;
    const ins = count(g.incoming[posId]);
    const outs = count(g.outgoing[posId]);
    return { id: posId, in: ins, out: outs, thin: ins < 3 || outs < 3 };
  }

  /** Walk a strip of move ids and report positions, counts and soft warnings. */
  function evaluateStrip(g, startPos, startWeight, ids) {
    let cur = startPos;
    let weight = startWeight;
    let count = 0;
    const items = ids.map((id) => {
      const m = g.moveById[id];
      if (!m) return { id, missing: true, broken: true, expected: cur };
      const options = g.edgesByMove[id] || [];
      let edge = options.find((e) => e.from === cur);
      const broken = !edge;
      if (!edge) edge = options[0];
      const w = g.weightOf(id);
      const beat = (count % 8) + 1;
      const item = {
        id, move: m,
        expected: cur,
        from: edge ? edge.from : null,
        to: edge ? edge.to : null,
        broken,
        beat,
        countFrom: count,
        weightIn: weight,
        weightWarn: Boolean(w.from && weight && w.from !== weight),
        timingWarn: m.counts > 0 && beat !== 1 && beat !== 5,
        // An 8-count figure that starts on 5 runs across two phrases.
        phraseWarn: m.counts >= 8 && m.counts % 8 === 0 && beat === 5,
      };
      count += m.counts || 0;
      if (w.to) weight = w.to;
      if (edge) cur = edge.to;
      item.weightOut = weight;
      return item;
    });
    return { items, end: cur, weight, totalCounts: count };
  }

  /** Moves that can follow position `posId`: one edge per move, sorted by name. */
  function nextMoves(g, posId) {
    const seen = new Map();
    for (const e of g.outgoing[posId] || []) if (!seen.has(e.move)) seen.set(e.move, e);
    return [...seen.values()].sort((a, b) =>
      g.moveById[a.move].name.localeCompare(g.moveById[b.move].name));
  }

  /** Other moves with the same start and end (parallel edges in the multigraph). */
  function alternatives(g, from, to, excludeId) {
    const seen = new Set();
    return (g.outgoing[from] || [])
      .filter((e) => e.to === to && e.move !== excludeId && !seen.has(e.move) && seen.add(e.move))
      .map((e) => e.move)
      .sort((a, b) => g.moveById[a].name.localeCompare(g.moveById[b].name));
  }

  /** Shortest ways to get from one position to another (no styling loops, no compounds). */
  function findBridges(g, from, to, { maxDepth = 3, limit = 6, maxLevel = 3 } = {}) {
    if (from === to) return [[]];
    const usable = (e) => isTransition(g, e) && g.moveById[e.move].level <= maxLevel;
    const results = [];
    const seen = new Set();
    for (let depth = 1; depth <= maxDepth && results.length < limit; depth++) {
      const walk = (pos, path, visited) => {
        if (results.length >= limit * 4) return;
        if (path.length === depth) {
          if (pos === to) {
            const key = path.map((e) => e.move).join('>');
            if (!seen.has(key)) { seen.add(key); results.push(path.map((e) => e.move)); }
          }
          return;
        }
        for (const e of g.outgoing[pos] || []) {
          if (!usable(e) || visited.has(e.to)) continue;
          visited.add(e.to);
          walk(e.to, [...path, e], visited);
          visited.delete(e.to);
        }
      };
      walk(from, [], new Set([from]));
    }
    const throughApart = (path) => path.some((id) => (g.edgesByMove[id] || []).some((e) => g.posById[e.to].frame === 'apart'));
    const score = (path) => [
      throughApart(path) ? 1 : 0,     // "drop both hands and reconnect" is the last resort
      path.length,
      path.filter((id) => g.moveById[id].kind !== 'adjuster').length,
      path.reduce((s, id) => s + g.moveById[id].counts, 0),
    ];
    results.sort((a, b) => {
      const sa = score(a), sb = score(b);
      for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sa[i] - sb[i];
      return 0;
    });
    return results.slice(0, limit);
  }

  /** Random walk of `steps` moves from a position (no compounds, no immediate repeats). */
  function randomWalk(g, start, steps, rng = Math.random, maxLevel = 3) {
    const ids = [];
    let cur = start;
    for (let i = 0; i < steps; i++) {
      const options = nextMoves(g, cur).filter(
        (e) => g.moveById[e.move].kind !== 'compound' && e.move !== ids[ids.length - 1] && g.moveById[e.move].level <= maxLevel);
      if (!options.length) break;
      const e = options[Math.floor(rng() * options.length)];
      ids.push(e.move);
      cur = e.to;
    }
    return ids;
  }

  /** Random combo that, when possible, finds its way back to the start position. */
  function randomCombo(g, start, { steps = 5, home = true, rng = Math.random, maxLevel = 3 } = {}) {
    let ids = [];
    // A walk that wandered too far to bridge back in a few moves is walked again (shorter each time).
    for (let attempt = 0; attempt < 12; attempt++) {
      ids = randomWalk(g, start, Math.max(1, steps - Math.floor(attempt / 3)), rng, maxLevel);
      if (!home) return ids;
      const end = evaluateStrip(g, start, 'mirrored', ids).end;
      if (end === start) return ids;
      const back = findBridges(g, end, start, { limit: 1, maxLevel })[0] || findBridges(g, end, start, { limit: 1 })[0];
      if (back) return ids.concat(back);
    }
    return ids;
  }

  /** Beats a move covers in the 8-count, e.g. "5-8, 1-4" for an 8-count move that starts on 5. */
  function beatRange(startBeat, counts) {
    const runs = [];
    for (let k = 0; k < counts; k++) {
      const b = ((startBeat - 1 + k) % 8) + 1;
      const run = runs[runs.length - 1];
      if (run && b === run[1] + 1) run[1] = b; else runs.push([b, b]);
    }
    return runs.map(([a, z]) => (a === z ? `${a}` : `${a}-${z}`)).join(', ');
  }

  const ORIENTATION_ABBR = {
    facing: 'FEO', shadow: 'SHD', reverse_shadow: 'RSHD', side_by_side_L: 'SBS-L',
    side_by_side_R: 'SBS-R', hip_to_hip: 'H2H', back_to_back: 'B2B',
  };
  const CROSSED_ABBR = { leader_R_over_L: 'R/L', leader_L_over_R: 'L/R' };

  /** Compact notation, e.g. "FEO · open · L>R,R>back". */
  function notation(p) {
    const parts = [ORIENTATION_ABBR[p.orientation] || p.orientation, p.frame, canonHands(p.hands) || 'no hands'];
    if (p.crossed && p.crossed !== 'none') parts.push('cross ' + (CROSSED_ABBR[p.crossed] || p.crossed));
    if (p.arms && p.arms !== 'neutral') parts.push(p.arms.replace(/_/g, ' '));
    return parts.join(' · ');
  }

  return {
    ATTRS, KINDS, canonHands, positionKey, matchPattern, compile, evaluateStrip, isTransition, loopMoves,
    nextMoves, alternatives, findBridges, randomWalk, randomCombo, notation, beatRange,
  };
});
