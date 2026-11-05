/*
 * Review: sorts the moves into groups that need different amounts of looking at, and says in plain
 * words what each move changes. Used by web/review.html, and tested.
 *
 *   classify(graph, Motion, mirrors) -> { inplace, letgo, turns, path, combos }   lists of review items
 *   holdChange(from, to)    -> { lets, takes, keeps, other }               the hands, in words
 *   turnReading(Motion, move) -> { who, degrees, text, source } | null     the turn the animation uses
 *
 * An item is { move, edges: [{ from, to }], starts: [position ids], turn, shown, change, mirrorOf, mirrors }.
 * `mirrors` (from MoveMirror.mirrorMoves) pairs moves that are exact mirror images: the first of a pair in a
 * group is the one to look at (`mirrors` lists the move ids it covers), the other has `mirrorOf` set.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MoveReview = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HAND = { L: 'left', R: 'right' };
  const TARGET = { L: 'her left hand', R: 'her right hand', back: 'her back', waist: 'her waist', shoulder: 'her shoulder' };

  /** [{ leader: 'L', target: 'R' }] from a position's hands, e.g. "L>R,R>back". */
  function handsOf(position) {
    return String((position && position.hands) || '').split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
      const [leader, target] = s.split('>').map((x) => x.trim());
      return { leader, target: target || '' };
    });
  }

  const holdText = (h) => `your ${HAND[h.leader] || h.leader} hand ${h.target ? '→ ' + (TARGET[h.target] || h.target) : ''}`.trim();
  const holdKey = (h) => `${h.leader}>${h.target}`;

  /** What happens to the hands between two positions, in words. */
  function holdChange(from, to) {
    const a = handsOf(from), b = handsOf(to);
    const inB = new Set(b.map(holdKey)), inA = new Set(a.map(holdKey));
    const out = {
      lets: a.filter((h) => !inB.has(holdKey(h))).map(holdText),
      takes: b.filter((h) => !inA.has(holdKey(h))).map(holdText),
      keeps: a.filter((h) => inB.has(holdKey(h))).map(holdText),
      other: [],
    };
    if (from && to) {
      if (from.orientation !== to.orientation) out.other.push(`she moves from ${from.orientation.replace(/_/g, ' ')} to ${to.orientation.replace(/_/g, ' ')}`);
      if (from.arms !== to.arms) out.other.push(`arms: ${String(from.arms).replace(/_/g, ' ')} → ${String(to.arms).replace(/_/g, ' ')}`);
      if (from.frame !== to.frame) out.other.push(`frame: ${from.frame} → ${to.frame}`);
    }
    return out;
  }

  /** The turn the animation will use for a move, where it came from, and in words. */
  function turnReading(Motion, move) {
    const t = Motion.turnsOf(move);
    const who = ['follower', 'leader', 'couple'].find((k) => t[k]);
    if (!who) return null;
    const degrees = t[who];
    let source = 'data';
    if (!(move.turn && typeof move.turn === 'object')) {
      source = Motion.turnsOf({ ...move, notes: '' })[who] ? 'name' : 'note';
    }
    const dir = degrees > 0 ? 'right' : 'left';
    let text = who === 'couple' ? `both turn together to the ${dir}` : `${who} turns ${dir}, ${Math.abs(degrees)}°`;
    if (t.free === who) text = `${who} turns (direction not stated: the animation takes the shorter way)`;
    return { who, degrees, source, text: `${text}  (from the ${source})` };
  }

  /**
   * How far each dancer's body really turns in the animation of a move (from the first start), in
   * degrees, right turns positive. It can differ from the reading: the animation also has to land
   * exactly in the end position.
   */
  function shownTurns(Motion, g, move, edge) {
    if (!edge) return null;
    const A = g.posById[edge.from], B = g.posById[edge.to];
    const angle = (v) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;
    const total = { follower: 0, leader: 0 };
    let prev = null;
    for (let k = 0; k <= 60; k++) {
      const f = Motion.frameAt(move, A, B, k / 60);
      const now = { follower: angle(f.follower.face), leader: angle(f.leader.face) };
      if (prev) for (const w of ['follower', 'leader']) total[w] += Motion.shortest(prev[w], now[w]);
      prev = now;
    }
    const snap = (x) => Math.round(x / 5) * 5;
    return { follower: snap(total.follower), leader: snap(total.leader) };
  }

  /** "follower turns right 360°" for what the animation shows, or "no turn". */
  function shownText(shown) {
    if (!shown) return '';
    const parts = ['follower', 'leader'].filter((w) => shown[w]).map((w) => `${w} ${shown[w] > 0 ? 'right' : 'left'} ${Math.abs(shown[w])}°`);
    return parts.length ? parts.join(', ') : 'nobody turns';
  }

  /** Sorts every move into the group that says how to review it. */
  function classify(g, Motion, mirrors = {}) {
    const out = { inplace: [], letgo: [], turns: [], path: [], combos: [] };
    const order = (id) => g.positions.findIndex((p) => p.id === id);
    for (const move of g.moves) {
      if (move.kind === 'compound') { out.combos.push({ move, edges: [], starts: [] }); continue; }
      const edges = (g.edgesByMove[move.id] || []).map((e) => ({ from: e.from, to: e.to }));
      const first = edges[0];
      const item = {
        move,
        edges,
        starts: [...new Set(edges.map((e) => e.from))],
        turn: turnReading(Motion, move),
        shown: shownTurns(Motion, g, move, edges[0]),
        change: first ? holdChange(g.posById[first.from], g.posById[first.to]) : null,
      };
      const changes = edges.some((e) => e.from !== e.to);
      if (move.kind === 'adjuster') out.letgo.push(item);
      else if (item.turn) out.turns.push(item);
      else if (changes) out.path.push(item);
      else out.inplace.push(item);
    }
    const key = (it) => [order(it.starts[0]), it.move.name.toLowerCase()];
    const byStart = (a, b) => { const [x, n] = key(a), [y, m] = key(b); return x - y || (n < m ? -1 : n > m ? 1 : 0); };
    for (const k of ['inplace', 'letgo', 'path']) out[k].sort(byStart);
    // Turns: the ones the animation had to guess from wording first, then the ones set in the data.
    out.turns.sort((a, b) => (a.turn.source === 'data') - (b.turn.source === 'data') || byStart(a, b));
    // Mirror images: look at one move of a pair, the other is covered by it.
    for (const k of ['letgo', 'turns', 'path']) {
      const byId = new Map(out[k].map((it) => [it.move.id, it]));
      const covered = new Set();
      for (const it of out[k]) {
        if (covered.has(it.move.id)) continue;
        const twins = (mirrors[it.move.id] || []).filter((id) => byId.has(id) && !covered.has(id));
        it.mirrors = twins;
        for (const id of twins) { covered.add(id); byId.get(id).mirrorOf = it.move.id; }
      }
    }
    return out;
  }

  return { classify, holdChange, turnReading, shownTurns, shownText, handsOf };
});
