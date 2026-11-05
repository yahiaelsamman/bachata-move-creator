// Counts: one convention everywhere. A move is a module of 4 or 8 counts written in its own counts;
// `on` (1 or 5) says which half of the phrase a 4-count turn is led on, by the footwork.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadData } from '../scripts/build.mjs';

const require = createRequire(import.meta.url);
const MG = require('../src/graph.js');
const M = require('../src/motion.js');
const G = require('../src/generator.js');

const g = MG.compile(loadData());
const moves = g.moves.filter((m) => m.kind !== 'compound');

test('"on" is 1 or 5, only on moves of 4 counts, and is reported as an error otherwise', () => {
  for (const m of moves) if (m.on !== undefined) assert.ok(m.on === 1 || m.on === 5, m.id);
  assert.ok(moves.filter((m) => m.on).length > 30);
  const bad = MG.compile({ positions: loadData().positions, moves: [
    { id: 'a', name: 'A', from: 'open_LR', counts: 4, on: 3 },
    { id: 'b', name: 'B', from: 'open_LR', counts: 8, on: 5 },
  ] });
  assert.equal(bad.errors.filter((e) => /"on"/.test(e)).length, 2);
});

test('a turn is led where the dancer steps onto the foot of the turn', () => {
  // follower: right turn on 1, left turn on 5; leader: left turn on 1, right turn on 5
  for (const m of moves) {
    if (!m.on) continue;
    const t = M.turnsOf(m);
    if (t.couple || t.free || (t.follower && t.leader) || !(t.follower || t.leader)) continue;
    const who = t.follower ? 'follower' : 'leader';
    const right = t[who] > 0;
    const expected = who === 'follower' ? (right ? 1 : 5) : (right ? 5 : 1);
    assert.equal(m.on, expected, `${m.id}: the ${who} turns ${right ? 'right' : 'left'}`);
  }
  const on = (id) => g.moveById[id].on;
  assert.deepEqual([on('follower-right-turn'), on('follower-left-turn'), on('leader-left-turn'), on('leader-right-turn')], [1, 5, 1, 5]);
  assert.equal(on('left-turn-into-closed'), 5);
});

test('every 4-count turn in the data has its half, so none is left to guess', () => {
  for (const m of moves) {
    if (m.kind !== 'move' || m.counts !== 4) continue;
    const t = M.turnsOf(m);
    if (t.couple || t.free || (t.follower && t.leader) || !(t.follower || t.leader)) continue;
    assert.ok(m.on, `${m.id} turns but has no "on"`);
  }
});

test('notes of 4-count moves count 1-4 in the move itself, never 5-8', () => {
  const standsForACount = /\b(?:on|tap|and|then|at|by)\s+[5-8]\b|\b[5-8]-[5-8]\b|\b[5-8]-and\b/i;
  for (const m of moves) {
    if (m.counts !== 4 || !m.notes) continue;
    assert.ok(!standsForACount.test(m.notes.replace(/\bover 8 counts\b/gi, '')), `${m.id}: ${m.notes}`);
  }
});

test('the strip says when a turn is on the wrong half, and not when it is right', () => {
  const left = 'follower-left-turn';                       // led on 5
  const onFirst = MG.evaluateStrip(g, 'open_LR', 'mirrored', [left]).items[0];
  const onFifth = MG.evaluateStrip(g, 'open_LR', 'mirrored', ['basic', left]).items[1];
  assert.equal(onFirst.onWarn, true);
  assert.equal(onFifth.onWarn, false);
  assert.equal(onFifth.beat, 5);
  const right = MG.evaluateStrip(g, 'open_LR', 'mirrored', ['follower-right-turn']).items[0];
  assert.equal(right.onWarn, false);
  assert.equal(MG.evaluateStrip(g, 'open_LR', 'mirrored', ['basic']).items[0].onWarn, false);
});

test('random combos almost always lead every turn on its own half', () => {
  let seed = 11;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let combos = 0, flagged = 0;
  for (const p of g.positions) for (const counts of [16, 32]) for (let i = 0; i < 10; i++) {
    const ids = G.generate(g, p.id, { counts, rng });
    combos++;
    if (MG.evaluateStrip(g, p.id, 'mirrored', ids).items.some((it) => it.onWarn)) flagged++;
  }
  assert.ok(flagged / combos < 0.08, `${flagged} of ${combos} combos have a turn on the wrong half`);
});
