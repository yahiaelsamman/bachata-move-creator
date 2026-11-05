import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadData } from '../scripts/build.mjs';

const require = createRequire(import.meta.url);
const MG = require('../src/graph.js');
const SK = require('../src/sketch.js');
const M = require('../src/motion.js');
const X = require('../src/mirror.js');

const g = MG.compile(loadData());
const GAP = 1;      // picture units; the sketch is about 180 wide

test('mirroring swaps left and right in hands, crossing and arms', () => {
  assert.equal(X.mirrorHands('L>R,R>back'), 'R>L,L>back');
  assert.equal(X.mirrorHands('L>L,R>R'), 'R>R,L>L');
  assert.equal(X.mirrorHands(''), '');
  assert.equal(X.mirrorArms('hammerlock_follower_R'), 'hammerlock_follower_L');
  assert.equal(X.mirrorArms('hammerlock_leader_L'), 'hammerlock_leader_R');
  assert.equal(X.mirrorArms('follower_R_behind_leader_neck'), 'follower_L_behind_leader_neck');
  assert.equal(X.mirrorArms('wrap_follower_R'), 'wrap_follower_L');
  assert.equal(X.mirrorArms('wrap'), 'wrap');
  assert.equal(X.mirrorArms(undefined), 'neutral');
  const p = X.mirrorPosition({ orientation: 'side_by_side_R', frame: 'closed', hands: 'L>R', crossed: 'leader_R_over_L', arms: 'neutral' });
  assert.deepEqual([p.orientation, p.hands, p.crossed], ['side_by_side_L', 'R>L', 'leader_L_over_R']);
  assert.equal(X.mirrorPosition(null), null);
  assert.equal(X.mirrorPosition({ orientation: 'hip_to_hip' }), null);
});

test('mirroring twice gives the position back, and the mirror of a position is a position of the graph', () => {
  for (const p of g.positions) {
    const m = X.mirrorOf(g, p.id);
    if (!m) continue;
    assert.equal(X.mirrorOf(g, m.id).id, p.id, p.id);
  }
  assert.equal(X.mirrorOf(g, 'open_LR').id, 'open_RL');
  assert.equal(X.mirrorOf(g, 'cross_Rtop').id, 'cross_Ltop');
  assert.equal(X.mirrorOf(g, 'hammerlock_R').id, 'hammerlock_L_cross');
  assert.equal(X.mirrorOf(g, 'double').id, 'double');
  // Holds with a hand on her back or her arm wrapped have no mirror image in the graph yet.
  assert.equal(X.mirrorOf(g, 'closed'), null);
});

test('mirror partners are found: right turn and left turn, and a move can be its own mirror', () => {
  const mm = X.mirrorMoves(g, M);
  assert.deepEqual(mm['follower-right-turn'], ['follower-left-turn']);
  assert.deepEqual(mm['follower-left-turn'], ['follower-right-turn']);
  assert.ok(Object.keys(mm).length >= 30);
  // Partners are symmetric and never more than one.
  for (const [a, list] of Object.entries(mm)) {
    assert.equal(list.length, 1, a);
    assert.deepEqual(mm[list[0]], [a], `${a} <-> ${list[0]}`);
  }
});

test('every pair of mirror edges animates as an exact mirror image, frame by frame', () => {
  const pairs = X.mirrorEdges(g, M);
  assert.ok(pairs.length > 100, `only ${pairs.length} pairs`);
  for (const { a, b } of pairs) {
    const A = g.moveById[a.move], B = g.moveById[b.move];
    for (let k = 0; k <= 20; k++) {
      const t = k / 20;
      const mirrored = X.mirrorFrame(M.frameAt(A, g.posById[a.from], g.posById[a.to], t), SK);
      const other = M.frameAt(B, g.posById[b.from], g.posById[b.to], t);
      const gap = X.frameGap(mirrored, other);
      assert.ok(gap < GAP, `${a.move} ${a.from}->${a.to} vs ${b.move} ${b.from}->${b.to} at t=${t}: ${gap === Infinity ? 'the arms differ' : gap.toFixed(1)} apart`);
    }
  }
});

test('the check can fail: a frame is not the mirror of one that turns the same way', () => {
  const right = g.edgesByMove['follower-right-turn'].find((e) => e.from === 'open_LR');
  const sameWay = g.edgesByMove['follower-right-turn'].find((e) => e.from === 'open_RL');
  const A = g.moveById[right.move];
  let worst = 0;
  for (let k = 0; k <= 20; k++) {
    const t = k / 20;
    worst = Math.max(worst, X.frameGap(X.mirrorFrame(M.frameAt(A, g.posById[right.from], g.posById[right.to], t), SK),
      M.frameAt(A, g.posById[sameWay.from], g.posById[sameWay.to], t)));
  }
  assert.ok(worst > 10, `gap ${worst}`);
  assert.equal(X.frameGap({ leader: { c: [0, 0], face: [0, -1] }, follower: { c: [0, 0], face: [0, 1] }, arms: [] },
    { leader: { c: [0, 0], face: [0, -1] }, follower: { c: [0, 0], face: [0, 1] }, arms: [{ who: 'leader', hand: 'L', from: [0, 0], to: [0, 0] }] }), Infinity);
});
