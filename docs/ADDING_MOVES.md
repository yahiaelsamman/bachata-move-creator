# Adding moves

Every move is a domino: it **starts** in one position and **ends** in another.
To add one, you need to know three things: where it can start, where it ends, and
roughly how many counts it takes.

## Without any coding

**Suggest it.** Open a
[new "Suggest a move" issue](https://github.com/yahiaelsamman/bachata-move-creator/issues/new?template=new-move.yml).
Pick the start and end positions from the lists and describe how to lead it.

**Or try it in the app first.**
1. Open the [app](https://yahiaelsamman.github.io/bachata-move-creator/), scroll
   to **My moves and compounds** and fill in **Add a move**.
2. It works right away in your browser, and you can build combos with it.
3. **Share link** sends a combo including your move to someone else.
4. **Copy YAML** gives you the lines to paste into an issue or into the data file.

## Editing the data file

1. Open [`data/moves.yaml`](../data/moves.yaml) on GitHub and click the pencil icon.
2. Paste the YAML from the app, or copy an existing move and change it. The fields
   are explained at the top of the file.
3. Use the naming convention: family, action, variant in brackets. For example
   "Shadow exit (push-out)".
4. Propose the change. The automatic checks then tell you whether it connects:
   - unknown positions
   - moves that can't start anywhere
   - end positions that don't exist
   - compound moves that break

## Checking it on your computer

```bash
npm install
npm run build   # validates the data and lists positions that need more moves
npm test
```

Then open `index.html` in a browser.

## When a position is missing

Positions live in [`data/positions.yaml`](../data/positions.yaml). A position is
defined by:
- **orientation:** facing, shadow, side by side…
- **frame:** closed, semi, open or apart
- **hands:** who holds what, e.g. `L>R` means the leader's left holds the
  follower's right
- **crossed hands:** whether, and which hand is on top
- **arms:** special configurations such as a hammerlock or wrap

The leader view sketch is drawn from these, so if the sketch looks wrong, the
position data is wrong.
