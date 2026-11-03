# Research notes

What public sources say about the open questions, and what changed in the data
because of it. Most bachata sources name moves but rarely state start and end
holds, so the data is still mostly "physically possible", not canonical.

## Crossed hands: which turn from which cross? (resolved)

**Rule kept:** with the leader's **right hand on top** (`cross_Rtop`) the follower's
free turn is a **left (inside) turn**; with the **left on top** (`cross_Ltop`) it is
a **right (outside) turn**. A full free turn flips which hand is on top, and a
half turn in the free direction ends in shadow with the hands uncrossed.
Confirmed by a dancer review (10+ years, sensual, Dominican and moderna).

Why it works:
- Crossed hands facing each other are half a twist between the two arm pairs. A
  half turn by the follower adds or removes half a twist. Only one direction
  brings it to zero (shadow, arms clean); the other gives a full twist and the
  arms wind round each other.
- With right over left her right arm lies on top. Turning left, her right
  shoulder comes forward and that arm sweeps over the other one, so nothing
  collides. Turning right, her left shoulder comes forward under the right arm
  and the arms lock; forcing it puts the left hands behind her neck or bends a
  wrist.
- The rule of thumb "turn toward the hand on top"
  ([Salsa Forums](https://www.salsaforums.com/threads/crossed-hold-questions.24552/))
  means the **leader's** top hand as he sees it. Right on top: she travels toward
  his right, which is **her left**. So the rule agrees with the data; the old
  `check` text had read it from her side.
- The [Library of Dance](https://www.libraryofdance.org/dances/Bachata.pdf)
  "outside turn from right over left" exists, but only when the bottom (left)
  hands are let go. It is now `crossed-outside-turn` from right over left to the
  **handshake** ("release left").

Try it in 30 seconds: hold right over left with a partner and lift both hands.
If she turns left, you come out left over right. If she turns right, her left
hand ends behind her own neck.

What changed in the data: the `check` on `cross-right-turn`, `cross-left-turn`
and both crossed half turns into shadow is cleared; the half turns and the shadow
turn-backs now name their direction; `copa` now starts from right over left (the
free direction); `sombrero-crossed` starts only from right over left; the
leader's shadow entry starts from right over left (the leader turns left, the
same free direction).

## Shadow hold (answered)

- [Social Dance Bachata](https://socialdancebachata.com/shadow-position-basic-and-2-exits-bachata-sensual-tutorial/):
  the leader is not directly behind the follower; his centre is around her left
  side, which gives more connection and lets her look over her shoulder. The
  leader matches her timing with step-taps when entering.
- Both holds are used (dancer review): sensual mostly puts the hand on her waist
  or stomach; moderna and Dominican use both hands too. They connect directly,
  through the 0-count hand switches. Shadow, cuddle and the leader's shadow are
  parallel weight; the leader changes feet, the follower keeps her footwork.

## Hand-change timing (answered)

- No source defines when a hand change happens. Step sheets put optional arm work
  on 5–8. The dancer review agrees with the data: hand changes take 4 counts,
  catches and releases happen on the fly (0 counts).

## Inside turn timing

- [Toronto Dance Salsa](https://torontodancesalsa.ca/blog/bachata-how-to-lead/):
  the inside turn is prepared with a "C-prep" of the lead (left) hand on 1–4 and
  turned on 5–8, staying close. In the data the turn itself is 4 counts and its
  note says to prep during the previous 4.

## Cuddle, wrap and sweetheart

- [Wikipedia, Promenade (dance move)](https://en.wikipedia.org/wiki/Promenade_(dance_move))
  treats cuddle, wrap and sweetheart as one hold. In sensual bachata,
  "sweetheart" usually means her wrapped **in front of** him (leader behind), so
  the data now has both: `cuddle` (side, "Cuddle / wrap (side)") and
  `shadow_wrap` ("Sweetheart"), linked by a slide.
- The plain left turn that keeps the hand usually ends in a **one-hand wrap**
  (`wrap_R`, her right arm across her waist); the second hand is only caught if
  she offers it (`wrap-catch-left`).
- [Sydney Salsa Classes](https://www.sydneysalsaclasses.com.au/online-bachata-classes/bachata-basic-turns):
  in bachata the cuddle is a variation of the left turn; exit with a right turn
  prepared on 7-8.

## New moves from sources

- **Sombrero** (double hands, 8 counts): the leader arcs the joined hands over her
  head and then his own (Bailar glossary, as summarised in search results; the
  site blocks automated reading).
- Still named but unplaced: matador pretzel, dishrag sunburst, sweetheart
  promenade, rollaway variants. Titanic is now placed (arms open in shadow) and
  media vuelta is the half turn into shadow (`half-turn-into-shadow`)
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
- **Titanic, media vuelta:** placed in round 4 (see below).

## Round 3: sources in other languages

Searched Spanish, French, German, Italian, Portuguese, Polish and Russian sources.

### Confirmed by several languages

- **Hammerlock from double hands.** The leader raises his left arm and keeps the
  right at waist height; she turns **right** and her (left) arm ends behind her
  back; she unwinds with a **left** turn. Sources:
  - French: [wikidanse.fr, "Tour Espagnol Fille (Hammerlock)"](https://wikidanse.fr/danse-bachata-liste-figures.php)
  - German: [in-tanz.de, "Brezel": Eindrehen with a full right turn, Ausdrehen with a full left turn](https://www.in-tanz.de/tanz/bachata-brezel.html)
  - Spanish: [Redance, "candado"](https://redance.app/en/vocabulary/bachata/hammer-lock/)

  This matches `hammerlock-left-entry` and `hammerlock-left-unwind`.
- **Shadow entry from closed.** The leader pushes her right arm back and she makes
  a half turn to the **left** (wikidanse.fr). The draft note said right and has
  been corrected. Spanish schools call it *media de follower*
  ([Unibaila](https://www.unibaila.com/blog-de-bachata-sensual/aprende-bachata-sensual-diez-tecnicas));
  Russian lists call it *half-turn woman*
  ([bachata-salsa-lessons.ru](https://bachata-salsa-lessons.ru/25-elementov-bachaty-dlya-nachinayushhih/)).
- **Two shadows.** Besides the follower's shadow (her in front) there is a
  **leader's shadow**: him in front, her arms sliding between his back and arms.
  It appears in Spanish (Unibaila: *media de líder*, *sácala*, *mantón*,
  *comeback*), French (*enroulé garçon devant fille*) and Russian (*half-turn
  man*). Added as the position `leader_shadow` with an entry, an exit and the
  two switches.
- **Pretzel = wrap + leader turn.** The first half is the wrap (her back against
  him, arms crossed on her chest); on 5–8 the leader turns under the arms and you
  end face to face in a crossed grip
  ([Redance](https://redance.app/es/vocabulary/bachata/); Russian *pod krylo* /
  cradle / basket, [bachatamap.ru](https://bachatamap.ru/theory/positions/pretzel/)).
  Added as a compound move `pretzel`.

### New figures added

| Figure | Hold | Source |
|---|---|---|
| Paséala (walk her out and back) | closed, right hand at her waist | wikidanse.fr |
| Couple turn (tour en couple) | closed | wikidanse.fr |
| Forward break | closed or open | Redance, wikidanse.fr |
| Caress (caricia, caresse) | closed, shadow, cuddle, neck wrap | Redance, wikidanse.fr |
| Elbows (coudes; Russian *elbows-in*, *gancho*) | double hands | wikidanse.fr, bachata-salsa-lessons.ru |
| Sombrero from crossed hands | crossed hands | Redance |
| Shadow exit, half turn under left arm | shadow | wikidanse.fr |
| Shadow exit, mill (*melnitsa*, *molino*, *helicóptero*) | shadow | bachatamap.ru, Introvert Dance (mechanics not described, flagged) |
| Cuddle exit, throw the arms into shadow | cuddle | wikidanse.fr |

### Levels from a real curriculum

[Introvert Dance's sensual pensum](https://introvertdance.com/wp-content/uploads/2023/11/Bachata-sensual-pensum-de-Introvert-Dance-lista-de-pasos-completa.pdf)
(Spanish):
- **Básico 2:** hammerlock and pretzel.
- **Básico 3:** shadow posture, back to back and reverse turn.
- **Básico 4:** molino (helicopter), Madrid step.
- **Intermedio 2:** shadow exits with 1½, double and triple turns, and the
  *sentada de sombra*.

That broadly supports the draft levels: hammerlock and shadow intermediate,
mill and shadow exits with multiple turns advanced.

### Still open

- **Crossed hands:** no source in any language says which hand on top allows
  which turn (resolved by a dancer review in round 4, see the top). Note that the Spanish "Bachata cruzados" series
  ([Mucho Más Que Baile](https://www.muchomasquebaile.es/bachata-cruzados/)) is
  about crossed *footwork*, not hands. The same series consistently enters
  two-hand figures with a counter-clockwise turn and exits to the embrace with a
  clockwise one.
- **Back to back** (*espalda con espalda*, *dos à dos*) is a named position in
  the Spanish and French sources, but no source describes how the hands connect,
  so it is not added yet.
- **Titanic:** named after the shape of her arms (Spanish video descriptions);
  placed in round 4 as arms open wide in shadow.
- **Italian figures** (elastico, elicottero, sospensione laterale) are named
  only ([ballobachata.it](https://www.ballobachata.it/figure-bachata-facili-1839.html)).

### Name glossary

| English | Spanish | French | German | Russian |
|---|---|---|---|---|
| Hammerlock | candado | tour espagnol (hammerlock) | Brezel | хаммерлок / arm breaker |
| Wrap / cuddle | envoltura | enroulé | – | обёртка, конфетка |
| Pretzel | pretzel | enroulé promenade | Brezel (sometimes) | крендель, под крыло |
| Shadow | sombra | shadow / ombre | Schatten | теневая позиция |
| Cross body lead | dile que no | – | – | – |
| Mill | molino, helicóptero | – | – | мельница |
| Caress | caricia | caresse | – | – |

## Round 4: dancer review and Russian sources

### Dancer review: corrections

A dancer review walked every edge, tracking three things: **hand identity**
(which leader hand holds which follower hand; a move cannot change that unless it
releases, catches or regrips), **rotation** (who turns, which way, how far) and
**arm topology** (arms over a head, around a body, or twisted round each other).

| Move | Change | Why |
|---|---|---|
| `crossed-outside-turn` | now ends in the handshake, "release left" | turning right from right over left with both hands winds the arms |
| `pretzel-leader-turn-out` | ends in the new `double_braided` | the cuddle hold is L-R and R-L; with no hand released it cannot end in crossed hands (L-L, R-R) |
| `leader-shadow-entry` | starts from right over left | from double hands his arms end crossed over his own neck |
| `leader-shadow-take-out` | ends in open L-L | L-L and R-R cannot become L-R without a regrip |
| `shadow-entry-from-open` | half left turn under his left hand | the old "leader steps behind" means walking half a circle round her |
| `shadow-exit` | named "left turn, keep left hand"; mirror `shadow-exit-keep-right` added | keeping L-L means she turns left, no arm over her head |
| `release-all` | only from facing positions | letting go in shadow or cuddle does not leave her facing you |
| `behind-back-to-crossed` | ends in the handshake (id kept) | the behind-the-back pass ends naturally in the handshake; `regrip-cross-r-over-l` makes crossed hands |
| `left-turn-into-cuddle` | ends in the one-hand wrap `wrap_R` (id kept) | the second hand is caught only if she offers it |
| `cross-body-lead` | also from closed | most bachata cross body leads start closed |

Also: explicit turn directions in names and notes, safety notes for head rolls,
dips, hammerlocks and neck moves, and levels re-set with a teacher's review (box
step, couple turn, two-hand turn, cuddle in and out to beginner; neck wrap,
sombrero, pretzel and the simple dip to intermediate).

New positions: `shadow_neck`, `shadow_wrap` (sweetheart), `wrap_R` (one-hand
wrap), `double_braided` (twisted double hands, where the pretzel and a two-hand
turn without a halo land). New moves include the forward and back basic, the
cross body lead with outside turn, a led body wave, cambre and titanic.

### Russian sources

Read: 91 pages of [bachatamap.ru](https://bachatamap.ru/) and
[bachata-salsa-lessons.ru](https://bachata-salsa-lessons.ru/post-series/perechen-elementov-v-bachate/).
Russian names are now in the `aka` field of about 35 moves and positions.

- **Leader's hammerlock** (*khamerlok muzhchiny*, *setenta*, Spanish *hamlet
  inverso*): the leader turns right and his own left arm ends behind his back.
  Added as position `hammerlock_leader_L` with an entry and a dive-under exit
  (start hold and exit inferred, flagged `check`).
- **Two-hand turn ends braided** (*fonarik*, *kosichka*): without a halo the
  joined arms end twisted. Added `two-hand-turn-braid` into `double_braided`,
  plus the whip (*khlyst*) and the unwind. The plain `two-hand-turn` keeps the
  halo.
- **Full contact** (*polnyy kontakt*): in Russian sensual teaching the closed
  position means both his palms on her shoulder blades. Added `full_contact`
  with the fall (*prised*) and impulso.
- Also added: mill turn (*melnitsa*), delayed turn on 3, cuddle ocho, the two
  face loops (*shapochka* / hair brush, *sharfik* / scarf), shadow entry from the
  pinza.
- **Name clash:** in Russian, *caricia* is the arm thrown over her head (the
  hair-brush face loop), not a caress. The app's `caricia` stays a caress; the
  Russian meaning is the `aka` of `hair-brush`.
- `couple-turn` now also starts in shadow and cuddle (*vrashchenie v pare* is
  listed in open, closed, shadow and pretzel).

## Prior art (for later)

| Project | What it is |
|---|---|
| [GrappleMap](https://github.com/Eelis/GrappleMap) | BJJ positions and transitions graph |
| [adharsh/Salsa](https://github.com/adharsh/Salsa) | Salsa as a directed graph |
| [Salsa en Movimientos](https://www.salsaenmovimientos.com/positions_ideal) | 3,400 salsa moves classified by start/end position (12-digit position codes) |
| [Salsa Handbook](https://salsahandbook.github.io/output/salsa-positions.html) | Position notation such as FEO and SBS |
| [MDD dataset](https://arxiv.org/html/2508.16911) | Motion capture of duets, including bachata, with handhold annotations |
