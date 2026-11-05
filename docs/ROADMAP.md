# Roadmap and open questions

## Needs a dancer (data)

- **Moves still flagged `check`** (the library can filter them): mostly new
  moves from Russian sources whose start hold or counts are inferred (leader's
  hammerlock, mill turn, delayed turn,
  face loops, cuddle ocho, impulso, pinza into shadow), plus copa (salsa source),
  the shadow mill exit and the Madrid step.
- **Braid:** removed. It could not be found in any online source and looks the same as
  crossed hands (left over right or right over left). It and its four moves (two-hand
  turn into the braid, pretzel exit, braid unwind, whip) and the "Pretzel" combo block
  built on them are in the git history. The pretzel can come back once we agree what
  position the wrap ends in.
- **Leader's shadow** is only reachable at level 3, through crossed hands or
  the follower's shadow. Is there a common intermediate entry?
- **Missing positions:** back to back (named in Spanish and French sources, hold
  not described), side-by-side and hip-to-hip (Dominican, moderna walk-arounds),
  semi-closed with his hands under her elbows (Russian *poluzakrytaya*), a hands
  on her hips hold for hip rolls, the leader's pretzel.
- **Unplaced moves:** matador pretzel, ropes, lasso, helicopter, exit through
  the window, statuette, lateral dip, comb / peinado, turning basic in open.
- **Thin positions** (fewer than 3 ways in or out): `npm run build` prints the
  current list.

## Product ideas

- Hand-identity check in the build: a move may not change which leader hand
  holds which follower hand unless it catches, releases or regrips.
- Structured notes: separate leader and follower cues, per-count cues, common
  mistakes, video links.
- Automatic mirroring for moves marked as mirrorable.
- Salsa: the model is style-agnostic, so a second data set would work, with a
  style switch in the page.
- Sharing compounds between dancers (needs storage beyond one browser).
