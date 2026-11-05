import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadData } from '../scripts/build.mjs';
import { KNOWN_UNREALISTIC } from './known-issues.mjs';

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

const brokenFrames = (e) => {
  const A = g.posById[e.from], B = g.posById[e.to];
  const allowed = new Set([...R.allowedBehind(A), ...R.allowedBehind(B)]);
  const out = [];
  for (let k = 0; k <= 40; k++) {
    const found = R.problems(M.frameAt(g.moveById[e.move], A, B, k / 40), allowed);
    if (found.length) out.push({ t: k / 40, found });
  }
  return out;
};

test('every frame of every move is physically possible (apart from the known issues)', () => {
  for (const e of moveEdges) {
    if (KNOWN_UNREALISTIC[e.move]) continue;
    const bad = brokenFrames(e);
    assert.deepEqual(bad, [], `${e.move} ${e.from} -> ${e.to} at t=${bad[0] && bad[0].t}: ${JSON.stringify(bad[0] && bad[0].found)}`);
  }
});

test('the known issues are still issues (take a move off the list once it is fixed)', () => {
  for (const id of Object.keys(KNOWN_UNREALISTIC)) {
    assert.ok(g.edgesByMove[id], `${id} is not a move any more`);
    assert.ok(g.edgesByMove[id].some((e) => brokenFrames(e).length), `${id} is realistic now: remove it from test/known-issues.mjs`);
  }
});

test('an arm only folds behind a back with a turn away from it (and unfolds the other way)', () => {
  for (const e of moveEdges) {
    assert.equal(M.foldProblem(g.moveById[e.move], g.posById[e.from], g.posById[e.to]), null, e.move);
  }
  const pos = (arms, hands) => ({ orientation: 'facing', frame: 'semi', hands, crossed: 'none', arms });
  const double = pos('neutral', 'L>R,R>L');
  assert.match(M.foldProblem({ turn: { follower: 360 } }, double, pos('hammerlock_follower_R', 'L>R,R>L')), /needs a left turn/);
  assert.equal(M.foldProblem({ turn: { follower: -360 } }, double, pos('hammerlock_follower_R', 'L>R,R>L')), null);
  assert.match(M.foldProblem({ turn: { follower: 360 } }, pos('hammerlock_follower_L', 'L>R,R>L'), double), /needs a left turn/);
  assert.equal(M.foldProblem({ turn: { leader: 360 } }, double, pos('hammerlock_leader_L', 'L>R,R>L')), null);
});

test("crossed hands: the bottom hand can't go over a head while the top hand stays low", () => {
  // The old crossed-hands hammerlock entry: right over left, the left hands up, the right hands low.
  const move = { name: 'test', turn: { follower: -360 } };
  const from = g.posById.cross_Rtop, to = g.posById.hammerlock_R;
  const allowed = new Set([...R.allowedBehind(from), ...R.allowedBehind(to)]);
  const kinds = [];
  for (let k = 0; k <= 20; k++) kinds.push(...R.problems(M.frameAt(move, from, to, k / 20), allowed).map((p) => p.kind));
  assert.ok(kinds.includes('under'), kinds.join(','));
  // From left over right the left hands are on top: fine.
  const kindsOk = brokenFrames(g.edgesByMove['crossed-hammerlock-entry'][0]).flatMap((b) => b.found.map((f) => f.kind));
  assert.ok(!kindsOk.includes('under'), kindsOk.join(','));
});

test('arms through bodies: a straight arm through the partner is found, one round the side is not', () => {
  const leader = SK.body([0, 0], [0, -1]);
  const follower = SK.body([0, -40], [0, 1]);
  const L = (pts) => ({ leader, follower, arms: [{ who: 'leader', hand: 'R', from: pts[0], via: pts.length > 2 ? pts[1] : null, to: pts[pts.length - 1], h: 0 }] });
  assert.deepEqual(R.problems(L([[20, 0], [-5, -52]])).map((p) => p.kind), ['through']);
  assert.deepEqual(R.problems(L([[20, 0], [27, -40], [5, -50]])), []);
  // Over the head it passes above her.
  const raised = L([[20, 0], [-5, -52]]);
  raised.arms[0].h = 2;
  assert.deepEqual(R.problems(raised).filter((p) => p.kind === 'through'), []);
});

test('hand heights: waist by default, shoulder for a hand on the back, over the head while turning', () => {
  const closed = SK.layout(g.posById.closed);
  assert.equal(closed.arms.find((a) => a.who === 'leader' && a.holds === 'back').h, 1);
  assert.equal(closed.arms.find((a) => a.who === 'leader' && a.holds === 'R').h, 0);
  const e = g.edgesByMove['follower-right-turn'].find((x) => x.from === 'open_LR');
  const mid = M.frameAt(g.moveById[e.move], g.posById[e.from], g.posById[e.to], 0.5);
  assert.ok(mid.arms.find((a) => a.who === 'leader' && a.grip).h >= R.RAISED);
  // In a hammerlock entry the folded hand stays low.
  const h = g.edgesByMove['hammerlock-right-entry-double'][0];
  const f = M.frameAt(g.moveById[h.move], g.posById[h.from], g.posById[h.to], 0.5);
  assert.ok(f.arms.find((a) => a.who === 'follower' && a.hand === 'R').h < 1);
  assert.ok(f.arms.find((a) => a.who === 'follower' && a.hand === 'L').h >= R.RAISED);
  assert.match(SK.drawSVG(mid), /sk-high/);
});

test("a hand behind the leader's neck: the follower's arm is bent, the elbow out to her side", () => {
  for (const id of ['shadow_neck', 'neck_wrap']) {
    const L = SK.layout(g.posById[id]);
    const a = L.arms.find((x) => x.who === 'follower' && x.hand === 'R');
    assert.ok(a.via, id);
    const straight = dist(a.from, a.to);
    assert.ok(dist(a.from, a.via) + dist(a.via, a.to) > straight + 4, `${id}: the arm is bent`);
  }
});

test("cuddle: the leader's right arm goes round her back, the elbow past her far shoulder", () => {
  const L = SK.layout(g.posById.cuddle);
  const a = L.arms.find((x) => x.who === 'leader' && x.hand === 'R');
  assert.ok(a.via && a.viaH === 1);
  const behind = (a.via[0] - L.follower.c[0]) * L.follower.face[0] + (a.via[1] - L.follower.c[1]) * L.follower.face[1];
  assert.ok(behind < 0, 'the elbow is behind her');
});

test('hammerlocks: the folded hand is at the small of her back, reached round her side', () => {
  for (const id of ['hammerlock_R', 'hammerlock_R_double', 'hammerlock_L', 'hammerlock_L_cross']) {
    const p = g.posById[id];
    const L = SK.layout(p);
    const hand = p.arms.endsWith('_R') ? 'R' : 'L';
    const f = L.arms.find((x) => x.who === 'follower' && x.hand === hand);
    const back = (f.to[0] - L.follower.c[0]) * L.follower.face[0] + (f.to[1] - L.follower.c[1]) * L.follower.face[1];
    assert.ok(back < -3, `${id}: the hand is behind her (${back.toFixed(1)})`);
    assert.ok(L.arms.find((x) => x.who === 'leader' && x.holds === hand).via, `${id}: the leader's arm goes round her`);
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
