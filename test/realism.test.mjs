import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadData } from '../scripts/build.mjs';

const require = createRequire(import.meta.url);
const MG = require('../src/graph.js');
const SK = require('../src/sketch.js');
const M = require('../src/motion.js');
const R = require('../src/reach.js');

const g = MG.compile(loadData());
const moveEdges = g.edges.filter((e) => g.moveById[e.move].kind !== 'compound');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('every position is physically possible: no overlap, arms within reach, no hand behind its own back', () => {
  for (const p of g.positions) {
    assert.deepEqual(R.problems(SK.layout(p), R.allowedBehind(p)), [], p.id);
  }
});

test('every frame of every move is physically possible', () => {
  for (const e of moveEdges) {
    const A = g.posById[e.from], B = g.posById[e.to];
    const allowed = new Set([...R.allowedBehind(A), ...R.allowedBehind(B)]);
    for (let k = 0; k <= 40; k++) {
      const found = R.problems(M.frameAt(g.moveById[e.move], A, B, k / 40), allowed);
      assert.deepEqual(found, [], `${e.move} ${e.from} -> ${e.to} at t=${k / 40}`);
    }
  }
});

test('turning under the arm: halfway through, the joined hand is up over the follower\'s head', () => {
  const e = g.edgesByMove['follower-right-turn'].find((x) => x.from === 'open_LR');
  const f = M.frameAt(g.moveById[e.move], g.posById[e.from], g.posById[e.to], 0.5);
  const grip = f.arms.find((a) => a.who === 'leader' && a.grip).to;
  assert.ok(dist(grip, f.follower.c) < 30, `grip ${grip} is ${dist(grip, f.follower.c).toFixed(1)} from her head`);
});

test('in shadow, the joined hands are at the follower\'s sides, left hand on the left', () => {
  const L = SK.layout(g.posById.shadow);
  const grip = (hand) => L.arms.find((a) => a.who === 'follower' && a.hand === hand).to;
  assert.ok(grip('L')[0] < L.follower.c[0] - 10 && grip('R')[0] > L.follower.c[0] + 10);
});

test("in the leader's shadow, the leader's arms go out to the sides, not behind", () => {
  const L = SK.layout(g.posById.leader_shadow);
  for (const a of L.arms.filter((x) => x.who === 'leader')) {
    const dir = [a.to[0] - a.from[0], a.to[1] - a.from[1]];
    const cos = (dir[0] * L.leader.face[0] + dir[1] * L.leader.face[1]) / Math.hypot(...dir);
    assert.ok(cos >= R.BEHIND - 1e-6, `leader ${a.hand} points back (${cos.toFixed(2)})`);
  }
});

test('fitGrip: the grip is within both arms and in front of both shoulder lines', () => {
  const a = { shoulder: [0, 0], face: [0, -1], hand: 'L' };
  const b = { shoulder: [0, -150], face: [0, 1], hand: 'R' };          // too far apart to touch
  const p = R.fitGrip(a, b, [0, -75]);
  assert.ok(dist(p, a.shoulder) <= R.ARM + 1e-6 || dist(p, b.shoulder) <= R.ARM + 1e-6);
  const behind = R.fitGrip(a, { shoulder: [10, 30], face: [0, -1], hand: 'R' }, [5, 20]);   // wanted point is behind a
  const dir = [behind[0] - a.shoulder[0], behind[1] - a.shoulder[1]];
  assert.ok((dir[0] * a.face[0] + dir[1] * a.face[1]) / Math.hypot(...dir) >= R.BEHIND - 1e-6);
  assert.ok(behind[0] < 0, 'a left hand swings to the left side');
});

test('fitGrip leaves a grip that is already fine where it is', () => {
  const a = { shoulder: [0, 0], face: [0, -1], hand: 'L' };
  const b = { shoulder: [0, -80], face: [0, 1], hand: 'R' };
  assert.deepEqual(R.fitGrip(a, b, [0, -40]), [0, -40]);
});

test('shortenAround keeps a hand going round a body to arm length', () => {
  const r = R.shortenAround([0, 0], [40, 0], [40, 60]);
  assert.ok(Math.abs(dist([0, 0], r.via) + dist(r.via, r.to) - R.ARM) < 1e-6);
  const near = R.shortenAround([0, 0], [10, 0], [10, 10]);
  assert.deepEqual(near.to, [10, 10]);
});

test('bodies: overlap is found and separate() pushes the follower out', () => {
  const leader = SK.body([0, 0], [0, -1]);
  const tooClose = SK.body([0, -6], [0, 1]);
  assert.ok(R.bodiesOverlap(leader, tooClose));
  const moved = R.separate(leader, tooClose, SK.body);
  assert.ok(!R.bodiesOverlap(leader, moved) && moved.c[1] < tooClose.c[1]);
  const fine = SK.body([0, -36], [0, 1]);
  assert.equal(R.separate(leader, fine, SK.body), fine);
});

test('allowedBehind: hammerlocks and the reach back to the leader\'s neck', () => {
  assert.deepEqual([...R.allowedBehind({ arms: 'hammerlock_follower_R' })], ['followerR']);
  assert.deepEqual([...R.allowedBehind({ arms: 'hammerlock_leader_L' })], ['leaderL']);
  assert.deepEqual([...R.allowedBehind({ arms: 'follower_R_behind_leader_neck' })], ['followerR']);
  assert.deepEqual([...R.allowedBehind({ arms: 'neutral' })], []);
  assert.deepEqual([...R.allowedBehind(undefined)], []);
});
