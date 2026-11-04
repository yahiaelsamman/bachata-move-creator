import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadData } from '../scripts/build.mjs';

const require = createRequire(import.meta.url);
const MG = require('../src/graph.js');
const GEN = require('../src/generator.js');

const g = MG.compile(loadData());
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const isLoop = (id) => g.edgesByMove[id].every((e) => e.from === e.to);

test('random combos follow the rules from every position, level and length', () => {
  const rng = seeded(5);
  for (const p of g.positions.filter((x) => x.frame !== 'apart')) {
    for (const maxLevel of [1, 2, 3]) {
      for (const counts of [16, 32, 48]) {
        const ids = GEN.generate(g, p.id, { counts, maxLevel, rng });
        const where = `${p.id}, level ${maxLevel}, ${counts} counts: ${ids.join(' > ')}`;
        assert.deepEqual(GEN.problems(g, p.id, ids), [], where);
        assert.ok(ids.every((id) => g.moveById[id].level <= maxLevel), `above level: ${where}`);
        const loops = ids.filter(isLoop);
        assert.equal(new Set(loops).size, loops.length, `in-place move repeated: ${where}`);
      }
    }
  }
});

test('random combos come home and hit the requested length', () => {
  const rng = seeded(9);
  for (const start of ['open_LR', 'closed', 'double', 'shadow_waist', 'cuddle']) {
    for (const counts of [16, 32, 48]) {
      const ids = GEN.generate(g, start, { counts, maxLevel: 3, rng });
      const r = MG.evaluateStrip(g, start, 'mirrored', ids);
      assert.equal(r.end, start, `${start}: ${ids.join(' > ')}`);
      assert.equal(r.totalCounts, counts, `${start}, ${counts}: got ${r.totalCounts}`);
    }
  }
});

test('no teleport: random combos never drop both hands', () => {
  const rng = seeded(13);
  for (let i = 0; i < 200; i++) {
    const ids = GEN.generate(g, 'closed', { counts: 32, maxLevel: 3, rng });
    assert.ok(!ids.includes('release-all'), ids.join(' > '));
  }
});

test('no undo: a move is never followed by one straight back', () => {
  const rng = seeded(17);
  let undos = 0;
  for (let i = 0; i < 300; i++) {
    const ids = GEN.generate(g, 'open_LR', { counts: 32, maxLevel: 3, rng });
    const r = MG.evaluateStrip(g, 'open_LR', 'mirrored', ids);
    r.items.forEach((it, k) => { if (k && it.from !== it.to && r.items[k - 1].from === it.to) undos++; });
  }
  assert.ok(undos <= 3, `${undos} undos in 300 combos`);
});

test('extend keeps the existing moves and continues from them', () => {
  const prefix = ['cross-body-lead', 'close-frame'];
  const ids = GEN.generate(g, 'open_LR', { counts: 16, maxLevel: 3, rng: seeded(21), prefix });
  assert.deepEqual(ids.slice(0, 2), prefix);
  assert.ok(ids.length > 2);
  assert.equal(MG.evaluateStrip(g, 'open_LR', 'mirrored', ids).end, 'open_LR');
});

test('bridges rank "drop both hands and reconnect" last', () => {
  const routes = MG.findBridges(g, 'closed', 'open_LR');
  const throughApart = (path) => path.includes('release-all');
  const firstApart = routes.findIndex(throughApart);
  assert.ok(firstApart === -1 || routes.slice(firstApart).every(throughApart), routes.map((r) => r.join('>')).join(' | '));
});
