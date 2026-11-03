import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadData } from '../scripts/build.mjs';

const require = createRequire(import.meta.url);
const SK = require('../src/sketch.js');

test('every position renders a clean leader-view sketch', () => {
  for (const p of loadData().positions) {
    const svg = SK.sketchSVG(p, { title: p.name });
    assert.ok(svg.startsWith('<svg'), p.id);
    assert.ok(!/NaN|undefined|Infinity/.test(svg), `${p.id} has a broken number`);
    assert.match(SK.describe(p), /^Follower /);
  }
});

test('crossed hands draw the top hand last', () => {
  const base = { orientation: 'facing', frame: 'open', hands: 'L>L,R>R', arms: 'neutral' };
  for (const [crossed, top] of [['leader_R_over_L', 'R'], ['leader_L_over_R', 'L']]) {
    const arms = SK.layout({ ...base, crossed }).arms.filter((a) => a.who === 'leader');
    assert.equal(arms[arms.length - 1].hand, top);
  }
});

test('titles are escaped', () => {
  const svg = SK.sketchSVG({ orientation: 'facing', frame: 'open', hands: '', arms: 'neutral' }, { title: '<b>&' });
  assert.ok(svg.includes('&lt;b&gt;&amp;'));
});
