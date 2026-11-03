import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { loadData } from '../scripts/build.mjs';

const require = createRequire(import.meta.url);
const MG = require('../src/graph.js');

/** Deterministic random numbers for repeatable tests. */
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

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
  const d = tiny();
  d.moves.push({ id: 'two', name: 'Two', kind: 'styling', from: 'any', counts: 2 });
  const g2 = MG.compile(d);
  const r = MG.evaluateStrip(g2, 'open', 'mirrored', ['two', 'turn']);
  assert.equal(r.items[1].broken, false);
  assert.equal(r.items[1].timingWarn, true);
});

test('bridges find the shortest reconnection', () => {
  const g = MG.compile(tiny());
  assert.deepEqual(MG.findBridges(g, 'open', 'neck'), [['close', 'neck']]);
  assert.deepEqual(MG.findBridges(g, 'open', 'open'), [[]]);
});

test('transitions change position; loops stay in place; compounds are neither', () => {
  const g = MG.compile(tiny());
  const edge = (move, from) => g.edgesByMove[move].find((e) => e.from === from);
  assert.ok(MG.isTransition(g, edge('close', 'open')));
  assert.ok(!MG.isTransition(g, edge('basic', 'open')));
  assert.ok(!MG.isTransition(g, edge('combo', 'open')));
  assert.deepEqual(MG.loopMoves(g, 'open').sort(), ['basic', 'turn']);
  assert.deepEqual(g.health.find((h) => h.id === 'closed'), { id: 'closed', in: 1, out: 1, thin: true });
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
  const rng = seeded(7);
  for (const p of g.positions) {
    for (let i = 0; i < 20; i++) {
      const ids = MG.randomCombo(g, p.id, { steps: 4, rng });
      const r = MG.evaluateStrip(g, p.id, 'mirrored', ids);
      assert.ok(r.items.every((it) => !it.broken), `broken combo from ${p.id}`);
      assert.equal(r.end, p.id, `combo from ${p.id} did not return: ${ids.join(' > ')}`);
    }
  }
});

test('practice steps fold 0-count moves into their neighbours', () => {
  // practice.js is browser-only; load it with a minimal window shim.
  const win = {};
  new Function('window', 'localStorage', readFileSync(new URL('../web/practice.js', import.meta.url), 'utf8'))(win, { getItem: () => null, setItem() {} });
  const g = MG.compile(loadData());
  const r = MG.evaluateStrip(g, 'open_LR', 'mirrored', ['cross-body-lead', 'catch-second-hand', 'cuddle-entry', 'release-all']);
  const steps = win.Practice._buildSteps(r.items);
  assert.equal(steps.length, 2);
  assert.deepEqual(steps[1].extras.map((x) => x.id), ['catch-second-hand']);
  assert.deepEqual(steps[1].after.map((x) => x.id), ['release-all']);
});

test('levels: compounds take their hardest part, beginner combos stay beginner', () => {
  const g = MG.compile(loadData());
  assert.equal(g.moveById['cuddle-combo'].level, 2); // cuddle entry is intermediate
  assert.ok(g.moves.every((m) => [1, 2, 3].includes(m.level)));
  const rng = seeded(11);
  for (let i = 0; i < 50; i++) {
    const ids = MG.randomCombo(g, 'open_LR', { steps: 4, rng, maxLevel: 1 });
    assert.ok(ids.every((id) => g.moveById[id].level === 1), ids.join(' > '));
  }
});

test('invalid levels are reported', () => {
  const g = MG.compile({ positions: [{ id: 'a', name: 'a', orientation: 'facing', frame: 'open', hands: 'L>R', crossed: 'none', arms: 'neutral' }],
    moves: [{ id: 'x', name: 'X', from: 'any', counts: 4, level: 5 }] });
  assert.ok(g.errors.some((e) => e.includes('level 5')));
});

test('weight: entering a same-direction hold sets parallel, leaving it sets mirrored', () => {
  const g = MG.compile(loadData());
  const sameDir = (p) => ['shadow', 'reverse_shadow', 'side_by_side_R', 'side_by_side_L'].includes(g.posById[p].orientation);
  for (const e of g.edges) {
    const m = g.moveById[e.move];
    if (m.kind === 'compound' || e.from === e.to) continue;
    const w = g.weightOf(m.id);
    if (!sameDir(e.from) && sameDir(e.to)) assert.equal(w.to, 'parallel', `${m.id} (${e.from} -> ${e.to})`);
    if (sameDir(e.from) && !sameDir(e.to) && g.posById[e.to].frame !== 'apart') assert.equal(w.to, 'mirrored', `${m.id} (${e.from} -> ${e.to})`);
  }
});

test('the "Suggest a move" issue form lists every position', () => {
  const form = readFileSync(new URL('../.github/ISSUE_TEMPLATE/new-move.yml', import.meta.url), 'utf8');
  for (const p of loadData().positions) assert.ok(form.includes(`(${p.id})`), `${p.id} missing from the issue form`);
});
