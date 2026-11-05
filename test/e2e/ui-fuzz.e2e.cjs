// UI fuzz test: 400 random interactions, fails on page errors or stray null text.
// Needs Playwright (npm i -D playwright && npx playwright install chromium). Run: npm run e2e
const path = require('path');
const { chromium } = require('playwright');
const PAGE = 'file://' + path.resolve(__dirname, '../../web/index.html');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  p.on('dialog', d => d.type() === 'prompt' ? d.accept('Fuzz ' + Math.floor(Math.random()*1000)) : d.accept());
  await p.goto(PAGE); await p.evaluate(() => localStorage.clear()); await p.reload();
  let seed = 42; const rnd = (n) => { seed = (seed * 16807) % 2147483647; return seed % n; };
  const counts = {};
  const actions = [
    ['option', async () => { await p.click('#tab-build'); const o = p.locator('#panel .options button'); const n = await o.count(); if (n) await o.nth(rnd(n)).click(); }],
    ['domino', async () => { const o = p.locator('.domino'); const n = await o.count(); if (n) await o.nth(rnd(n)).click(); }],
    ['action', async () => { await p.click('#tab-build'); const o = p.locator('#panel .actions button'); const n = await o.count(); if (n) await o.nth(rnd(n)).click(); }],
    ['bridge', async () => { const o = p.locator('.joint.broken button'); if (await o.count()) await o.first().click(); }],
    ['map', async () => { await p.click('#tab-map'); const o = p.locator('[data-pos]'); const n = await o.count(); await o.nth(rnd(n)).click({ force: true }); }],
    ['mapinfo', async () => { await p.click('#tab-map'); const o = p.locator('#map-info button'); const n = await o.count(); if (n) await o.nth(rnd(n)).click(); }],
    ['undo', async () => { await p.keyboard.press('Control+z'); }],
    ['random', async () => { await p.click('#btn-random'); }],
    ['key', async () => { await p.keyboard.press(['ArrowLeft','ArrowRight','Delete','Escape'][rnd(4)]); }],
    ['start', async () => { const v = await p.$$eval('#start-pos option', os => os.map(o => o.value)); await p.selectOption('#start-pos', v[rnd(v.length)]); }],
    ['chips', async () => { const o = p.locator('.chips button:visible'); const n = await o.count(); if (n) await o.nth(rnd(n)).click(); }],
    ['save', async () => { await p.locator('details.menu').evaluate((d) => { d.open = true; }); await p.click('#btn-save'); }],
    ['level', async () => { await p.locator('details.menu').evaluate((d) => { d.open = true; }); await p.selectOption('#max-level', ['1', '2', '3'][rnd(3)]); }],
    ['rate', async () => { await p.click('#tab-library'); const o = p.locator('table.lib button.rate'); const n = await o.count(); if (n) await o.nth(rnd(Math.min(n, 30))).click(); }],
    ['library', async () => {
      await p.click('#tab-library');
      await p.fill('#lib-search', ['', 'turn', 'shadow', 'hammer', 'zzz'][rnd(5)]);
      const o = p.locator('table.lib button'); const n = await o.count(); if (n) await o.nth(rnd(n)).click();
    }],
    ['addmove', async () => {
      await p.click('#tab-mine');
      await p.fill('#move-form [name=name]', 'Fuzz move ' + rnd(1000));
      await p.selectOption('#move-form [name=kind]', ['move', 'styling', 'adjuster'][rnd(3)]);
      const chips = p.locator('.mf-chip'); const n = await chips.count(); await chips.nth(rnd(n)).click();
      if (await p.locator('#move-form [name=to]').isEnabled()) {
        const v = await p.$$eval('#move-form [name=to] option', (os) => os.map((o) => o.value));
        await p.selectOption('#move-form [name=to]', v[rnd(v.length)]);
      }
      await p.click('#move-form button[type=submit]');
    }],
    ['text', async () => {
      if (await p.locator('#btn-text').isDisabled()) return;
      await p.locator('details.menu').evaluate((d) => { d.open = true; });
      await p.click('#btn-text');
    }],
    ['movie', async () => {
      const play = p.locator('.mv-play:visible');
      if (!(await play.count())) return;
      if (rnd(2)) await play.click();
      else await p.locator('.movie input[type=range]').fill(String(rnd(1001)));
    }],
    ['tab', async () => { await p.click(['#tab-build', '#tab-map', '#tab-library', '#tab-mine'][rnd(4)]); }],
    ['practice', async () => { if (await p.locator('#btn-practice').isDisabled()) return; await p.click('#btn-practice'); if (await p.locator('dialog[open]').count()) { await p.click('.pr-nextbtn'); await p.click('.pr-nextbtn'); await p.keyboard.press('Escape'); } }],
  ];
  for (let i = 0; i < 400; i++) {
    const [name, fn] = actions[rnd(actions.length)];
    counts[name] = (counts[name] || 0) + 1;
    try { await fn(); } catch (e) { errs.push(`${name}: ${e.message.split('\n')[0]}`); }
    if (errs.length) { console.log('stopped at step', i, name); break; }
  }
  // invariants
  const state = await p.evaluate(() => ({ hash: location.hash, dominoes: document.querySelectorAll('.domino:not(.add)').length, nulls: (document.body.innerText.match(/.{0,60}(null|undefined|\[object).{0,60}/g) || []) }));
  console.log(JSON.stringify(counts));
  console.log('final', state);
  console.log('null nodes:', await p.evaluate(() => {
    const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const t = w.currentNode; if (/^(null|undefined)$/.test(t.textContent.trim())) {
      let e = t.parentElement, path = []; while (e && e !== document.body) { path.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '')); e = e.parentElement; }
      out.push(path.join(' > ') + ' | prev: ' + (t.previousSibling ? (t.previousSibling.textContent || '').slice(0, 40) : '-')); } }
    return out; }));
  console.log('errors', errs);
  await b.close();
  const nullNodes = state.nulls.length;
  if (errs.length || nullNodes) { console.error('E2E FAILED'); process.exit(1); }
  console.log('E2E OK');
})();
