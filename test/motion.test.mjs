import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadData } from '../scripts/build.mjs';

const require = createRequire(import.meta.url);
const MG = require('../src/graph.js');
const SK = require('../src/sketch.js');
const M = require('../src/motion.js');

const g = MG.compile(loadData());
const moveEdges = g.edges.filter((e) => g.moveById[e.move].kind !== 'compound');
const frame = (e, t) => M.frameAt(g.moveById[e.move], g.posById[e.from], g.posById[e.to], t);
const near = (a, b, eps = 1e-6) => Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
const angle = (v) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;
const move = (id) => g.moveById[id];
const edgeOf = (id, from) => g.edgesByMove[id].find((e) => !from || e.from === from);
/** Arms with coordinates rounded to 6 decimals (a full turn leaves ~1e-14 of float noise). */
const roundArms = (arms) => JSON.parse(JSON.stringify(arms, (k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)));

test('every move starts exactly in its start position and ends exactly in its end position', () => {
  for (const e of moveEdges) {
    const A = SK.layout(g.posById[e.from]);
    const B = SK.layout(g.posById[e.to]);
    const f0 = frame(e, 0);
    const f1 = frame(e, 1);
    const where = `${e.move} ${e.from} -> ${e.to}`;
    assert.ok(near(f0.follower.c, A.follower.c) && near(f0.follower.face, A.follower.face), `start: ${where}`);
    assert.ok(near(f1.follower.c, B.follower.c) && near(f1.follower.face, B.follower.face), `end: ${where}`);
    assert.ok(near(f1.leader.face, B.leader.face), `leader ends facing up: ${where}`);
    // Hands too: the start hold at the start, the end hold at the end.
    assert.deepEqual(roundArms(f0.arms), roundArms(A.arms), `start hold: ${where}`);
    assert.deepEqual(roundArms(f1.arms), roundArms(B.arms), `end hold: ${where}`);
  }
});

test('every frame of every move draws cleanly', () => {
  for (const e of moveEdges) {
    const m = move(e.move);
    const bounds = M.movieBounds(m, g.posById[e.from], g.posById[e.to]);
    for (const t of [0, 0.1, 0.33, 0.5, 0.77, 1]) {
      const svg = M.frameSVG(m, g.posById[e.from], g.posById[e.to], t, bounds);
      assert.ok(svg.startsWith('<svg') && !/NaN|undefined|Infinity/.test(svg), `${e.move} at ${t}`);
    }
  }
});

test('the follower never walks through the leader', () => {
  for (const e of moveEdges) {
    for (let k = 0; k <= 20; k++) {
      const f = frame(e, k / 20);
      const d = Math.hypot(f.follower.c[0] - f.leader.c[0], f.follower.c[1] - f.leader.c[1]);
      assert.ok(d >= 30, `${e.move} ${e.from} -> ${e.to}: ${d.toFixed(1)} at t=${k / 20}`);
    }
  }
});

test('the picture area holds every frame, so nothing is clipped while a move plays', () => {
  for (const e of moveEdges) {
    const m = move(e.move);
    const b = M.movieBounds(m, g.posById[e.from], g.posById[e.to]);
    for (let k = 0; k <= 40; k++) {
      const f = SK.boundsOf(frame(e, k / 40));
      const slack = 6;
      assert.ok(f.top >= b.top - slack && f.bottom <= b.bottom + slack && f.left >= b.left - slack && f.right <= b.right + slack,
        `${e.move} clipped at t=${k / 40}`);
    }
  }
});

test('one picture area for the whole move (it does not jump between frames)', () => {
  const e = edgeOf('cross-body-lead');
  const m = move(e.move);
  const viewBox = (t) => M.frameSVG(m, g.posById[e.from], g.posById[e.to], t).match(/viewBox="([^"]+)"/)[1];
  assert.equal(viewBox(0), viewBox(0.5));
  assert.equal(viewBox(0.5), viewBox(1));
});

test('turn directions are read from names', () => {
  assert.deepEqual(M.turnsOf(move('follower-right-turn')), { follower: 360, leader: 0, free: null });
  assert.deepEqual(M.turnsOf(move('follower-left-turn')), { follower: -360, leader: 0, free: null });
  assert.equal(M.turnsOf(move('follower-double-right-turn')).follower, 720);
  assert.deepEqual(M.turnsOf(move('leader-right-turn')), { follower: 0, leader: 360, free: null });
  assert.equal(M.turnsOf(move('leader-left-turn')).leader, -360);
  assert.equal(M.turnsOf({ name: 'Shadow entry (half left turn, from open)' }).follower, -180);
});

test('hand and arm words do not set the turn direction', () => {
  // "under the LEFT arm" is about the hand; the note says the turn is to the right.
  assert.equal(M.turnsOf(move('shadow-exit-half-turn-right')).follower, 180);
  // "release LEFT" is about letting go, not the direction.
  assert.equal(M.turnsOf({ name: 'Turn (release left)' }).free, 'follower');
  assert.equal(M.turnsOf({ name: 'Turn back to crossed, right over left' }).free, 'follower');
});

test('the lead note gives the direction when the name does not', () => {
  assert.equal(M.turnsOf(move('cuddle-entry')).follower, -360);         // "turns left into the wrap"
  assert.equal(M.turnsOf(move('half-turn-into-shadow')).follower, -180); // "a half turn to the left"
  assert.equal(M.turnsOf({ name: 'Mystery', notes: 'Into a right turn.' }).follower, 360);
  assert.equal(M.turnsOf({ name: 'Mystery', notes: 'Hold the left hand.' }).follower, 0);
});

test('a couple turn changes nothing from the leader\'s point of view', () => {
  assert.deepEqual(M.turnsOf(move('couple-turn')), { follower: 0, leader: 0, free: null });
  const e = edgeOf('couple-turn');
  assert.ok(near(frame(e, 0.5).follower.c, frame(e, 0).follower.c));
});

test('an explicit turn field wins over the name; bad values are ignored', () => {
  assert.deepEqual(M.turnsOf({ name: 'Follower right turn', turn: { follower: -720 } }), { follower: -720, leader: 0, free: null });
  assert.deepEqual(M.turnsOf({ name: 'X', turn: { follower: 'lots', leader: Infinity } }), { follower: 0, leader: 0, free: null });
  assert.deepEqual(M.turnsOf(undefined), { follower: 0, leader: 0, free: null });
  assert.deepEqual(M.turnsOf({}), { follower: 0, leader: 0, free: null });
});

test('a right turn really turns clockwise, a quarter per quarter of the move', () => {
  const e = edgeOf('follower-right-turn', 'open_LR');
  const start = angle(frame(e, 0).follower.face);
  const quarter = angle(frame(e, 0.25).follower.face);
  assert.ok(Math.abs(M.shortest(start, quarter) - 90) < 1e-6, `${start} -> ${quarter}`);
  const left = edgeOf('follower-left-turn', 'open_LR');
  assert.ok(Math.abs(M.shortest(angle(frame(left, 0).follower.face), angle(frame(left, 0.25).follower.face)) + 90) < 1e-6);
});

test('a leader turn on the spot spins the leader; a leader half turn moves the follower round him', () => {
  const spin = edgeOf('leader-right-turn');
  assert.ok(near(frame(spin, 0.5).leader.face, [0, 1], 1e-6), 'leader faces down halfway through the spin');
  const half = edgeOf('leader-shadow-entry');
  const f = frame(half, 0.5);
  assert.ok(near(f.leader.face, [0, -1]), 'the leader keeps facing up in his own view');
  assert.ok(f.follower.c[0] > f.leader.c[0] + 30, 'halfway, the follower is at the leader\'s side');
});

test('the cross body lead takes the follower past the leader\'s right side', () => {
  const f = frame(edgeOf('cross-body-lead'), 0.5);
  assert.ok(f.follower.c[0] > f.leader.c[0] + 30);
});

test('times outside 0..1 are clamped', () => {
  const e = edgeOf('follower-right-turn');
  assert.deepEqual(frame(e, -3), frame(e, 0));
  assert.deepEqual(frame(e, 7), frame(e, 1));
  assert.deepEqual(frame(e, 'soon'), frame(e, 0));
  assert.deepEqual(frame(e, NaN), frame(e, 0));
});

test('positions with unknown attributes still animate', () => {
  const odd = { orientation: 'cartwheel', frame: 'galaxy', hands: 'L>elbow, R>R', crossed: 'knot', arms: 'jazz' };
  const svg = M.frameSVG({ name: 'Odd turn right', counts: 4 }, odd, odd, 0.5);
  assert.ok(svg.startsWith('<svg') && !/NaN|undefined/.test(svg));
});

test('totalRotation keeps the wanted direction and lands on the end facing', () => {
  assert.equal(M.totalRotation(90, 90, 360), 360);
  assert.equal(M.totalRotation(90, 90, -720), -720);
  assert.equal(M.totalRotation(90, -90, -180), -180);
  assert.equal(M.totalRotation(90, -90, 180), 180);
  assert.equal(M.totalRotation(90, -90, 0), 180);   // shortest; exactly opposite counts as +180
  assert.equal(M.shortest(170, -170), 20);
});
