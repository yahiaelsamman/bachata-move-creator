import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadData } from '../scripts/build.mjs';

const require = createRequire(import.meta.url);
const MG = require('../src/graph.js');
const M = require('../src/motion.js');
const Rev = require('../src/review.js');
const X = require('../src/mirror.js');

const g = MG.compile(loadData());
const mirrors = X.mirrorMoves(g, M);
const groups = Rev.classify(g, M, mirrors);
const all = ['inplace', 'letgo', 'turns', 'path', 'combos'].flatMap((k) => groups[k]);

test('every move is in exactly one group', () => {
  assert.equal(all.length, g.moves.length);
  assert.equal(new Set(all.map((it) => it.move.id)).size, g.moves.length);
});

test('the groups are what they say', () => {
  assert.ok(groups.letgo.every((it) => it.move.kind === 'adjuster'));
  assert.ok(groups.combos.every((it) => it.move.kind === 'compound'));
  assert.ok(groups.turns.every((it) => it.turn && it.move.kind !== 'adjuster'));
  assert.ok(groups.inplace.every((it) => !it.turn && it.edges.every((e) => e.from === e.to)));
  assert.ok(groups.path.every((it) => !it.turn && it.edges.some((e) => e.from !== e.to)));
  for (const k of ['inplace', 'letgo', 'turns', 'path']) assert.ok(groups[k].length > 5, k);
});

test('turns whose direction was read from words come before the ones set in the data', () => {
  const sources = groups.turns.map((it) => it.turn.source);
  const firstData = sources.indexOf('data');
  assert.ok(firstData > 0);
  assert.ok(sources.slice(firstData).every((s) => s === 'data'));
});

test('turnReading says who turns, which way, how far and where that came from', () => {
  const t = (id) => Rev.turnReading(M, g.moveById[id]);
  assert.deepEqual([t('follower-right-turn').who, t('follower-right-turn').degrees, t('follower-right-turn').source], ['follower', 360, 'name']);
  assert.match(t('follower-left-turn').text, /left, 360°/);
  assert.equal(t('shadow-manton').source, 'data');
  assert.equal(t('shadow-manton').who, 'leader');
  assert.equal(Rev.turnReading(M, { name: 'Basic', notes: 'Steps.' }), null);
  assert.match(Rev.turnReading(M, { name: 'Whirl', turn: { couple: 360 } }).text, /both turn together to the right/);
});

test('holdChange names the hand that lets go, the one that takes hold and the ones that stay', () => {
  const c = Rev.holdChange(g.posById.closed, g.posById.open_LR);
  assert.deepEqual(c.lets, ['your right hand → her back']);
  assert.deepEqual(c.takes, []);
  assert.deepEqual(c.keeps, ['your left hand → her right hand']);
  const d = Rev.holdChange(g.posById.open_LR, g.posById.closed);
  assert.deepEqual(d.takes, ['your right hand → her back']);
  assert.ok(d.other.some((x) => /frame: open → closed/.test(x)));
  const none = Rev.holdChange(g.posById.double, g.posById.double);
  assert.deepEqual([none.lets, none.takes, none.other], [[], [], []]);
  assert.deepEqual(Rev.holdChange(undefined, undefined), { lets: [], takes: [], keeps: [], other: [] });
});

test('shownTurns measures what the animation really turns', () => {
  const item = (id) => groups.turns.find((it) => it.move.id === id);
  assert.deepEqual(item('follower-right-turn').shown, { follower: 360, leader: 0 });
  assert.deepEqual(item('follower-left-turn').shown, { follower: -360, leader: 0 });
  assert.equal(Rev.shownText({ follower: 360, leader: 0 }), 'follower right 360°');
  assert.equal(Rev.shownText({ follower: 0, leader: -180 }), 'leader left 180°');
  assert.equal(Rev.shownText({ follower: 0, leader: 0 }), 'nobody turns');
});

test('mirror images are covered by one move of the pair', () => {
  const items = ['letgo', 'turns', 'path'].flatMap((k) => groups[k]);
  const covered = items.filter((it) => it.mirrorOf);
  assert.ok(covered.length >= 15, `${covered.length}`);
  const byId = new Map(items.map((it) => [it.move.id, it]));
  for (const it of covered) {
    const first = byId.get(it.mirrorOf);
    assert.ok(first && !first.mirrorOf, it.move.id);
    assert.ok(first.mirrors.includes(it.move.id));
    assert.ok(mirrors[first.move.id].includes(it.move.id));
  }
  // Nothing is both a first move and covered by another.
  assert.ok(items.every((it) => !(it.mirrorOf && it.mirrors && it.mirrors.length)));
  // Without mirror information every move is its own.
  assert.ok(['letgo', 'turns', 'path'].flatMap((k) => Rev.classify(g, M)[k]).every((it) => !it.mirrorOf));
});
