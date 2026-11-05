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
    // Levels are the user's own ratings. Unrated moves count as level 1, so a level filter never hides them.
    const rated = (m) => ({ ...m, level: own.levels[m.id] });
    App.g = MG.compile({ positions: BASE.positions, moves: [...BASE.moves.map(rated), ...own.moves.map(rated), ...own.compounds] });
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
    const problems = [];
    if (App.g.posById[combo.startPos]) state.startPos = combo.startPos;
    else if (combo.startPos) problems.push(`unknown start position "${combo.startPos}"`);
    if (['mirrored', 'parallel'].includes(combo.startWeight)) state.startWeight = combo.startWeight;
    state.strip = Array.isArray(combo.strip) ? [...combo.strip] : [];
    state.selected = null;
    const unknown = state.strip.filter((id) => !App.g.moveById[id]);
    if (unknown.length) problems.push(`${unknown.length} unknown move${unknown.length > 1 ? 's' : ''} (${unknown.join(', ')})`);
    dropUnknownMoves();
    // Say what was left out instead of silently "repairing" the link.
    if (problems.length) own.addNote(`Left out of this combo: ${problems.join('; ')}.`);
  };

  App.evaluate = () => MG.evaluateStrip(App.g, state.startPos, state.startWeight, state.strip);
  /** The level the user gave a move (1-3), or null when unrated. */
  App.userLevel = (id) => own.levels[id] || null;

  /** Rate a move: unrated -> 1 -> 2 -> 3 -> unrated. */
  App.rateMove = function (id) {
    const next = ((own.levels[id] || 0) + 1) % 4;
    if (next) own.levels[id] = next; else delete own.levels[id];
    store.set('bmc.levels', own.levels);
    App.recompile();
    App.render();
  };

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
    App.announce(App.summaryText(App.evaluate()));
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
    levels: store.get('bmc.levels', {}),   // move id -> the level the user gave it (1-3)
    errors: {},            // own move or compound id -> its problems, set by recompile()
    importNote: '',        // what the last shared link added

    addNote(text) { own.importNote = own.importNote ? `${own.importNote} ${text}` : text; },

    /** Moves that came with a shared link. Only moves that work with this version's positions are kept. */
    importShared(custom) {
      const fresh = (custom || []).filter((m) => !own.moves.some((x) => x.id === m.id));
      if (!fresh.length) return;
      const test = MG.compile({ positions: BASE.positions, moves: [...BASE.moves, ...own.moves, ...fresh] });
      const works = fresh.filter((m) => !test.errors.some((e) => e.includes(`"${m.id}"`)));
      const broken = fresh.filter((m) => !works.includes(m));
      if (works.length) {
        own.moves = own.moves.concat(works);
        store.set('bmc.moves', own.moves);
        own.addNote(`Added ${works.length} move${works.length > 1 ? 's' : ''} from the shared link: ${works.map((m) => m.name).join(', ')}. They're under "My moves".`);
      }
      if (broken.length) own.addNote(`Not added (they don't fit this version's positions): ${broken.map((m) => m.name).join(', ')}.`);
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
