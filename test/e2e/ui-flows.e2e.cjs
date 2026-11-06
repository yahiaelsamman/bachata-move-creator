// UI flow test: fixed user journeys with explicit checks, plus a text snapshot of the page
// (test/e2e/golden.json) for a few fixed combos. Fails on any page or console error.
// Run: npm run e2e. After a deliberate change to what the page shows: node test/e2e/ui-flows.e2e.cjs --update
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '../../web/index.html');
const GOLDEN = path.join(__dirname, 'golden.json');
const UPDATE = process.argv.includes('--update');
const DEMO = '#start=open_LR&weight=mirrored&moves=cross-body-lead,close-frame,shadow-entry-from-open';

// A move added in the app, encoded the way share links have always encoded it (base64url of UTF-8 JSON).
const CUSTOM = [{ id: 'my-vuelta', name: 'Vuelta ñ é', kind: 'move', level: 1, from: ['open_LR'], to: 'open_RR', counts: 4, notes: 'Test <b>' }];
const CUSTOM_HASH = '#start=open_LR&weight=mirrored&moves=my-vuelta,cross-body-lead&custom=' +
  Buffer.from(JSON.stringify(CUSTOM), 'utf8').toString('base64url');

let browser;
const errors = [];

/** A fresh browser context (empty localStorage) with the page open at `hash`. */
async function open(hash = '', opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, ...opts });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept(page.promptAnswer || 'My combo') : d.accept()));
  await page.goto(PAGE + hash);
  return page;
}

const stripIds = (page) => page.evaluate(() => (new URLSearchParams(location.hash.slice(1)).get('moves') || '').split(',').filter(Boolean));
const dominoCount = (page) => page.locator('.domino:not(.add)').count();
const text = (page, sel) => page.locator(sel).innerText();
const panelButton = (page, label) => page.locator('#panel button', { hasText: label }).first();
const sectionOptions = (page, heading) => page.locator(`#panel h2:has-text("${heading}") ~ ul.options`).first().locator('button');
const tick = (page) => page.waitForTimeout(30);
async function openTab(page, name) {
  await page.click('#tab-' + name);
  await tick(page);
}
/** Buttons in the "More" menu: open the menu first. */
async function clickMore(page, sel) {
  await page.locator('details.menu').evaluate((d) => { d.open = true; });
  await page.click(sel);
}

// ---------------------------------------------------------------- flows
const flows = {
  async 'shared link loads the combo'() {
    const page = await open(DEMO);
    assert.equal(await dominoCount(page), 3);
    const summary = await text(page, '#summary');
    assert.match(summary, /3 moves/);
    assert.match(summary, /1 break/);
    assert.match(summary, /ends in Shadow, hand on waist/);
  },

  async 'what can follow adds a domino'() {
    const page = await open('#start=open_LR&weight=mirrored&moves=cross-body-lead');
    await page.locator('#panel .options button').first().click();
    assert.equal(await dominoCount(page), 2);
    assert.equal((await stripIds(page)).length, 2);
  },

  async 'domino actions: replace, insert, move, cut, remove'() {
    const page = await open('#start=open_LR&weight=mirrored&moves=cross-body-lead,close-frame,basic');
    await page.locator('.domino').nth(1).click();
    await sectionOptions(page, 'Replace with').first().click();
    const replaced = await stripIds(page);
    assert.notEqual(replaced[1], 'close-frame');
    assert.equal(replaced.length, 3);

    await page.locator('.domino').nth(1).click();
    await sectionOptions(page, 'Insert after this').first().click();
    assert.equal((await stripIds(page)).length, 4);
    assert.ok(await page.locator('.domino').nth(2).evaluate((el) => el.classList.contains('selected')));

    await page.locator('.domino').nth(0).click();
    const before = await stripIds(page);
    await panelButton(page, 'Move right ›').click();
    assert.deepEqual(await stripIds(page), [before[1], before[0], ...before.slice(2)]);
    await panelButton(page, '‹ Move left').click();
    assert.deepEqual(await stripIds(page), before);

    await page.locator('.domino').nth(1).click();
    await panelButton(page, 'Cut here').click();
    assert.deepEqual(await stripIds(page), before.slice(0, 2));

    await page.locator('.domino').nth(0).click();
    await panelButton(page, 'Remove').click();
    assert.deepEqual(await stripIds(page), before.slice(1, 2));
  },

  async 'examples load their parts; a compound expands into its parts'() {
    // Read the parts from the data so editing the example doesn't break this test.
    const moves = require('js-yaml').load(fs.readFileSync(path.join(__dirname, '../../data/moves.yaml'), 'utf8'));
    const parts = moves.find((m) => m.id === 'classic-opener').sequence;
    const empty = await open();
    await empty.locator('.empty button', { hasText: 'Example: Classic opener' }).click();
    assert.deepEqual(await stripIds(empty), parts);

    const page = await open('#start=open_LR&weight=mirrored&moves=classic-opener');
    await page.locator('.domino').first().click();
    await panelButton(page, 'Expand into parts').click();
    assert.deepEqual(await stripIds(page), parts);
  },

  async 'a link with unknown moves says what was left out'() {
    const page = await open('#start=nowhere&weight=mirrored&moves=cross-body-lead,not-a-move');
    assert.equal(await dominoCount(page), 1);
    const note = await text(page, '#notice');
    assert.match(note, /unknown start position "nowhere"/);
    assert.match(note, /1 unknown move \(not-a-move\)/);
    await page.locator('#notice button', { hasText: 'Dismiss' }).click();
    assert.ok(await page.locator('#notice').isHidden());
  },

  async 'a selected move plays in the leader view: play, finish, scrub'() {
    const page = await open('#start=open_LR&weight=mirrored&moves=cross-body-lead,follower-right-turn');
    await page.locator('.domino').nth(1).click();              // the follower right turn, starting on 1
    const art = () => page.locator('.movie .sk-art').innerHTML();
    const first = await art();
    assert.equal(await text(page, '.mv-count'), 'count 1');
    await page.locator('.mv-play').click();
    await page.waitForTimeout(700);
    assert.notEqual(await art(), first, 'the sketch moves while playing');
    assert.equal(await page.locator('.mv-play').getAttribute('aria-label'), 'Pause');
    await page.waitForFunction(() => document.querySelector('.mv-play').getAttribute('aria-label') === 'Play', null, { timeout: 4000 });
    assert.equal(await page.locator('.movie input[type=range]').inputValue(), '1000');
    await page.locator('.movie input[type=range]').fill('500');
    assert.equal(await text(page, '.mv-count'), 'count 3');
    await page.locator('.movie input[type=range]').fill('0');
    assert.equal(await art(), first, 'scrubbing back to 0 shows the start again');
  },

  async 'stop on a count, then step a quarter count at a time'() {
    const page = await open('#start=open_LR&weight=mirrored&moves=basic,follower-right-turn');
    await page.locator('.domino').nth(1).click();              // the turn on 5-8
    assert.ok(await page.locator('.mv-beats .num', { hasText: '3' }).isDisabled(), 'counts outside the move are off');
    const first = await page.locator('.movie .sk-art').innerHTML();
    await page.locator('.mv-beats .num', { hasText: '7' }).click();
    assert.equal(await text(page, '.mv-count'), 'count 7');
    assert.equal(await page.locator('.mv-beats .num.now').innerText(), '7');
    assert.notEqual(await page.locator('.movie .sk-art').innerHTML(), first);
    await page.locator('.mv-step[aria-label="A quarter count forward"]').click();
    await page.locator('.mv-step[aria-label="A quarter count forward"]').click();
    assert.equal(await text(page, '.mv-count'), 'count 7½');
    await page.locator('.mv-step[aria-label="A quarter count back"]').click();
    assert.equal(await text(page, '.mv-count'), 'count 7¼');
    await page.locator('.movie input[type=range]').press('Shift+ArrowRight');
    assert.equal(await text(page, '.mv-count'), 'count 8');
    assert.equal(await page.locator('.mv-play').getAttribute('aria-label'), 'Play', 'stays paused');
  },

  async 'a connector (0 counts) gets a short animation; a combo block keeps start and end sketches'() {
    const page = await open('#start=open_LR&weight=mirrored&moves=catch-second-hand,classic-opener');
    await page.locator('.domino').nth(0).click();
    assert.equal(await text(page, '.mv-count'), 'start');
    await page.locator('.mv-play').click();
    await page.waitForFunction(() => document.querySelector('.mv-count').textContent === 'end', null, { timeout: 3000 });
    await page.locator('.domino').nth(1).click();
    assert.equal(await page.locator('.movie').count(), 0);
    assert.ok(await page.locator('.leader-view .sk-fig').count() >= 1);
  },

  async 'practice animates the sketch in time with the beat'() {
    const page = await open('#start=open_LR&weight=mirrored&moves=follower-right-turn,follower-left-turn');
    await page.click('#btn-practice');
    await page.locator('.pr-countin').uncheck();
    const before = await page.locator('.pr-art').innerHTML();
    await page.click('.pr-play');
    await page.waitForTimeout(800);
    assert.notEqual(await page.locator('.pr-art').innerHTML(), before);
    await page.click('.pr-play');                              // pause stops the animation
    const paused = await page.locator('.pr-art').innerHTML();
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.pr-art').innerHTML(), paused);
  },

  async 'the whole combo plays move after move, lighting up each domino; combo blocks play their parts'() {
    const page = await open('#start=open_LR&weight=mirrored&moves=follower-right-turn,classic-opener');
    assert.match(await text(page, '.combo-movie figcaption'), /^Whole combo: 2 moves/);
    assert.match(await text(page, '.mv-count'), /^1\/2 · Follower right turn · count 1$/);
    await page.locator('.combo-movie input[type=range]').fill('900');                  // inside the opener
    assert.match(await text(page, '.mv-count'), /^2\/2 · /);
    assert.doesNotMatch(await text(page, '.mv-count'), /Classic opener/, 'the block shows the part being danced');
    await page.locator('.combo-movie input[type=range]').fill('0');
    await page.locator('.mv-play').click();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#strip .domino.playing').count(), 1);
    assert.match(await text(page, '#strip .domino.playing .name'), /Follower right turn/);
    await page.locator('.mv-play').click();                                            // pause clears the light
    assert.equal(await page.locator('#strip .domino.playing').count(), 0);
  },

  async 'keyboard focus survives a redraw'() {
    const page = await open('#start=open_LR&weight=mirrored&moves=cross-body-lead');
    await page.locator('#panel .options button').first().focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    assert.equal(await dominoCount(page), 3);
    assert.equal(await page.evaluate(() => document.activeElement.closest('#panel') !== null), true);
    assert.match(await page.locator('#status').textContent(), /^3 moves/);
  },

  async 'a break can be bridged'() {
    const page = await open(DEMO);
    await page.locator('.joint.broken button').first().click();
    await sectionOptions(page, 'Bridge:').first().click();
    assert.equal(await page.locator('.joint.broken').count(), 0);
    assert.ok((await stripIds(page)).length > 3);
  },

  async '"show all" can insert a move that breaks the combo'() {
    const page = await open('#start=open_LR&weight=mirrored&moves=cross-body-lead,close-frame');
    await page.locator('.domino').first().click();
    await panelButton(page, 'Show all').click();
    await sectionOptions(page, 'Insert after this').filter({ hasText: '⚠' }).first().click();
    assert.ok(await page.locator('.joint.broken').count() > 0);
  },

  async 'undo and keyboard shortcuts'() {
    const page = await open('#start=open_LR&weight=mirrored&moves=cross-body-lead,close-frame');
    await page.locator('#panel .options button').first().click();
    assert.equal(await dominoCount(page), 3);
    await page.keyboard.press('Control+z');
    assert.deepEqual(await stripIds(page), ['cross-body-lead', 'close-frame']);

    const selectedIndex = () => page.locator('.domino').evaluateAll((els) => els.findIndex((el) => el.classList.contains('selected')));
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ArrowLeft');
    assert.equal(await selectedIndex(), 1);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await selectedIndex(), 0);
    await page.keyboard.press('ArrowRight');
    assert.equal(await selectedIndex(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await selectedIndex(), 2); // the "+ next move" domino
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Delete');
    assert.deepEqual(await stripIds(page), ['cross-body-lead']);
  },

  async 'levels are the user\'s own: rate a move, the level filter hides it'() {
    const page = await open();
    await openTab(page, 'library');
    const count = async () => Number((await text(page, '#library p')).match(/^(\d+) of/)[1]);
    const all = await count();
    const rate = page.locator('table.lib tbody tr').first().locator('button.rate');
    assert.equal(await rate.innerText(), '○○○');
    await rate.click();
    await rate.click();
    await rate.click();
    assert.equal(await page.locator('table.lib tbody tr').first().locator('button.rate').innerText(), '●●●');
    await page.locator('details.menu').evaluate((d) => { d.open = true; });
    await page.selectOption('#max-level', '2');
    await tick(page);
    assert.equal(await count(), all - 1, 'only the move rated advanced is hidden; unrated moves stay');
    await page.reload();
    await openTab(page, 'library');
    assert.equal(await count(), all - 1, 'ratings are kept in this browser');
  },

  async 'library search and add'() {
    const page = await open();
    await openTab(page, 'library');
    await page.fill('#lib-search', 'shadow');
    const rows = await page.locator('table.lib tbody tr').allInnerTexts();
    assert.ok(rows.length > 0);
    assert.ok(rows.every((r) => r.toLowerCase().includes('shadow')), rows.join('\n'));
    await page.fill('#lib-search', '');
    await page.locator('table.lib button', { hasText: 'Add' }).first().click();
    assert.equal(await dominoCount(page), 1);
  },

  async 'map: positions and arrows'() {
    const page = await open();
    await openTab(page, 'map');
    await page.locator('[data-pos="closed"]').dispatchEvent('click');
    assert.equal(await text(page, '#map-info h3'), 'Closed position');
    await page.locator('[data-link^="closed>"] .mp-hit').first().dispatchEvent('click');
    assert.match(await page.locator('#map-info h4').first().innerText(), /^Closed → .+ \(\d+\)$/);
    assert.ok(await page.locator('#map-info .options button').count() > 0);
    await page.locator('#map-info button', { hasText: 'Start a combo here' }).click();
    assert.equal(await page.locator('#start-pos').inputValue(), 'closed');
  },

  async 'add a move, use it and share it'() {
    const page = await open();
    await openTab(page, 'mine');
    await page.fill('#move-form [name=name]', 'Test move');
    await page.locator('.mf-chip', { has: page.locator('input[value="open_LR"]') }).click();
    await page.click('#move-form button[type=submit]');
    assert.match(await text(page, '#mf-status'), /^Saved "Test move"/);
    assert.match(await text(page, '#my-moves'), /Test move/);
    await openTab(page, 'build');
    await page.locator('#panel .options button', { hasText: 'Test move' }).click();
    const hash = await page.evaluate(() => location.hash);
    assert.match(hash, /custom=/);

    const other = await open(hash);
    assert.match(await text(other, '#notice'), /^Added 1 move from the shared link: Test move/);
    assert.equal(await dominoCount(other), 1);
  },

  async 'save as compound'() {
    const page = await open('#start=open_LR&weight=mirrored&moves=cross-body-lead,close-frame');
    await clickMore(page, '#btn-save');
    assert.equal(await dominoCount(page), 1);
    assert.match(await text(page, '.domino:not(.add)'), /My combo/);
    assert.match(await page.locator('#compounds').textContent(), /name: "My combo"/);
    assert.equal(await page.locator('#tab-mine').getAttribute('aria-selected'), 'true');
  },

  async 'a compound named with symbols only gets a readable id'() {
    const page = await open('#start=open_LR&weight=mirrored&moves=cross-body-lead,close-frame');
    page.promptAnswer = '***';
    await clickMore(page, '#btn-save');
    // The page already shows this link (own compounds are spelled out), so change it to fire hashchange.
    await page.evaluate(() => { location.hash = '#moves=cross-body-lead,close-frame'; });
    await page.waitForFunction(() => document.querySelectorAll('.domino:not(.add)').length === 2);
    await clickMore(page, '#btn-save');
    const yaml = await page.locator('#compounds pre').textContent();
    assert.match(yaml, /^- id: my-compound$/m);
    assert.match(yaml, /^- id: my-compound-2$/m);
  },

  async 'a link with an unknown start or weight keeps the current ones'() {
    const page = await open('#start=closed&weight=parallel&moves=dip');
    await page.evaluate(() => { location.hash = '#start=nowhere&weight=sideways&moves=basic'; });
    await page.waitForFunction(() => /moves=basic/.test(location.hash));
    assert.equal(await page.locator('#start-pos').inputValue(), 'closed');
    assert.equal(await page.locator('#start-weight').inputValue(), 'parallel');
    assert.doesNotMatch(await text(page, '#summary'), /sideways/);
    assert.deepEqual(await stripIds(page), ['basic']);
  },

  async 'errors of an own move are not listed as broken compounds'() {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('bmc.moves', JSON.stringify([{ id: 'my-lost', name: 'Lost', kind: 'move', level: 1, from: ['nowhere'], to: 'same', counts: 4 }]));
      localStorage.setItem('bmc.compounds', JSON.stringify([{ id: 'my-pair', name: 'Pair', kind: 'compound', sequence: ['cross-body-lead', 'close-frame'] }]));
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(PAGE);
    assert.match(await page.locator('#my-moves .errors').textContent(), /"my-lost"/);
    assert.equal(await page.locator('#compounds .errors').count(), 0);
    await context.close();
  },

  async 'practice mode'() {
    const page = await open('#start=open_LR&weight=mirrored&moves=cross-body-lead,close-frame');
    await page.click('#btn-practice');
    assert.equal(await page.locator('dialog[open]').count(), 1);
    assert.equal(await text(page, '.pr-name'), 'Cross body lead');
    assert.match(await text(page, '.pr-sketches'), /Open, left-to-right → Open, left-to-right/);
    await page.click('.pr-nextbtn');
    assert.equal(await text(page, '.pr-name'), 'Close frame');
    assert.equal(await page.locator('.pr-sketches svg').count(), 1);          // one animated sketch
    assert.match(await text(page, '.pr-sketches'), /Open, left-to-right → Closed position/);
    await page.click('.pr-nextbtn'); // loops back to the start by default
    assert.equal(await text(page, '.pr-name'), 'Cross body lead');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog[open]').count(), 0);
  },

  async 'filter box keeps focus while typing'() {
    const page = await open();
    await page.locator('#panel .search').click();
    await page.keyboard.type('tu', { delay: 20 });
    const st = await page.evaluate(() => ({ cls: document.activeElement.className, value: document.activeElement.value }));
    assert.deepEqual(st, { cls: 'search', value: 'tu' });
    const names = await page.locator('#panel .options button > span:first-child').allInnerTexts();
    assert.ok(names.length > 0 && names.every((n) => n.toLowerCase().includes('tu')), names.join(', '));
  },

  async 'reload restores the combo from this browser'() {
    const page = await open('#start=closed&weight=parallel&moves=dip');
    await page.goto(PAGE);
    assert.deepEqual(await stripIds(page), ['dip']);
    assert.equal(await page.locator('#start-pos').inputValue(), 'closed');
    assert.equal(await page.locator('#start-weight').inputValue(), 'parallel');
  },
};

// ---------------------------------------------------------------- golden text snapshot
const BUILD_VIEWS = ['#strip', '#summary', '#panel', '#notice', '#errors'];
const TAB_VIEWS = { map: ['#map-info'], library: ['#library', '#positions'], mine: ['#my-moves', '#compounds'] };
const SNAPSHOT_HASHES = {
  demo: DEMO,
  broken: '#start=shadow&weight=parallel&moves=basic,close-frame,cuddle-combo,dip',
  custom: CUSTOM_HASH,
};

async function capture(page, selectors) {
  const out = { hash: await page.evaluate(() => location.hash) };
  for (const sel of selectors) out[sel] = await page.locator(sel).evaluate((el) => (el.hidden ? '(hidden)' : el.innerText));
  return out;
}

async function snapshot() {
  const shots = {};
  for (const [name, hash] of Object.entries(SNAPSHOT_HASHES)) {
    const page = await open(hash);
    // Each view lives in its own tab: show the tab, then capture what it shows.
    const shot = await capture(page, BUILD_VIEWS);
    for (const [tab, sels] of Object.entries(TAB_VIEWS)) {
      await openTab(page, tab);
      Object.assign(shot, await capture(page, sels));
    }
    shots[name] = shot;
    await page.locator('.domino').nth(1).click();            // picking a domino shows the Build tab
    shots[name + ' / second domino'] = await capture(page, BUILD_VIEWS);
    await page.locator('.domino:not(.add)').last().click();
    shots[name + ' / last domino'] = await capture(page, BUILD_VIEWS);
    await openTab(page, 'map');
    await page.locator('[data-pos="closed"]').dispatchEvent('click');
    shots[name + ' / map closed'] = await capture(page, ['#map-info']);
    await page.close();
  }
  return shots;
}

function compareGolden(actual) {
  if (UPDATE || !fs.existsSync(GOLDEN)) {
    fs.writeFileSync(GOLDEN, JSON.stringify(actual, null, 1) + '\n');
    console.log('wrote', path.relative(process.cwd(), GOLDEN));
    return [];
  }
  const expected = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const diffs = [];
  for (const view of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    for (const key of new Set([...Object.keys(expected[view] || {}), ...Object.keys(actual[view] || {})])) {
      const a = (actual[view] || {})[key], e = (expected[view] || {})[key];
      if (a !== e) diffs.push(`golden "${view}" ${key}:\n  expected ${JSON.stringify(e)}\n  actual   ${JSON.stringify(a)}`);
    }
  }
  return diffs;
}

// ---------------------------------------------------------------- run
(async () => {
  browser = await chromium.launch();
  const failures = [];
  for (const [name, fn] of Object.entries(flows)) {
    const before = errors.length;
    try {
      await fn();
      if (errors.length > before) throw new Error('page errors: ' + errors.slice(before).join(' | '));
      console.log('ok  ', name);
    } catch (e) {
      failures.push(name);
      console.log('FAIL', name, '\n     ', e.message.split('\n').slice(0, 14).join('\n      '));
    }
  }
  const diffs = compareGolden(await snapshot());
  for (const d of diffs.slice(0, 10)) console.log(d);
  if (diffs.length) failures.push(`golden snapshot (${diffs.length} differences)`);
  if (errors.length) console.log('page errors:', errors);
  await browser.close();
  if (failures.length || errors.length) { console.error('UI FLOWS FAILED:', failures.join('; ')); process.exit(1); }
  console.log('UI FLOWS OK');
})();
