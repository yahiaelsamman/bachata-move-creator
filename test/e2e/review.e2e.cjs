// The move review page: every move is listed once, no broken text, marks and notes work and survive a reload.
// Run: npm run e2e
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');
const PAGE = 'file://' + path.resolve(__dirname, '../../web/review.html');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  p.on('dialog', (d) => d.accept());
  await p.goto(PAGE); await p.evaluate(() => localStorage.clear()); await p.reload();

  const rows = await p.locator('table.rv tbody tr').count();
  const moves = await p.evaluate(() => window.BACHATA_DATA.moves.filter((m) => m.kind !== 'compound').length);
  assert.equal(rows, moves, 'one row per move (combo blocks play their parts)');
  assert.equal(await p.locator('text=[object').count(), 0, 'no broken text');
  assert.equal(await p.locator('text=undefined').count(), 0);
  assert.ok(await p.locator('#sec-turns .rv-strip svg').count() > 100, 'turns have filmstrips');
  assert.match(await p.textContent('#rv-progress'), /^0 of \d+ checked/);

  // Mark: a right, a wrong with a note, and a section in one go.
  const turns = p.locator('#sec-turns table.rv tbody tr');
  await turns.nth(0).locator('button').nth(0).click();
  await turns.nth(1).locator('button').nth(1).click();
  await turns.nth(1).locator('input').fill('wrong way round');
  await p.locator('#sec-letgo .rv-tools button').click();
  const letgo = await p.locator('#sec-letgo table.rv tbody tr').count();
  await p.waitForFunction((n) => new RegExp(`^${n + 2} of \\d+ checked · ${n + 1} right · 1 wrong`).test(document.getElementById('rv-progress').textContent), letgo, { timeout: 10000 });
  await p.click('#rv-copy');
  const text = await p.inputValue('#rv-text');
  assert.match(text, /^Move review: 1 wrong, \d+ right/);
  assert.match(text, /- \[Turns\] .+\(.+\): wrong way round/);

  // Marks stay after a reload; a second click on a mark clears it; the reset button clears everything.
  await p.reload();
  assert.match(await p.textContent('#rv-progress'), new RegExp(`${letgo + 1} right · 1 wrong`));
  await p.locator('#sec-turns table.rv tbody tr').nth(0).locator('button').nth(0).click();
  assert.match(await p.textContent('#rv-progress'), new RegExp(`${letgo} right · 1 wrong`));
  await p.click('#rv-reset');
  assert.match(await p.textContent('#rv-progress'), /^0 of \d+ checked · 0 right · 0 wrong/);

  // Other starts of a move are drawn when opened.
  const more = p.locator('#sec-turns details.rv-more').first();
  await more.locator('summary').click();
  await p.waitForFunction(() => document.querySelector('#sec-turns details.rv-more').querySelectorAll('svg').length > 5, null, { timeout: 10000 });

  assert.deepEqual(errs, []);
  console.log('REVIEW PAGE OK');
  await b.close();
})().catch((e) => { console.error('REVIEW PAGE FAILED:', e.message); process.exit(1); });
