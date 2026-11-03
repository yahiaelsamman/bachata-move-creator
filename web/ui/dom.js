/* DOM helpers shared by every UI file, and the App namespace they all hang off.
 *
 * How the UI files fit together (plain scripts, no bundler, so the page also works from file://):
 * 1. A file's top level only defines things on App. Nothing runs until app.js (loaded last) boots,
 *    so load order only matters for dom.js and state.js (first) and app.js (last).
 * 2. A file may destructure helpers from dom.js and state.js. Everything else is called as App.name().
 * 3. Never destructure App.g: recompile() replaces it. Read App.g inside functions.
 * 4. All changes to the combo go through App.edit; renderers never change state.strip themselves.
 */
window.App = {};
(function (App) {
  'use strict';

  App.$ = (id) => document.getElementById(id);

  /** Build an element: h('p', { class: 'muted', onclick }, 'text', child, [more children]). */
  App.h = function (tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
    return el;
  };
  const h = App.h;

  App.button = (label, onclick, attrs = {}) => h('button', { type: 'button', onclick, ...attrs }, label);

  /** A grid of option buttons. Each row: { label, sub, onclick, disabled, title }. */
  App.optionList = (rows) => h('ul', { class: 'options' }, rows.map((r) => h('li', {},
    App.button([h('span', {}, r.label), h('span', { class: 'to' }, r.sub)], r.onclick, { disabled: r.disabled, title: r.title }))));

  App.LEVEL_NAME = { 1: 'beginner', 2: 'intermediate', 3: 'advanced' };
  App.badge = (kind) => h('span', { class: `badge k-${kind}` }, kind);
  App.levelDots = (lvl) => h('span', { class: 'lvl', title: App.LEVEL_NAME[lvl] || '' }, '●'.repeat(lvl) + '○'.repeat(3 - lvl));
  App.moveLabel = (m) => [m.name, ' ', App.badge(m.kind)];
  App.posName = (id) => (App.g.posById[id] ? App.g.posById[id].name : '?');
  App.shortName = (id) => (App.g.posById[id] ? App.g.posById[id].short || App.g.posById[id].name : '?');

  /** Copy text to the clipboard and say so on the button for a moment; if that fails, show it to copy by hand. */
  App.copyText = function (text, el, okLabel = 'Copied') {
    el.dataset.label = el.dataset.label || el.textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => {
      el.textContent = okLabel;
      setTimeout(() => { el.textContent = el.dataset.label; }, 1800);
    }, () => { prompt('Copy this text:', text); });
  };

  /** Re-render while the user types in a box that the re-render replaces, and put the caret back. */
  App.keepFocus = function (selector, rerender) {
    const caret = document.activeElement.selectionStart;
    rerender();
    const again = document.querySelector(selector);
    if (again) { again.focus(); again.setSelectionRange(caret, caret); }
  };
})(window.App);
