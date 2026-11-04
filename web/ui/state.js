/* State: the combo, the compiled graph, own moves, undo, and every action that changes the combo.
 *
 * Glossary: g = the compiled move graph (MoveGraph.compile); "item" = one evaluated domino from
 * MoveGraph.evaluateStrip; "own" moves and compounds were added in this browser.
 */
(function (App) {
  'use strict';
  const MG = window.MoveGraph;
  const PM = window.PositionMap;
  const Share = window.ComboShare;
  const BASE = window.BACHATA_DATA;

  /** localStorage, quietly doing nothing when it is unavailable. */
  const store = App.store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
    },
  };

  const state = App.state = {
    startPos: 'open_LR',
    startWeight: 'mirrored',
    strip: [],             // move ids
    selected: null,        // index into strip, or null = "what comes next"
    kindFilter: 'all',
    search: '',
    showAllInsert: false,
    mapSelected: null,
    mapLink: null,         // { from, to } of a tapped map arrow
    maxLevel: [1, 2, 3].includes(store.get('bmc.maxLevel', 3)) ? store.get('bmc.maxLevel', 3) : 3,
    randomCounts: [16, 32, 48].includes(store.get('bmc.randomCounts', 32)) ? store.get('bmc.randomCounts', 32) : 32,
  };
  App.g = null;            // set by recompile()
  App.mapLayout = null;    // set by recompile()
  App.dataErrors = [];     // problems in data/*.yaml, set by recompile()

  /** Compile the base data plus own moves and compounds. Call after any of them change. */
  App.recompile = function () {
    App.g = MG.compile({ positions: BASE.positions, moves: [...BASE.moves, ...own.moves, ...own.compounds] });
    own.errors = {};
    App.dataErrors = App.g.errors.filter((e) => {
      const mine = [...own.moves, ...own.compounds].find((c) => e.includes(`"${c.id}"`));
      if (mine) (own.errors[mine.id] = own.errors[mine.id] || []).push(e);
      return !mine;
    });
    App.mapLayout = PM.layoutMap(App.g);
    dropUnknownMoves();
  };

  /** recompile() and redraw the parts of the page that show the data itself. */
  App.reloadData = function () {
    App.recompile();
    App.renderData();
  };

  function dropUnknownMoves() {
    state.strip = state.strip.filter((id) => App.g.moveById[id]);
  }

  /** Apply a combo from a link or from this browser's storage. Unknown values keep the current ones. */
  App.loadCombo = function (combo) {
    if (App.g.posById[combo.startPos]) state.startPos = combo.startPos;
    if (['mirrored', 'parallel'].includes(combo.startWeight)) state.startWeight = combo.startWeight;
    state.strip = Array.isArray(combo.strip) ? [...combo.strip] : [];
    state.selected = null;
    dropUnknownMoves();
  };

  App.evaluate = () => MG.evaluateStrip(App.g, state.startPos, state.startWeight, state.strip);
  App.withinLevel = (id) => (App.g.moveById[id] ? App.g.moveById[id].level <= state.maxLevel : false);

  App.shareHash = () => Share.buildHash({
    startPos: state.startPos, startWeight: state.startWeight, strip: state.strip,
    myMoves: App.own.moves, myCompounds: App.own.compounds,
  });

  function persist() {
    store.set('bmc.state', { startPos: state.startPos, startWeight: state.startWeight, strip: state.strip });
    try { history.replaceState(null, '', state.strip.length ? App.shareHash() : location.pathname + location.search); } catch { /* file:// in some browsers */ }
  }

  // ------------------------------------------------------------ undo
  const undoStack = [];
  let lastSnap = null;
  const snapshot = () => JSON.stringify({ startPos: state.startPos, startWeight: state.startWeight, strip: state.strip });

  /** Call after every change to the combo: records undo, saves, re-renders. */
  App.commit = function () {
    const snap = snapshot();
    if (lastSnap !== null && snap !== lastSnap) {
      undoStack.push(lastSnap);
      if (undoStack.length > 100) undoStack.shift();
    }
    lastSnap = snap;
    persist();
    App.render();
    App.announce(document.getElementById('summary').textContent || 'Combo is empty.');
  };

  App.undo = function () {
    const prev = undoStack.pop();
    if (!prev) return;
    Object.assign(state, JSON.parse(prev));
    lastSnap = prev;
    state.selected = null;
    persist();
    App.render();
  };

  App.canUndo = () => undoStack.length > 0;

  /** Select a domino (or null for "what can follow"). */
  App.select = function (i) {
    state.selected = i;
    state.search = '';
    state.showAllInsert = false;
    App.render();
    App.revealPanel();
  };

  // ------------------------------------------------------------ actions
  /** A random combo in whole 8-counts, optionally continuing the given moves. */
  const generate = (prefix) => window.ComboGenerator.generate(App.g, state.startPos,
    { counts: state.randomCounts, maxLevel: state.maxLevel, prefix });

  /** Everything a user can do to the combo. Each one ends in commit(). */
  const edit = App.edit = {
    add(ids) { state.strip.push(...ids); state.selected = null; App.commit(); },
    insert(at, ids, selected = null) { state.strip.splice(at, 0, ...ids); state.selected = selected; App.commit(); },
    replace(i, id) { state.strip[i] = id; App.commit(); },
    remove(i) { state.strip.splice(i, 1); state.selected = null; App.commit(); },
    move(i, d) {
      const [id] = state.strip.splice(i, 1);
      state.strip.splice(i + d, 0, id);
      state.selected = i + d;
      App.commit();
    },
    expand(i) { state.strip.splice(i, 1, ...App.g.moveById[state.strip[i]].sequence); state.selected = null; App.commit(); },
    cut(i) { state.strip.length = i + 1; state.selected = null; App.commit(); },
    setStrip(ids, selected = null) { state.strip = [...ids]; state.selected = selected; App.commit(); },
    clear() { edit.setStrip([]); },
    random() { edit.setStrip(generate([])); },
    extend() { edit.setStrip(generate(state.strip)); },
    setStart(id) { state.startPos = id; App.commit(); },
    setWeight(w) { state.startWeight = w; App.commit(); },
    startNewComboAt(id) { state.startPos = id; edit.clear(); },
    load(combo) { App.loadCombo(combo); App.commit(); },
  };

  /** Moves and compounds saved in this browser. */
  const own = App.own = {
    moves: store.get('bmc.moves', []),
    compounds: store.get('bmc.compounds', []),
    errors: {},            // own move or compound id -> its problems, set by recompile()
    importNote: '',        // what the last shared link added

    importShared(custom) {
      const fresh = (custom || []).filter((m) => !own.moves.some((x) => x.id === m.id));
      if (!fresh.length) return;
      own.moves = own.moves.concat(fresh);
      store.set('bmc.moves', own.moves);
      own.importNote = `Added ${fresh.length} move${fresh.length > 1 ? 's' : ''} from the shared link: ${fresh.map((m) => m.name).join(', ')}. They're under "My moves".`;
    },
    addMove(move) {
      own.moves.push(move);
      saveOwn();
      App.render();
    },
    deleteMove(id) {
      own.moves = own.moves.filter((x) => x.id !== id);
      saveOwn();
      App.render();
    },
    /** Save the current combo as one compound domino. */
    saveCompound(name) {
      const id = Share.uniqueId(name, (taken) => Boolean(App.g.moveById[taken]), 'compound');
      own.compounds.push({ id, name, kind: 'compound', sequence: [...state.strip] });
      saveOwn();
      edit.setStrip([id], 0);
    },
    deleteCompound(id) {
      own.compounds = own.compounds.filter((x) => x.id !== id);
      saveOwn();
      App.render();
    },
  };

  /** Store own moves and compounds, then recompile with them. */
  function saveOwn() {
    store.set('bmc.moves', own.moves);
    store.set('bmc.compounds', own.compounds);
    App.reloadData();
  }
})(window.App);
