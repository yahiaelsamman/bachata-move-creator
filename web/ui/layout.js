/* Layout: the four tabs (Build, Map, Library, My moves) and bringing the panel into view on phones. */
(function (App) {
  'use strict';
  const { $, state, store } = App;
  const TABS = ['build', 'map', 'library', 'mine'];
  const saved = store.get('bmc.tab', 'build');
  state.tab = TABS.includes(saved) ? saved : 'build';

  App.isTab = (name) => state.tab === name;

  /** Show one view, hide the others (tabs follow the ARIA tab pattern). */
  function applyTab() {
    for (const t of TABS) {
      const on = t === state.tab;
      $('tab-' + t).setAttribute('aria-selected', String(on));
      $('tab-' + t).tabIndex = on ? 0 : -1;
      $('view-' + t).hidden = !on;
    }
    document.body.dataset.tab = state.tab;     // the phone layout pins the combo only on Build
  }

  App.showTab = function (name, { focus = false } = {}) {
    if (!TABS.includes(name)) return;
    state.tab = name;
    store.set('bmc.tab', name);
    applyTab();
    if (focus) $('tab-' + name).focus();
    App.render();
    scrollBelowCombo($('view-' + name));
  };

  /** On phones, scroll so an element starts just below the sticky combo (which sticks once scrolled). */
  function scrollBelowCombo(el) {
    if (!window.matchMedia('(max-width: 720px)').matches) return;
    const stickyHeight = document.querySelector('.combo-sticky').offsetHeight;
    const top = el.getBoundingClientRect().top;
    if (top < stickyHeight || top > window.innerHeight * 0.55) {
      window.scrollTo({ top: window.scrollY + top - stickyHeight - 8, behavior: 'smooth' });
    }
  }

  /** After picking a domino on a phone, scroll so the panel starts just below the sticky combo. */
  App.revealPanel = function () {
    if (!App.isTab('build')) App.showTab('build');
    scrollBelowCombo($('panel'));
  };

  /** The "More" menu closes after an action, on a click elsewhere and on Esc. */
  function initMenu() {
    const menu = document.querySelector('details.menu');
    menu.addEventListener('click', (ev) => { if (ev.target.closest('.menu-body button')) menu.open = false; });
    document.addEventListener('click', (ev) => { if (menu.open && !menu.contains(ev.target)) menu.open = false; });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
  }

  App.initTabs = function () {
    initMenu();
    TABS.forEach((t, i) => {
      const tab = $('tab-' + t);
      tab.addEventListener('click', () => App.showTab(t));
      tab.addEventListener('keydown', (ev) => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[ev.key];
        if (!step) return;
        ev.preventDefault();
        App.showTab(TABS[(i + step + TABS.length) % TABS.length], { focus: true });
      });
    });
    applyTab();
  };
})(window.App);
