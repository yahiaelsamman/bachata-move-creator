// The page's files: everything index.html loads exists and is cached for offline use by sw.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const web = new URL('../web/', import.meta.url);
const html = readFileSync(new URL('index.html', web), 'utf8');
const sw = readFileSync(new URL('sw.js', web), 'utf8');
const assets = [...sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const loaded = [
  ...[...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]),
  ...[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]),
];

test('every script and stylesheet in index.html exists and is cached by sw.js', () => {
  assert.ok(loaded.length > 5);
  for (const src of loaded) {
    assert.ok(existsSync(new URL(src, web)), `${src} does not exist`);
    assert.ok(assets.includes(src), `${src} is missing from ASSETS in web/sw.js`);
  }
});

test('every file sw.js caches exists', () => {
  for (const a of assets) assert.ok(existsSync(new URL(a, web)), `${a} in web/sw.js does not exist`);
});
