/*
 * Random combo generator: builds combos a leader would actually dance.
 *
 *   - whole 8-counts (16, 32 or 48 counts), and 8-count moves start on 1
 *   - comes back to where it started
 *   - never drops both hands to "teleport" (release + reconnect), never undoes the
 *     move just made, uses each in-place move (basic, tap & hold...) at most once
 *   - prefers moves that change position
 *
 *   generate(g, start, { counts, maxLevel, rng, prefix }) -> [move ids]
 *     prefix: moves to keep at the start (for "extend this combo")
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./graph.js'));
  else root.ComboGenerator = factory(root.MoveGraph);
})(typeof self !== 'undefined' ? self : this, function (MG) {
  'use strict';

  const ATTEMPTS = 40;
  const WEIGHT = { move: 3, adjuster: 1.5, styling: 1 };

  const isApart = (g, posId) => g.posById[posId].frame === 'apart';
  const isEightCount = (m) => m.counts >= 8 && m.counts % 8 === 0;
  const isLoop = (e) => e.from === e.to;

  /** Moves that may come next, given what the combo has done so far. */
  function candidates(g, walk, { maxLevel, budget }) {
    const beat = walk.total % 8;                        // 0 = on 1, 4 = on 5
    const last = walk.ids[walk.ids.length - 1];
    const lastMove = last && g.moveById[last];
    return MG.nextMoves(g, walk.pos).filter((e) => {
      const m = g.moveById[e.move];
      if (m.kind === 'compound' || m.level > maxLevel) return false;
      if (isApart(g, e.to) || isApart(g, walk.pos)) return false;      // no teleport
      if (walk.total + m.counts > budget) return false;
      if (isEightCount(m) && beat !== 0) return false;                  // 8-counts start on 1
      if (m.on && m.on !== (beat === 0 ? 1 : 5)) return false;          // a turn is led on its own half
      if (isLoop(e) && (walk.used.has(e.move) || (lastMove && walk.lastWasLoop))) return false;
      if (!isLoop(e) && e.to === walk.prevPos) return false;            // no undo
      if (lastMove && lastMove.opposite === e.move) return false;
      return true;
    });
  }

  /** Weighted choice: led moves first; going somewhere new beats repeating yourself. */
  function pick(g, walk, options, rng) {
    const weights = options.map((e) => {
      let w = WEIGHT[g.moveById[e.move].kind] || 1;
      if (walk.ids.includes(e.move)) w *= 0.2;
      if (!isLoop(e) && walk.visited.has(e.to)) w *= 0.25;
      return w;
    });
    let r = rng() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < options.length; i++) if ((r -= weights[i]) < 0) return options[i];
    return options[options.length - 1];
  }

  function step(g, walk, e) {
    walk.ids.push(e.move);
    walk.total += g.moveById[e.move].counts;
    walk.lastWasLoop = isLoop(e);
    if (isLoop(e)) walk.used.add(e.move);
    else { walk.prevPos = walk.pos; walk.pos = e.to; walk.visited.add(e.to); }
  }

  function startWalk(g, start, prefix) {
    const r = MG.evaluateStrip(g, start, 'mirrored', prefix);
    const walk = { ids: [...prefix], pos: r.end, prevPos: null, total: r.totalCounts, used: new Set(), lastWasLoop: false,
      visited: new Set([start, ...r.items.map((it) => it.to).filter(Boolean)]) };
    for (const it of r.items) if (it.move && it.from === it.to) walk.used.add(it.id);
    return walk;
  }

  /** An unused 4-count in-place move at the current position, if any. */
  function freeLoop(g, walk, maxLevel) {
    return MG.nextMoves(g, walk.pos).find((e) => isLoop(e) && g.moveById[e.move].counts === 4 &&
      g.moveById[e.move].level <= maxLevel && !walk.used.has(e.move));
  }

  /** Does every move of a route land on its own half of the phrase when the route starts after `total` counts? */
  function fitsPhrase(g, path, total) {
    let t = total;
    for (const id of path) {
      const m = g.moveById[id];
      if (m.on && m.on !== (t % 8 === 0 ? 1 : 5)) return false;
      if (isEightCount(m) && t % 8 !== 0) return false;
      t += m.counts || 0;
    }
    return true;
  }

  /** Way home that doesn't go through "apart", doesn't just undo the last move and keeps turns on their half. */
  function goHome(g, walk, start, maxLevel) {
    if (walk.pos === start) return true;
    const routes = MG.findBridges(g, walk.pos, start, { maxLevel, limit: 12 })
      .filter((path) => !path.some((id) => (g.edgesByMove[id] || []).every((e) => isApart(g, e.to))));
    if (!routes.length) return false;
    const firstStepUndoes = (path) => g.edgesByMove[path[0]].find((e) => e.from === walk.pos).to === walk.prevPos;
    let route = routes.find((path) => !firstStepUndoes(path) && fitsPhrase(g, path, walk.total));
    if (!route) {
      // A 4-count in place move first moves the route to the other half of the phrase
      // (and avoids e.g. hammerlock entry → hammerlock exit with nothing in between).
      const loop = freeLoop(g, walk, maxLevel);
      const later = loop && routes.find((path) => fitsPhrase(g, path, walk.total + 4));
      if (later) { step(g, walk, loop); route = later; }
    }
    if (!route) route = routes.find((path) => !firstStepUndoes(path));
    if (!route) {
      const loop = freeLoop(g, walk, maxLevel);
      if (loop) step(g, walk, loop);
      route = routes[0];
    }
    for (const id of route) step(g, walk, g.edgesByMove[id].find((e) => e.from === walk.pos));
    return true;
  }

  /** Get home (if asked), then pad to a whole 8-count. */
  function finish(g, walk, start, maxLevel, home) {
    if (home && !goHome(g, walk, start, maxLevel)) return false;
    if (walk.total % 8 === 4) {                          // pad with a 4-count move in place
      const pad = freeLoop(g, walk, maxLevel);
      if (!pad) return false;
      step(g, walk, pad);
    }
    return walk.total % 8 === 0 && walk.total > 0;
  }

  /** Hard problems a combo must not have (also used by the tests). */
  function problems(g, start, ids) {
    const r = MG.evaluateStrip(g, start, 'mirrored', ids);
    const out = [];
    if (r.items.some((it) => it.broken)) out.push('broken');
    if (r.items.some((it) => it.to && isApart(g, it.to))) out.push('goes apart');
    if (r.items.some((it) => isEightCount(it.move) && it.beat !== 1)) out.push('8-count move starts on 5');
    if (r.totalCounts % 8 !== 0) out.push('not whole 8-counts');
    return out;
  }

  function generate(g, start, { counts = 32, maxLevel = 3, rng = Math.random, prefix = [] } = {}) {
    // If no way home exists at this level, keep every other rule and end wherever the combo ends.
    return attempt(g, start, { counts, maxLevel, rng, prefix, home: true }) ||
      attempt(g, start, { counts, maxLevel, rng, prefix, home: false }) || [...prefix];
  }

  function attempt(g, start, { counts, maxLevel, rng, prefix, home }) {
    let best = null;
    for (let tries = 0; tries < ATTEMPTS; tries++) {
      const walk = startWalk(g, start, prefix);
      const target = walk.total + counts;
      // Leave about one 8-count to get home.
      while (walk.total < target - 8) {
        const options = candidates(g, walk, { maxLevel, budget: target - 4 });
        if (!options.length) break;
        step(g, walk, pick(g, walk, options, rng));
      }
      if (!finish(g, walk, start, maxLevel, home)) continue;
      const miss = Math.abs(walk.total - target);
      if (!best || miss < best.miss) best = { ids: walk.ids, miss };
      if (miss === 0) break;
    }
    return best && best.ids;
  }

  return { generate, problems };
});
