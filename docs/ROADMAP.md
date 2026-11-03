# Roadmap and open questions

## Needs a dancer (data)

- **Crossed-hands turns (most important):** sources say you turn toward the hand on
  top, which conflicts with the draft. See [RESEARCH.md](RESEARCH.md).
- **Other moves flagged `check`:** the crossed half turn into shadow (which cross
  allows which direction?), the shadow exit turn (which hand is kept), and the
  new crossed-hands outside turn (end hold).
- **Unplaced moves to add once you know their holds:** titanic, media
  vuelta, matador pretzel.
- **Shadow hold:** both versions exist, same hands (`shadow`) and hand on waist
  (`shadow_waist`). Which one is used in practice, and do they connect directly?
- **Hand changes:** do they take their own 4 counts or happen inside a basic (0)?
- **Weight:** are shadow and cuddle really parallel weight?
- **Missing positions:** hammerlock on the left arm, side-by-side
  (Dominican), and a one-hand cuddle (left-to-right with her arm wrapped).
- **Thin positions** (fewer than 3 ways in or out): open R-L, neck wrap,
  hammerlock, shadow. `npm run build` prints the current list.

## Product ideas

- Difficulty level per move, used to filter and to shape random combos.
- Automatic mirroring for moves marked as mirrorable.
- Practice mode: one big card per move with the counts, for use on the floor.
- Video link per move.
- Salsa: the model is style-agnostic, so a second data set would work, with a
  style switch in the page.
- Sharing compounds between dancers (needs storage beyond one browser).
