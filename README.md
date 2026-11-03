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

![Domino strip with leader view](docs/screenshot.png)

## Run it

No server needed. Open `index.html` (or `web/index.html`) in a browser.

After editing the data, rebuild and test:

```bash
npm install
npm run build   # validates data/*.yaml and writes web/data.js
npm test
```

## What you can do

**Build combos**
- **+ next move** lists everything that can follow where you are (A–Z, filter by
  name or kind).
- **Random combo** walks the graph and finds its way back to the start position.
- **Examples** load the compound moves from the data as a starting point.

**Edit combos**
- Click a domino to see details, or to:
  - replace it with a move that has the same start and end
  - insert a move after it (moves that keep the chain connected are listed first)
  - move it, cut the combo there, or expand a compound move into its parts
- Remove a domino from the middle and a red **bridge** marker appears. Click it for
  the shortest ways to reconnect (up to 3 moves).
- **Undo** (Ctrl+Z). Keyboard: ← → select, Delete removes, Esc goes back to "next move".

**See it**
- **Leader view:** a top-down sketch of the position as the leader sees it. You're
  at the bottom facing up, she's placed from the orientation and frame, arms are
  drawn from the handholds, and the top hand is drawn thicker when hands are
  crossed. A selected move shows its start and end.
- **Map of positions:** every position with arrows for the moves between them. Your
  combo is drawn as a path. Click a position for its ways in and out, to start a
  new combo there, or to get the shortest routes there from the end of your combo.

**Practice**
- **Practice** steps through the combo one big card at a time: the move, its counts
  on the 8, notes and the start/end sketches. **Play** advances on the beat (tempo
  slider, optional click, loop). Catches and releases show on the card they
  happen in.

**Keep and share**
- **Share link:** the combo lives in the URL, so a link opens the same combo
  anywhere.
- **Save as compound:** stores the strip as one block in this browser. Copy its
  YAML into `data/moves.yaml` to make it permanent.

![Map of positions](docs/map.png)

## The data

| File | What it holds |
|---|---|
| `data/positions.yaml` | The nodes. Each position is defined by its attributes, and two positions with identical attributes are rejected. |
| `data/moves.yaml` | The edges. Each move has a `from` pattern, a `to`, `counts`, and optional `weight`, `opposite`, `notes` and `check`. |

A move's `from` can be `any`, a position id, a list of ids, or an attribute pattern
such as `{frame: closed}`. Its `to` can be `same` (styling, the "double domino"), a
position id, or an attribute change such as `{arms: wrap}`. The build expands these
rules into concrete edges, so one "follower right turn" covers every handhold it
works from.

**Hard and soft keys.** Position attributes must match for moves to connect. Timing
(counts within the 8) and weight (mirrored or parallel) are soft: the strip carries
them along and only warns when something doesn't fit.

**Compound moves** list their parts by id. They are live references: if a part
changes so the sequence no longer connects, the build reports the compound as
broken.

**Vocabulary health.** The build lists "thin" positions with fewer than three ways
in or out, which shows where to add moves next.

### Adding a move

1. Add an entry to `data/moves.yaml` (see the field list at the top of that file).
2. Run `npm run build`. It reports unknown positions, moves that can't start
   anywhere, changes that land on no known position, and broken compounds.
3. Run `npm test`, then reload the page.

## Project layout

| Path | What it is |
|---|---|
| `src/graph.js` | Core: compiles rules into edges, evaluates a strip, bridges, alternatives, random combos. Runs in Node and the browser. |
| `src/sketch.js` | Leader-view SVG drawn from a position's attributes. |
| `src/map.js` | Position map: deterministic force layout and SVG. |
| `web/` | The page (`index.html`, `app.js`, `style.css`) and the generated `data.js`. |
| `scripts/build.mjs` | Validates the YAML and writes `web/data.js`. |
| `test/` | Node tests (`npm test`); CI runs them on every push. `npm run e2e` runs a 400-step random UI test in a real browser (needs Playwright). |

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
