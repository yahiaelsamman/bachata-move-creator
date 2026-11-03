# Research notes

What public sources say about the open questions, and what changed in the data
because of it. Most bachata sources name moves but rarely state start and end
holds, so the data is still mostly "physically possible", not canonical.

## Crossed hands: which turn from which cross? (unresolved, needs you)

- [Library of Dance bachata guide](https://www.libraryofdance.org/dances/Bachata.pdf):
  from crossed hands, **right over left**, the follower takes an **outside (right)
  turn led with the right hand**. Its "Crossed-Hand Matador" starts the same way,
  with the right hands turning and the left hands kept low.
- [Salsa Forums, "Crossed hold questions"](https://www.salsaforums.com/threads/crossed-hold-questions.24552/):
  rule of thumb, "whichever hand is on top, you turn in that direction". One
  poster warns the rule gets confusing when the hold changes mid-move.
- **Conflict:** the draft data follows your rule (left over right allows the
  right turn). The sources point the other way.
  - Added `crossed-outside-turn` (from right over left), as the sources describe.
  - Flagged `cross-right-turn` and `cross-left-turn` with the conflict.
  - Keep whichever matches how you dance and delete the other.

## Shadow hold (partly answered)

- [Social Dance Bachata](https://socialdancebachata.com/shadow-position-basic-and-2-exits-bachata-sensual-tutorial/):
  the leader is not directly behind the follower; his centre is around her left
  side, which gives more connection and lets her look over her shoulder. The
  leader matches her timing with step-taps when entering.
- No source settled whether the hand on her waist or same-to-same hands is more
  common. Both positions stay in the data.

## Hand-change timing (no answer)

- No source defines when a hand change happens. Step sheets put optional arm work
  on 5–8. The data keeps hand changes as 4-count adjusters and catches/releases
  as 0-count.

## Inside turn timing

- [Toronto Dance Salsa](https://torontodancesalsa.ca/blog/bachata-how-to-lead/):
  the inside turn is prepared with a "C-prep" of the lead (left) hand on 1–4 and
  turned on 5–8, staying close. This is now in the notes of `follower-left-turn`.

## Cuddle = wrap = sweetheart

- [Wikipedia, Promenade (dance move)](https://en.wikipedia.org/wiki/Promenade_(dance_move)):
  cuddle, wrap position, sweetheart and sweetheart's wrap are the same hold. The
  position is now named "Cuddle / wrap / sweetheart".
- [Sydney Salsa Classes](https://www.sydneysalsaclasses.com.au/online-bachata-classes/bachata-basic-turns):
  in bachata the cuddle is a variation of the left turn; exit with a right turn
  prepared on 7–8.

## New moves from sources

- **Sombrero** (double hands, 8 counts): the leader arcs the joined hands over her
  head and then his own (Bailar glossary, as summarised in search results; the
  site blocks automated reading).
- Still named but unplaced, so not added yet: titanic, media vuelta, matador
  pretzel, dishrag sunburst, sweetheart promenade, rollaway variants
  ([Rumba y Timbal library](https://www.rumbaytimbal.com/rumba-video-library/),
  [University of Dance](https://www.universityofdance.org/courses/bachata)).

## Round 2 findings

- **Left-arm hammerlock** ([Rueda wiki](https://ruedawiki.org/index.php/Hammer_lock)):
  facing each other, her left arm behind her back holding the leader's right
  hand, her right hand in his left. Added as `hammerlock_L` with entries from
  double hands and R-L, an unwind and a release. Safety note from
  [Salsa Forums](https://www.salsaforums.com/threads/just-curious-if-you-guys-can-explain-something-to-me.37099/):
  hammerlocks can hurt the follower's shoulder if led carelessly.
- **Hand change on an inside turn** ([BachataHub](https://bachatahub.com/en/academy/term/hand-change)):
  lead the inside turn with your left hand and catch her hand with your right on
  the exit. Added as `inside-turn-hand-change` (open L-R → handshake).
- **Two-hand turn** (Bailar glossary, via search results): both hands stay joined
  through a full outside turn in place, resolving on the tap of 4.
- **Fall forward** (Bailar glossary, via search results): she transfers chest
  weight towards the leader while he steps back; modern and sensual styles.
- **Copa** ([Dance Forums, salsa](https://www.dance-forums.com/threads/copa-in-salsa.9123/)):
  starts from left-over-right double hands; she steps forward on 5 and turns
  left on 6–7. Salsa timing, so the bachata version is flagged for review.
- **Difficulty levels:** there is no standard syllabus. Course outlines broadly
  agree that beginner covers basics, simple turns and connection; intermediate
  covers turn variations, wraps, hammerlocks, shadow and body movement; advanced
  adds dips, intricate hand combinations and styling
  ([Udemy intermediate partner work](https://www.udemy.com/course/bachata-dance-partner-work-course-intermediate-level/),
  [TU Dresden course levels](https://www.dhsz.tu-dresden.de/angebote/aktueller_zeitraum/_Bachata.html)).
  The levels in `data/moves.yaml` are a draft on that basis.
- **Shadow holds connect:** the two shadow holds are now linked by 0-count
  adjusters (take both hands / hand to waist). That is physically possible,
  not sourced.
- **Titanic, media vuelta:** still no description of the holds; not added.

## Prior art (for later)

| Project | What it is |
|---|---|
| [GrappleMap](https://github.com/Eelis/GrappleMap) | BJJ positions and transitions graph |
| [adharsh/Salsa](https://github.com/adharsh/Salsa) | Salsa as a directed graph |
| [Salsa en Movimientos](https://www.salsaenmovimientos.com/positions_ideal) | 3,400 salsa moves classified by start/end position (12-digit position codes) |
| [Salsa Handbook](https://salsahandbook.github.io/output/salsa-positions.html) | Position notation such as FEO and SBS |
| [MDD dataset](https://arxiv.org/html/2508.16911) | Motion capture of duets, including bachata, with handhold annotations |
