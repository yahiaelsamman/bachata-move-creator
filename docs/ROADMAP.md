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

## Needs a dancer (animation)

- **Paseala** stands still. Sliding the follower out to the leader's right side while
  she keeps facing him looked wrong (his left arm stretched across both bodies). Should
  she open up beside him, both facing forward, and come back?
- **Hand change (behind the back)** shows a plain hand swap. Draw the hand going round
  behind the leader's back?
- **Cross body lead:** the leader's quarter turn to the left is not drawn (the picture
  turns with the leader). Show it?
- **Arm hops:** the leader's right arm still swings quickly round her when wrapping
  into or out of the cuddle, and the follower's arm in the shadow neck turn
  (`KNOWN_ARM_HOPS` in `test/motion.test.mjs`). Slowing the hand down after a turn fixes
  them but puts an arm through her body in the shadow entries, so it needs a better idea.

## Product ideas

- Hand-identity check in the build: a move may not change which leader hand
  holds which follower hand unless it catches, releases or regrips.
- Structured notes: separate leader and follower cues, per-count cues, common
  mistakes, video links.
- Automatic mirroring for moves marked as mirrorable.
- Salsa: the model is style-agnostic, so a second data set would work, with a
  style switch in the page.
- Sharing compounds between dancers (needs storage beyond one browser).
