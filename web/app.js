/* Page entry point: render(), the toolbar, keyboard shortcuts, shared links, offline support and boot. Loaded last. */
(function (App) {
  'use strict';
  const Share = window.ComboShare;
  const { $, h, posName, state, store, edit, own } = App;

  /** Redraw everything that depends on the combo. */
  App.render = function () {
    const result = App.evaluate();
    if (state.selected !== null && state.selected >= state.strip.length) state.selected = null;
    App.renderStrip(result);
    App.renderSummary(result);
    App.renderPanel(result);
    if (App.isTab('map')) App.renderMap(result);      // hidden views are drawn when shown
    if (App.isTab('library')) App.renderLibrary(result);
    syncToolbar(result);
  };

  /** Redraw what only changes with the data (own moves and compounds added or deleted). */
  App.renderData = function () {
    renderMessages();
    App.renderPositions();
    App.renderMyMoves();
    App.renderCompounds();
  };

  function syncToolbar(result) {
    $('start-pos').value = state.startPos;
    $('start-weight').value = state.startWeight;
    $('max-level').value = String(state.maxLevel);
    const empty = state.strip.length === 0;
    $('btn-undo').disabled = !App.canUndo();
    $('btn-practice').disabled = empty;
    $('btn-text').disabled = empty;
    $('btn-clear').disabled = empty;
    $('btn-extend').disabled = empty || result.items.some((it) => it.broken);
  }

  function renderMessages() {
    const note = $('notice');
    note.hidden = !own.importNote;
    note.textContent = own.importNote;
    const box = $('errors');
    box.hidden = App.dataErrors.length === 0;
    box.textContent = App.dataErrors.length ? 'Data problems:\n' + App.dataErrors.join('\n') : '';
  }

  /** Practice and "save as compound" need a combo without breaks. */
  function requireUnbroken(result) {
    if (!result.items.some((it) => it.broken)) return true;
    alert('Fix the breaks first (click a red "bridge").');
    return false;
  }

  const pageUrl = () => location.href.split('#')[0] + App.shareHash();
  const practiceSketch = (posId) => (App.g.posById[posId] ? window.LeaderSketch.sketchSVG(App.g.posById[posId]) : '');

  function initToolbar() {
    for (const p of App.g.positions) $('start-pos').append(h('option', { value: p.id }, p.name));
    $('start-pos').addEventListener('change', (ev) => edit.setStart(ev.target.value));
    $('start-weight').addEventListener('change', (ev) => edit.setWeight(ev.target.value));
    $('max-level').addEventListener('change', (ev) => {
      state.maxLevel = Number(ev.target.value);
      store.set('bmc.maxLevel', state.maxLevel);
      App.render();
    });
    $('btn-undo').addEventListener('click', App.undo);
    $('btn-clear').addEventListener('click', edit.clear);
    $('btn-random').addEventListener('click', edit.random);
    $('btn-extend').addEventListener('click', edit.extend);
    $('random-length').value = String(state.randomCounts);
    $('random-length').addEventListener('change', (ev) => {
      state.randomCounts = Number(ev.target.value);
      store.set('bmc.randomCounts', state.randomCounts);
    });
    $('btn-practice').addEventListener('click', () => {
      const result = App.evaluate();
      if (!result.items.length) return alert('Add some moves first.');
      if (!requireUnbroken(result)) return;
      window.Practice.open(result.items, { posName, sketch: practiceSketch }, state.selected ?? 0);
    });
    $('btn-share').addEventListener('click', (ev) => App.copyText(pageUrl(), ev.currentTarget, 'Link copied'));
    $('btn-text').addEventListener('click', (ev) => {
      const result = App.evaluate();
      if (!result.items.length) return;
      App.copyText(Share.comboText(result, posName(state.startPos), posName(result.end), pageUrl()), ev.currentTarget);
    });
    $('btn-save').addEventListener('click', () => {
      if (state.strip.length < 2) return alert('Add at least two dominoes first.');
      if (!requireUnbroken(App.evaluate())) return;
      const name = prompt('Name for this compound move:');
      if (!name) return;
      own.saveCompound(name);
      App.showTab('mine');
    });
  }

  /** ← → select, Delete removes, Esc goes back to "what can follow", Ctrl+Z undoes. */
  function onKey(ev) {
    if (document.querySelector('dialog[open]')) return;
    const tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    const last = state.strip.length - 1;
    const sel = state.selected;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); App.undo(); return; }
    if (ev.key === 'Escape') App.select(null);
    else if (ev.key === 'ArrowLeft' && state.strip.length) App.select(sel === null ? last : Math.max(0, sel - 1));
    else if (ev.key === 'ArrowRight' && sel !== null) App.select(sel < last ? sel + 1 : null);
    else if ((ev.key === 'Delete' || ev.key === 'Backspace') && sel !== null) { ev.preventDefault(); edit.remove(sel); }
  }

  /** A shared link opened while the page is already open. */
  function onHashChange() {
    const combo = Share.parseHash(location.hash);
    if (!combo) return;
    if (combo.custom.length) { own.importShared(combo.custom); App.reloadData(); }
    edit.load(combo);
  }

  // Offline support where service workers are allowed (https or localhost, not file://).
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }

  // Boot. A shared link wins over what this browser remembers.
  const initial = Share.parseHash(location.hash) || store.get('bmc.state', {});
  own.importShared(initial.custom);
  App.recompile();
  App.loadCombo(initial);
  initToolbar();
  App.initTabs();
  App.initMap();
  App.initMoveForm();
  App.initLibrary();
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', onHashChange);
  App.renderData();
  App.commit();
})(window.App);
