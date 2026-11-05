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

test('the hub puts every position on a ring once, neighbours inside', () => {
  const g = MG.compile(loadData());
  const full = PM.layoutMap(g);
  for (const p of g.positions) {
    const hub = PM.layoutHub(g, full, p.id);
    const ids = [...hub.ring1, ...hub.ring2].map((n) => n.id);
    assert.equal(ids.length, g.positions.length - 1, p.id);
    assert.equal(new Set(ids).size, ids.length, p.id);
    assert.ok(!ids.includes(p.id));
    for (const n of hub.ring1) {
      const linked = g.edges.some((e) => MG.isTransition(g, e) && ((e.from === p.id && e.to === n.id) || (e.to === p.id && e.from === n.id)));
      assert.ok(linked && (n.move || n.adjuster), `${p.id} - ${n.id}`);
    }
  }
});

test('hub and overview svg: stations, spokes and dots', () => {
  const g = MG.compile(loadData());
  const full = PM.layoutMap(g);
  const hub = PM.layoutHub(g, full, 'open_LR');
  const svg = PM.hubSVG(g, hub, { end: 'closed', link: 'closed' });
  assert.ok(!/NaN|undefined/.test(svg));
  assert.equal((svg.match(/data-pos=/g) || []).length, g.positions.length);
  assert.ok(svg.includes('data-link="open_LR&gt;closed"'));
  assert.ok(svg.includes('hub-adj'), 'adjusters are drawn dotted');
  const ov = PM.overviewSVG(g, full, 'open_LR');
  assert.ok(!/NaN|undefined/.test(ov));
  assert.equal((ov.match(/data-center=/g) || []).length, g.positions.length);
  assert.ok(!ov.includes('data-pos='), 'overview dots must not clash with the hub stations');
});

test('links group parallel moves and skip in-place ones', () => {
  const g = MG.compile(loadData());
  const links = PM.linksOf(g);
  assert.ok(links.every((l) => l.from !== l.to));
  const lrToClosed = links.find((l) => l.from === 'open_LR' && l.to === 'closed');
  assert.ok(lrToClosed.moves.length >= 2);
});
