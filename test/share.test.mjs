import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import yaml from 'js-yaml';

const require = createRequire(import.meta.url);
const S = require('../src/share.js');

const vuelta = { id: 'my-vuelta', name: 'Vuelta ñ é', kind: 'move', level: 2, from: ['open_LR', 'closed'], to: 'same', counts: 4, notes: 'Lead with the left — «suave»' };
const catchIt = { id: 'my-x', name: 'X', kind: 'adjuster', level: 1, from: ['open_LR'], to: 'open_RR', counts: 0 };
// Made by the encoder the app shipped with before src/share.js existed: links people already sent.
const OLD_LINK_CUSTOM = 'W3siaWQiOiJteS12dWVsdGEiLCJuYW1lIjoiVnVlbHRhIMOxIMOpIiwia2luZCI6Im1vdmUiLCJsZXZlbCI6MiwiZnJvbSI6WyJvcGVuX0xSIiwiY2xvc2VkIl0sInRvIjoic2FtZSIsImNvdW50cyI6NCwibm90ZXMiOiJMZWFkIHdpdGggdGhlIGxlZnQg4oCUIMKrc3VhdmXCuyJ9LHsiaWQiOiJteS14IiwibmFtZSI6IlgiLCJraW5kIjoiYWRqdXN0ZXIiLCJsZXZlbCI6MSwiZnJvbSI6WyJvcGVuX0xSIl0sInRvIjoib3Blbl9SUiIsImNvdW50cyI6MH1d';
const encodeRaw = (list) => Buffer.from(JSON.stringify(list), 'utf8').toString('base64url');

test('own moves survive a round trip, including non-ASCII names', () => {
  assert.deepEqual(S.decodeMoves(S.encodeMoves([vuelta, catchIt])), [vuelta, catchIt]);
});

test('links made by the old encoder still decode, byte for byte', () => {
  assert.equal(S.encodeMoves([vuelta, catchIt]), OLD_LINK_CUSTOM);
  assert.deepEqual(S.decodeMoves(OLD_LINK_CUSTOM), [vuelta, catchIt]);
});

test('decodeMoves drops anything that is not a valid own move', () => {
  const bad = [
    { ...catchIt, id: 'cross-body-lead' },
    { ...catchIt, kind: 'compound' },
    { ...catchIt, counts: 65 },
    { ...catchIt, notes: 'x'.repeat(201) },
    { ...catchIt, level: 4 },
    null,
  ];
  assert.deepEqual(S.decodeMoves(encodeRaw([...bad, catchIt])), [catchIt]);
  assert.deepEqual(S.decodeMoves(encodeRaw({ not: 'a list' })), []);
  assert.deepEqual(S.decodeMoves('%%%not base64'), []);
  assert.deepEqual(S.decodeMoves(''), []);
  assert.deepEqual(S.decodeMoves(encodeRaw([{ ...catchIt, extra: 'dropped' }])), [catchIt]);
});

test('parseHash reads a combo, or returns null when there is none', () => {
  assert.equal(S.parseHash(''), null);
  assert.equal(S.parseHash('#foo=1'), null);
  assert.deepEqual(S.parseHash('#start=closed&weight=parallel&moves=a,b,,c'), {
    startPos: 'closed', startWeight: 'parallel', strip: ['a', 'b', 'c'], custom: [],
  });
  assert.deepEqual(S.parseHash('#moves=a&custom=' + OLD_LINK_CUSTOM).custom, [vuelta, catchIt]);
});

test('buildHash spells out own compounds and carries only the own moves it uses', () => {
  const hash = S.buildHash({
    startPos: 'open_LR', startWeight: 'mirrored',
    strip: ['my-combo', 'dip'],
    myMoves: [vuelta, catchIt],
    myCompounds: [{ id: 'my-combo', name: 'C', kind: 'compound', sequence: ['cross-body-lead', 'my-vuelta'] }],
  });
  assert.ok(hash.startsWith('#start=open_LR&weight=mirrored&moves=cross-body-lead,my-vuelta,dip&custom='));
  assert.deepEqual(S.parseHash(hash).custom, [vuelta]);
  assert.equal(S.buildHash({ startPos: 'closed', startWeight: 'parallel', strip: [] }), '#start=closed&weight=parallel&moves=');
});

test('uniqueId makes a "my-" slug and counts up when it is taken', () => {
  const taken = new Set(['my-hair-comb', 'my-hair-comb-2', 'my-compound']);
  const isTaken = (id) => taken.has(id);
  assert.equal(S.uniqueId('Vuelta ñ', isTaken, 'move'), 'my-vuelta');
  assert.equal(S.uniqueId('Hair comb!', isTaken, 'move'), 'my-hair-comb-3');
  assert.equal(S.uniqueId('¡¿?!', isTaken, 'move'), 'my-move');
  assert.equal(S.uniqueId('***', isTaken, 'compound'), 'my-compound-2'); // used to be "my--2"
});

test('YAML exports parse back to the same move', () => {
  assert.deepEqual(yaml.load(S.moveYaml(vuelta)), [vuelta]);
  assert.deepEqual(yaml.load(S.moveYaml(catchIt)), [catchIt]);
  const c = { id: 'my-combo', name: 'Combo "one"', sequence: ['a', 'b'] };
  assert.deepEqual(yaml.load(S.compoundYaml(c)), [{ ...c, kind: 'compound' }]);
});

test('comboText lists one move per line with its beats and ends with the link', () => {
  const result = {
    items: [{ move: { name: 'Cross body lead', counts: 8 }, beat: 5 }, { move: { name: 'Catch', counts: 0 }, beat: 5 }, { missing: true }],
    totalCounts: 8,
  };
  const beatRange = require('../src/graph.js').beatRange;
  assert.equal(S.comboText(result, 'Open', 'Closed', 'https://x/#m', beatRange),
    'Bachata combo (8 counts), starting in Open:\n1. Cross body lead (8 ct, beats 5-8, 1-4)\n2. Catch (on the fly)\nEnds in Closed.\nhttps://x/#m');
});

test('beatRange names the beats a move covers', () => {
  const { beatRange } = require('../src/graph.js');
  assert.equal(beatRange(1, 8), '1-8');
  assert.equal(beatRange(5, 8), '5-8, 1-4');
  assert.equal(beatRange(5, 4), '5-8');
  assert.equal(beatRange(1, 16), '1-8, 1-8');
});
