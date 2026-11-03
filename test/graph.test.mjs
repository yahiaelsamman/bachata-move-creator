import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { loadData } from '../scripts/build.mjs';

const require = createRequire(import.meta.url);
const MG = require('../src/graph.js');

const P = (id, attrs = {}) => ({
  id, name: id, orientation: 'facing', frame: 'open', hands: 'L>R', crossed: 'none', arms: 'neutral', ...attrs,
});
const tiny = () => ({
  positions: [
    P('open'),
    P('double', { hands: 'R>L, L>R' }),
    P('closed', { frame: 'closed', hands: 'L>R,R>back' }),
    P('neck', { frame: 'closed', hands: 'R>back', arms: 'neck' }),
  ],
  moves: [
    { id: 'basic', name: 'Basic', kind: 'styling', from: 'any', counts: 4 },
    { id: 'turn', name: 'Turn', from: 'open', counts: 4 },
    { id: 'catch', name: 'Catch', kind: 'adjuster', from: 'open', to: 'double', counts: 0 },
    { id: 'close', name: 'Close', kind: 'adjuster', from: 'open', to: 'closed', counts: 4 },
    { id: 'neck', name: 'Hand to neck', kind: 'adjuster', from: { frame: 'closed' }, to: { hands: 'R>back', arms: 'neck' }, counts: 4 },
    { id: 'combo', name: 'Combo', kind: 'compound', sequence: ['turn', 'close'] },
  ],
});

test('the real data has no errors or warnings', () => {
  const g = MG.compile(loadData());
  assert.deepEqual(g.errors, []);
  assert.deepEqual(g.warnings, []);
});

test('web/data.js is up to date with data/*.yaml (run npm run build)', () => {
  const src = readFileSync(new URL('../web/data.js', import.meta.url), 'utf8');
  const built = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));
  assert.deepEqual(built, loadData());
});

test('every position can be reached and left', () => {
  const g = MG.compile(loadData());
  for (const h of g.health) {
    assert.ok(h.in > 0 && h.out > 0, `${h.id} is a dead end (in ${h.in}, out ${h.out})`);
  }
});

test('hands are order-insensitive', () => {
  assert.equal(MG.canonHands('R>L, L>R'), MG.canonHands('L>R,R>L'));
});

test('patterns: any, id, list and attributes', () => {
  const p = P('open');
  assert.ok(MG.matchPattern(p, 'any'));
  assert.ok(MG.matchPattern(p, 'open'));
  assert.ok(MG.matchPattern(p, ['x', 'open']));
  assert.ok(MG.matchPattern(p, { frame: ['closed', 'open'] }));
  assert.ok(!MG.matchPattern(p, { frame: 'closed' }));
});

test('compile expands rules into concrete edges', () => {
  const g = MG.compile(tiny());
  assert.deepEqual(g.errors, []);
  assert.equal(g.edgesByMove.basic.length, 4); // one self-loop per position
  // {frame: closed} matches both closed positions; the change lands on a known node
  assert.deepEqual(g.edgesByMove.neck, [
    { move: 'neck', from: 'closed', to: 'neck' },
    { move: 'neck', from: 'neck', to: 'neck' },
  ]);
  assert.deepEqual(g.edgesByMove.combo, [{ move: 'combo', from: 'open', to: 'closed' }]);
  assert.equal(g.moveById.combo.counts, 8);
});

test('duplicate positions and dangling changes are errors', () => {
  const d = tiny();
  d.positions.push(P('open-again'));
  d.moves.push({ id: 'bad', name: 'Bad', from: 'open', to: { arms: 'nowhere' }, counts: 4 });
  const g = MG.compile(d);
  assert.ok(g.errors.some((e) => e.includes('identical attributes')));
  assert.ok(g.errors.some((e) => e.includes('"bad"')));
});

test('compounds are live: editing a part can break them', () => {
  const d = tiny();
  d.moves.find((m) => m.id === 'close').to = 'double';
  d.moves.find((m) => m.id === 'close').from = 'double';
  const g = MG.compile(d);
  assert.ok(g.errors.some((e) => e.includes('Compound "combo" is broken')));
});

test('strip evaluation tracks position, counts and breaks', () => {
  const g = MG.compile(tiny());
  const r = MG.evaluateStrip(g, 'open', 'mirrored', ['turn', 'close', 'turn']);
  assert.equal(r.items[1].to, 'closed');
  assert.equal(r.items[2].broken, true); // a turn can't start from closed
  assert.equal(r.items[2].expected, 'closed');
  assert.equal(r.totalCounts, 12);
  assert.equal(r.items[2].beat, 1);
});

test('timing is a soft warning, not a break', () => {
  const g = MG.compile(tiny());
  const d = tiny();
  d.moves.push({ id: 'two', name: 'Two', kind: 'styling', from: 'any', counts: 2 });
  const g2 = MG.compile(d);
  const r = MG.evaluateStrip(g2, 'open', 'mirrored', ['two', 'turn']);
  assert.equal(r.items[1].broken, false);
  assert.equal(r.items[1].timingWarn, true);
  assert.ok(g);
});

test('bridges find the shortest reconnection', () => {
  const g = MG.compile(tiny());
  assert.deepEqual(MG.findBridges(g, 'open', 'neck'), [['close', 'neck']]);
  assert.deepEqual(MG.findBridges(g, 'open', 'open'), [[]]);
});

test('alternatives are parallel edges', () => {
  const g = MG.compile(tiny());
  assert.deepEqual(MG.alternatives(g, 'open', 'open', 'turn'), ['basic']);
});

test('weight is soft and carried along the strip', () => {
  const d = tiny();
  d.moves.push({ id: 'shadowish', name: 'S', kind: 'styling', from: 'any', counts: 4, weight: { from: 'parallel' } });
  const g = MG.compile(d);
  const r = MG.evaluateStrip(g, 'open', 'mirrored', ['shadowish']);
  assert.equal(r.items[0].weightWarn, true);
  assert.equal(r.items[0].broken, false);
});

test('random combos come back to where they started', () => {
  const g = MG.compile(loadData());
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const p of g.positions) {
    for (let i = 0; i < 20; i++) {
      const ids = MG.randomCombo(g, p.id, { steps: 4, rng });
      const r = MG.evaluateStrip(g, p.id, 'mirrored', ids);
      assert.ok(r.items.every((it) => !it.broken), `broken combo from ${p.id}`);
      assert.equal(r.end, p.id, `combo from ${p.id} did not return: ${ids.join(' > ')}`);
    }
  }
});
