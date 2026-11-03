import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadData } from '../scripts/build.mjs';

const require = createRequire(import.meta.url);
const MG = require('../src/graph.js');
const PM = require('../src/map.js');

test('map layout is deterministic and inside the drawing', () => {
  const g = MG.compile(loadData());
  const a = PM.layoutMap(g);
  const b = PM.layoutMap(g);
  assert.deepEqual(a.nodes, b.nodes);
  for (const [id, n] of Object.entries(a.nodes)) {
    assert.ok(n.x >= 0 && n.x <= a.width && n.y >= 0 && n.y <= a.height, `${id} is off the map`);
  }
});

test('map svg renders with a path and a selection', () => {
  const g = MG.compile(loadData());
  const L = PM.layoutMap(g);
  const svg = PM.mapSVG(g, L, { selected: 'closed', path: [{ from: 'open_LR', to: 'closed' }] });
  assert.ok(!/NaN|undefined/.test(svg));
  assert.ok(svg.includes('mp-path') || svg.includes('mp-in'));
  assert.ok(svg.includes('data-pos="closed"'));
});

test('links group parallel moves and skip in-place ones', () => {
  const g = MG.compile(loadData());
  const links = PM.linksOf(g);
  assert.ok(links.every((l) => l.from !== l.to));
  const lrToClosed = links.find((l) => l.from === 'open_LR' && l.to === 'closed');
  assert.ok(lrToClosed.moves.length >= 2);
});
