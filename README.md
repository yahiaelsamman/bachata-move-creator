# Bachata Move Creator

Link social dance moves like dominoes and build new combinations.

**Live:** https://yahiaelsamman.github.io/bachata-move-creator/

- **Positions are the nodes.** A position is the state of the couple: orientation,
  frame, handhold, crossed hands and arm configuration.
- **Moves are the edges.** Every move starts in one position and ends in another, so
  two moves connect when the end of one matches the start of the next.
- **Combos are paths.** A move can be swapped for any other move with the same start
  and end, a combo can be cut at any position, and a group of moves can be saved as
  a single **compound move**.

It's a directed multigraph: several moves can connect the same two positions.

![Build: the combo as a metro line, the leader view and what can follow](docs/screenshot.png)

## Run it

No server needed. Open `index.html` (or `web/index.html`) in a browser.

After editing the data, rebuild and test:

```bash
npm install
npm run build   # validates data/*.yaml and writes web/data.js
npm test
```

## What you can do

The look follows the MVV (Munich public transport) network map. The combo is a metro
line pinned at the top: each move is a station, and the line leaving it has the colour
of its kind (blue = move, green = styling, orange = adjuster). The kind is always shown
as a dot plus the word, never by colour alone. Four tabs: **Build**, **Map**, **Library**
and **My moves**. Less-used actions (extend, clear, share, print, save as combo, level
filter, start weight) are in the **More** menu. On a phone the tabs sit at the bottom.

**Build combos**
- **What can follow** lists every move that starts where you are: name, kind, counts,
  the half of the phrase a turn is usually led on, and where it ends ("↺ stays" or "→ X").
  Filter by kind or by name.
- **Random** builds 16, 32 or 48 counts in whole 8-counts (8-count moves start on 1) and comes back to the start position. It never drops both hands to reconnect, never undoes the move it just made, and uses each in-place move at most once. **Extend** keeps your combo and continues it.
- **Examples** load the built-in combos as a starting point.

**Edit combos**
- Tap a station to see the move, or to:
  - replace it with a move that has the same start and end
  - insert a move after it (moves that keep the chain connected are listed first)
  - move it, cut the combo there, or expand a combo block into its parts
- Remove a move from the middle and a red **break** appears on the line. Tap it for
  the shortest ways to reconnect (up to 3 moves).
- **Undo** (Ctrl+Z). Keyboard: ← → select, Delete removes, Esc goes back to "what can follow".

**See it**
- **Leader view:** the couple from above as the leader sees it. You (navy) are at the
  bottom facing up, your partner (purple) is placed from the orientation and frame, and
  each of you has a soft view cone. Arms are drawn from the handholds with a light edge,
  so they show over a body; the top hand is thicker when hands are crossed. The dot at a
  hand shows how high it is: small at the waist, bigger at the shoulder, with a ring over the head.
- **Animation:** a selected move plays in the leader view with the count (1-8), a
  scrubber in the colours of the moves and a round play button. Tap a count to stop
  right there (say in the middle of a turn on 3), and step a quarter count back or
  forward with ‹ › (or the arrow keys on the scrubber; Shift for a whole count). Paused,
  the count shows quarters: 3, 3¼, 3½, 3¾. Turns go the way the
  move's name or lead note says, the joined hands go up over the turning head, and in a
  face loop the hand goes over her head without a turn. The picture turns with the
  leader: when the leader turns and that moves the partner round him (a half turn into
  the leader's shadow), the leader is drawn still, the partner goes round, and a line
  under the animation says so. Practice mode animates the same drawing on the beat.
- **Whole combo:** with no station selected, the leader view plays the whole combo move
  after move (combo blocks play their parts) and lights up the station that is playing.
- **Body limits:** every frame keeps to what bodies can do, seen from above: arms reach
  only so far, a hand doesn't go behind its own back (except a hammerlock or a reach to
  the leader's neck), the joined hands rise over the follower's head in a turn, the
  bodies don't overlap, and an arm at waist or shoulder height doesn't go through a body
  (it goes round). With crossed hands the bottom hand can't go up over a head while the
  top one stays low, and an arm only folds behind a back in a turn away from it (a left
  turn for the right arm). Height is three levels (waist, shoulder, over the head), not a
  full 3D model. Every move of every position passes these checks; a move that breaks one
  can be listed in `test/known-issues.mjs` (it is empty now). Arms that still snap
  between two frames are listed in `test/motion.test.mjs` (`KNOWN_ARM_HOPS`).
- **Map:** a hub around one position, like a station on a metro map. The positions one
  move away sit on the inner ring, joined to the middle by a solid blue line (moves), a
  dotted orange line (adjusters) or both; every other position is a dot on the outer
  ring. Tap a station to move it to the middle, tap a line for its moves. The side panel
  shows the position, its ways out (tap one to add it when your combo ends here), **Start
  a combo here** and **Routes from my combo**. Under the hub, **All positions** shows the
  whole graph as dots (positions linked by moves sit close together); tap one to centre
  the hub there.

**Practice**
- **Practice** steps through the combo one big card at a time: the move, its counts
  on the 8, notes and the animated sketch. **Play** advances on the beat (tempo
  slider, optional click or spoken count, loop). Catches and releases show on the card they
  happen in.

**Library**
- Every move in one searchable list (name, notes or position), filterable by kind and
  "to check", with where it starts and ends, its counts and your level. **Add** appears
  when the move can follow the end of your combo. **Positions** lists every position with
  its sketch and notation.

**Levels are yours**
- Moves start unrated. Tap ○○○ in the Library to rate one beginner, intermediate or
  advanced (tap again to change, a fourth time to clear); ratings stay in this browser.
  **More › Show moves** hides moves you rated above a level everywhere, including random
  combos and bridges. Unrated moves always show.

**Add your own moves**
- **My moves → New move:** name, kind, length (4 or 8 counts, or on the fly), where it
  ends and every position it starts in. It's checked like the build would check it and
  works right away in this browser. Moves stay short: anything longer is a **combo**
  (build it, then **More › Save as combo**); combos have their own tab. **For the data
  file (YAML)** gives the lines to paste into `data/moves.yaml` to make them permanent.

**Keep and share**
- **Share link:** the combo lives in the URL, so a link opens the same combo
  anywhere. Moves you added yourself travel inside the link and are added for
  whoever opens it.
- **Copy as text:** the combo as one line of move names and counts plus its link,
  ready for a chat message.
- **Save as combo:** stores the line as one block in this browser.

![Map: a hub around one position, with the overview of all positions](docs/map.png)

## The data

| File | What it holds |
|---|---|
| `data/positions.yaml` | The nodes. Each position is defined by its attributes, and two positions with identical attributes are rejected. |
| `data/moves.yaml` | The edges. Each move has a `from` pattern, a `to`, `counts`, and optional `on`, `weight`, `opposite`, `notes` and `check`. |

A move's `from` can be `any`, a position id, a list of ids, or an attribute pattern
such as `{frame: closed}`. Its `to` can be `same` (styling, the "double domino"), a
position id, or an attribute change such as `{arms: wrap}`. The build expands these
rules into concrete edges, so one "follower right turn" covers every handhold it
works from.

**Hard and soft keys.** Position attributes must match for moves to connect. Timing
(counts within the 8) and weight (mirrored or parallel) are soft: the strip carries
them along and only warns when something doesn't fit.

**Counts.** A move is a module of 4 or 8 counts, written in its own counts (a 4-count
move is "1-2-3, tap 4" wherever it is danced). A 4-count turn also has `on: 1` or
`on: 5`, the half of the phrase it is led on, because a turn is led where the dancer
steps onto the foot of the turn: the follower's right turn and the leader's left turn
on 1, the follower's left turn and the leader's right turn on 5. It is only a hint:
dancers break off the beat. The strip says "usually on 5" when a turn is elsewhere, and
random combos make the usual half likelier.

**Compound moves** list their parts by id. They are live references: if a part
changes so the sequence no longer connects, the build reports the compound as
broken.

**Vocabulary health.** The build lists "thin" positions with fewer than three ways
in or out, which shows where to add moves next.

### Adding a move

Not a coder? See [docs/ADDING_MOVES.md](docs/ADDING_MOVES.md), or
[suggest a move](https://github.com/yahiaelsamman/bachata-move-creator/issues/new?template=new-move.yml)
with a form.

From the repository:

1. Add an entry to `data/moves.yaml` (see the field list at the top of that file).
2. Run `npm run build`. It reports unknown positions, moves that can't start
   anywhere, changes that land on no known position, and broken compounds.
3. Run `npm test`, then reload the page.

## Project layout

| Path | What it is |
|---|---|
| `src/graph.js` | Core: compiles rules into edges, evaluates a strip, bridges, alternatives, random combos. Runs in Node and the browser. |
| `src/generator.js` | Random combos: whole 8-counts, back to the start, no teleport or undo, each in-place move at most once. |
| `src/sketch.js` | Leader-view SVG drawn from a position's attributes. |
| `src/motion.js` | The couple at any moment of a move: turns, paths and hands, for the animation. |
| `src/mirror.js` | Mirror images: swaps left and right in a position or an animation frame and finds which moves are mirrors of each other. A test checks every mirror pair animates as an exact mirror image; the review page uses the pairs so you look at one of each. |
| `src/review.js` | Sorts the moves into review groups (in place, let go / catch, turns, paths), says in words what the hands do and how far the animation really turns someone. |
| `web/review.html` | The review page: a table or filmstrip per move with ✓ / ✗ and a note; marks stay in the browser and "Copy my notes" lists the wrong ones. |
| `src/reach.js` | Body limits: arm reach, how far a shoulder can rotate back, bodies that may not overlap, arms that may not go through a body or (crossed) through the arm on top. The sketch and the animation keep to them; `npm run build` and the tests check every frame of every move. |
| `src/map.js` | Position map: the hub around one position, and a deterministic force layout for the overview of all positions. |
| `src/share.js` | Share links (with moves added in the app), YAML and text exports. |
| `web/index.html`, `web/style.css` | The page and its look (MVV colours as CSS variables; see `docs/design/HANDOFF.md`). `web/fonts/` holds the Asap font (SIL Open Font License). `web/data.js` is generated by the build. |
| `web/app.js` | Page entry point: redraws, toolbar, keyboard shortcuts, boot. Loaded last. |
| `web/ui/dom.js` | Small DOM helpers and the `App` object every UI file adds to. Read its header first. |
| `web/ui/state.js` | The combo, undo, own moves, and every action that changes the combo (`App.edit`). |
| `web/ui/strip.js`, `panel.js`, `map-panel.js`, `reference.js`, `my-moves.js` | One file per part of the page: the combo line, the panel under it, the map, library and positions, my moves and combos. |
| `web/ui/layout.js` | The four tabs, the More menu, and scrolling the panel into view on phones. |
| `web/ui/movie.js` | The animated leader view of a move: Play, scrubber and count. |
| `web/practice.js` | Practice mode (beat counter, click, spoken count). |
| `web/sw.js` | Offline support. Lists every file the page loads. |
| `scripts/build.mjs` | Validates the YAML and writes `web/data.js`. |
| `test/` | Node tests (`npm test`); CI runs them on every push. `npm run e2e` runs fixed UI journeys with a text snapshot (`test/e2e/golden.json`), then a 400-step random UI test, in a real browser (needs Playwright). |

## Publish with GitHub Pages

The workflow in `.github/workflows/pages.yml` publishes the site once Pages is on:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables → New variable:**
   `PAGES_ENABLED` = `true`.
3. Push, or run the workflow from the Actions tab. The site appears at
   `https://<user>.github.io/bachata-move-creator/`.

GitHub Pages needs a public repository on the free plan.

Once it's published, the page can be installed to a phone's home screen ("Add to
Home Screen") and works offline at the venue: a service worker keeps a copy, and
fetches updates whenever there's a connection.

## Status

Test version. Start and end positions of many moves are set to be physically
possible, not taken from a canonical source. Moves flagged with `check` need a
dancer's review. See [docs/ROADMAP.md](docs/ROADMAP.md).
