/*
 * Mirror images. Left and right swapped, a move should look exactly like its mirror move: the
 * follower's right turn from left-to-right becomes a left turn from right-to-left. This module
 * mirrors positions and animation frames, and finds which edges of the graph are mirrors of each
 * other, so a test can check that the animation really is symmetrical. It also tells the review
 * page which moves can be looked at once for both sides.
 *
 *   mirrorPosition(p)         the position with left and right swapped (attributes only), or null
 *   mirrorOf(g, positionId)   the position in the graph that is its mirror image, or null
 *   mirrorTurn(turns)         { follower, leader, couple } turning the other way
 *   mirrorEdges(g, Motion)    [{ a: edge, b: edge }]: edges of two moves that are mirrors of each other
 *   mirrorMoves(g, Motion)    { moveId: [ids of the moves that are its mirror image] } for moves that turn or travel
 *   mirrorFrame(L, SK)        an animation frame (layout) as seen in a mirror
 *   frameGap(L1, L2)          how far apart two frames are, in picture units (largest difference)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./graph.js'));
  else root.MoveMirror = factory(root.MoveGraph);
})(typeof self !== 'undefined' ? self : this, function (MG) {
  'use strict';

  const SWAP = { L: 'R', R: 'L' };
  const swapSide = (s) => SWAP[s] || s;
  const ORIENTATION = { side_by_side_R: 'side_by_side_L', side_by_side_L: 'side_by_side_R' };
  const CROSSED = { leader_R_over_L: 'leader_L_over_R', leader_L_over_R: 'leader_R_over_L' };

  /** "L>R,R>back" -> "R>L,L>back". */
  function mirrorHands(hands) {
    return String(hands || '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
      const [a, b] = s.split('>').map((x) => x.trim());
      return `${swapSide(a)}>${b === undefined ? '' : swapSide(b)}`;
    }).join(',');
  }

  /** hammerlock_follower_R <-> _L, hammerlock_leader_L <-> _R, a hand behind the neck, a one-hand wrap. */
  function mirrorArms(arms) {
    const a = String(arms || 'neutral');
    let m = a.match(/^(hammerlock_(?:leader|follower)_)([LR])$/);
    if (m) return m[1] + swapSide(m[2]);
    m = a.match(/^(follower_)([LR])(_behind_leader_neck)$/);
    if (m) return m[1] + swapSide(m[2]) + m[3];
    m = a.match(/^(wrap_follower_)([LR])$/);
    if (m) return m[1] + swapSide(m[2]);
    return a;
  }

  function mirrorPosition(p) {
    if (!p) return null;
    if (p.orientation === 'hip_to_hip') return null;        // no mirror drawn for these
    return {
      ...p,
      orientation: ORIENTATION[p.orientation] || p.orientation,
      hands: mirrorHands(p.hands),
      crossed: CROSSED[p.crossed] || p.crossed,
      arms: mirrorArms(p.arms),
    };
  }

  /** The position of the graph that is the mirror image of position `id` (itself if it is symmetric). */
  function mirrorOf(g, id) {
    const m = mirrorPosition(g.posById[id]);
    if (!m) return null;
    const key = MG.positionKey(m);
    return g.positions.find((p) => MG.positionKey(p) === key) || null;
  }

  const mirrorTurn = (t) => ({ follower: -t.follower || 0, leader: -t.leader || 0, couple: -t.couple || 0, free: t.free });

  const sameTurn = (a, b) => ['follower', 'leader', 'couple'].every((k) => Math.abs((a[k] || 0) - (b[k] || 0)) < 1e-9) && (a.free || null) === (b.free || null);

  /**
   * Pairs of edges that are mirror images: positions mirrored, the turn the other way round, the same
   * kind and counts. A move whose edges are all symmetric (a basic step) pairs its edges with each other.
   */
  function mirrorEdges(g, Motion) {
    const byKey = new Map();
    for (const e of g.edges) {
      const m = g.moveById[e.move];
      if (m.kind === 'compound') continue;
      byKey.set(`${e.from}|${e.to}`, [...(byKey.get(`${e.from}|${e.to}`) || []), e]);
    }
    const pairs = [];
    for (const a of g.edges) {
      const ma = g.moveById[a.move];
      if (ma.kind === 'compound') continue;
      const from = mirrorOf(g, a.from), to = mirrorOf(g, a.to);
      if (!from || !to) continue;
      const wanted = mirrorTurn(Motion.turnsOf(ma));
      for (const b of byKey.get(`${from.id}|${to.id}`) || []) {
        const mb = g.moveById[b.move];
        if (mb.kind !== ma.kind || (mb.counts || 0) !== (ma.counts || 0)) continue;
        if (!sameTurn(Motion.turnsOf(mb), wanted)) continue;
        pairs.push({ a, b });
      }
    }
    return pairs;
  }

  /**
   * The moves that are mirror images of a move as a whole: every start and end mirrored, the turn the
   * other way round, the same kind and counts. Only moves that turn or end in another position are
   * listed (in-place steps are all alike). A move that is its own mirror (a left and a right start)
   * has an empty list.
   */
  function mirrorMoves(g, Motion) {
    const edgeSet = (m) => new Set((g.edgesByMove[m.id] || []).map((e) => `${e.from}|${e.to}`));
    const moves = g.moves.filter((m) => m.kind !== 'compound');
    const mirroredSet = (m) => {
      const out = new Set();
      for (const e of g.edgesByMove[m.id] || []) {
        const f = mirrorOf(g, e.from), t = mirrorOf(g, e.to);
        if (!f || !t) return null;
        out.add(`${f.id}|${t.id}`);
      }
      return out;
    };
    const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
    const result = {};
    for (const a of moves) {
      const edges = g.edgesByMove[a.id] || [];
      const moving = edges.some((e) => e.from !== e.to) || ['follower', 'leader', 'couple'].some((k) => Motion.turnsOf(a)[k]);
      if (!moving || !edges.length) continue;
      const want = mirroredSet(a);
      if (!want) continue;
      const wantTurn = mirrorTurn(Motion.turnsOf(a));
      const partners = moves.filter((b) => b.id !== a.id && b.kind === a.kind && (b.counts || 0) === (a.counts || 0) &&
        sameTurn(Motion.turnsOf(b), wantTurn) && same(edgeSet(b), want)).map((b) => b.id);
      if (partners.length) result[a.id] = partners;
    }
    return result;
  }

  // ---- frames ------------------------------------------------------------------------------------------
  const MIDDLE = 90;     // the leader stands at x = 90 in every picture (see sketch.js)
  const flipPoint = (p) => (p ? [2 * MIDDLE - p[0], p[1]] : p);
  const flipVector = (v) => [-v[0], v[1]];

  /** A frame as seen in a mirror: everything flipped left to right, hands swapped. */
  function mirrorFrame(L, SK) {
    const flipBody = (b) => SK.body(flipPoint(b.c), flipVector(b.face));
    const arms = L.arms.map((a) => ({
      ...a,
      hand: swapSide(a.hand),
      from: flipPoint(a.from),
      via: a.via ? flipPoint(a.via) : a.via,
      to: flipPoint(a.to),
      grip: a.grip ? flipPoint(a.grip) : a.grip,
      holds: a.holds === undefined ? a.holds : swapSide(a.holds),
      heldBy: a.heldBy === undefined ? a.heldBy : swapSide(a.heldBy),
      side: a.side === undefined ? a.side : -a.side,
    }));
    return { ...L, leader: flipBody(L.leader), follower: flipBody(L.follower), arms, top: L.top ? swapSide(L.top) : L.top };
  }

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  /** The largest difference between two frames: bodies, faces and where every hand is. Infinity if arms differ. */
  function frameGap(A, B) {
    let gap = 0;
    for (const w of ['leader', 'follower']) {
      gap = Math.max(gap, dist(A[w].c, B[w].c), 20 * dist(A[w].face, B[w].face));
    }
    if (A.arms.length !== B.arms.length) return Infinity;
    for (const a of A.arms) {
      const b = B.arms.find((x) => x.who === a.who && x.hand === a.hand);
      if (!b) return Infinity;
      gap = Math.max(gap, dist(a.from, b.from), dist(a.to, b.to));
    }
    return gap;
  }

  return { mirrorHands, mirrorArms, mirrorPosition, mirrorOf, mirrorTurn, mirrorEdges, mirrorMoves, mirrorFrame, frameGap };
});
