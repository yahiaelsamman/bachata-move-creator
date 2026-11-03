# Bachata Move Creator

Link social dance moves like dominoes and build new combinations.

- **Positions are the nodes.** A position is the state of the couple: orientation,
  frame, handhold, crossed hands and arm configuration.
- **Moves are the edges.** Every move starts in one position and ends in another, so
  two moves connect when the end of one matches the start of the next.
- **Combos are paths.** A move can be swapped for any other move with the same start
  and end, a combo can be cut at any position, and a group of moves can be saved as a
  single **compound move**.

It's a directed multigraph: several moves can connect the same two positions.

![Domino strip](docs/screenshot.png)

## Run it

No server needed. Open `web/index.html` in a browser.

After editing the data, rebuild:

```bash
npm install
npm run build   # validates data/*.yaml and writes web/data.js
npm test
```

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

## In the app

- Click **+ next move** to see what can follow the current end position (A–Z, filterable by kind).
- Click any domino to see details, replace it with a move that has the same start and end, move it, cut the combo there, or expand a compound.
- Remove a domino from the middle and a red **bridge** marker appears. Click it for the shortest ways to reconnect (up to 3 moves).
- **Random combo** walks the graph. **Save as compound** stores the strip as one block (in this browser); copy its YAML into `data/moves.yaml` to keep it.

## Status

First test version. The moves are a draft; the ones flagged with `check` need a
dancer's review.
