# Visualization: what exists, what fits us, and a proposal

Written after a search of how people, partners, dance and grappling are visualized (2D and 3D).
Nothing here is decided: it is for us to go through together. Where a claim is my own inference
and not from a source, it says so. Gaps in what I could find are listed at the end.

## 1. What I found

### Grappling (the closest relative of our project)

- **GrappleMap** ([repo](https://github.com/LeviMunk/GrapMap), public domain) is the closest thing to
  what we are building: "a database of interconnected grappling positions and transitions, animated
  with stick figures". Each *position* is a pose of **two** stick figures stored as 3D joint
  coordinates; each *transition* is a list of keyframe poses between two positions. Everything is in
  one plain-text file so changes show up in diffs. Has a web explorer, a composer (chain moves) and a
  web editor where people pose the figures by hand. The author is frank about the limits: the
  animation is "schematics", timing is "not really captured at all", grips are "barely modeled", and
  the figures are drawn with as few joints as possible ("added more only as necessary").
  *Lesson:* people accept simple stick figures if the **poses are right** and the **graph is
  explorable**. Nothing I read mentions joint limits or collision checks, so plausibility there is
  up to the person authoring each pose.
- **BJJ Graph** ([bjjgraph.org](https://bjjgraph.org/)), **Matnet** ([iOS](https://apps.apple.com/app/id1175062894)),
  **Grapla** ([Product Hunt](https://www.producthunt.com/products/grapla)), **BJJ Tech Tree** (a "subway
  map", [site](https://bjj-tech-tree.pages.dev/)) and **Graphling**
  ([BJJML](https://medium.com/@Graphling/intro-to-brazilian-jiu-jitsu-modeling-language-bjjml-9dd689ddd048))
  are position/transition maps for study. They are about *content and navigation* (flashcards,
  "what comes next", counters, simulated rolls), not about drawing bodies. One summary of BJJ Graph said
  153 positions and 226 transitions, but its transitions index looked far longer when I read it (an
  estimate of 1,000+ from page size), so treat the counts as unreliable. Its site says its
  "probabilities are model estimates, not measured".
  *Lesson:* the graph view is the product; the body drawing is a small part of it.

### Partner dance

- **DanceVis** ([itch.io](https://lbrooks.itch.io/dancevis)): a free 3D (Unity, in the browser) tool "for men
  to learn how to lead". An idle basic loops; buttons appear for the next move, and *some moves only
  work while another is playing*, which is a move graph in disguise. Free camera (rotate, pitch,
  zoom). Not open source as far as I could tell.
- **Dance Kitchen** ([iOS, paid](https://apps.apple.com/us/app/dance-kitchen/id6443764461)): salsa and
  bachata, **feet** synced to the music, lead or follow role, counts shown on the feet.
  **DanceLib** ([iOS](https://apps.apple.com/ky/app/dancelib/id6670781631)): *video* library of 11 partner
  dances, 4 camera angles per move. **iDance** ([3D4Medical](https://3d4medical.com/apps/idance)): 3D
  fitness patterns and a routine builder, not partner dance.
- **Salsational** ([UCT honours project, 2019](https://projects.cs.uct.ac.za/honsproj/cgi-bin/view/2019/baijnath_chetty_marajh.zip/DEDANCE_website/)):
  a grammar for salsa moves plus an animation from motion capture. Its authors found "very little work"
  on turning paper salsa moves into 3D movement.
- **bachatamap.ru** (found in the first round of research): a Russian library of bachata positions and
  moves. I did not check how it draws or animates anything.
- **CoMPAS3D** ([arXiv](https://arxiv.org/abs/2507.19684)): motion capture of improvised partner salsa,
  3 hours, 18 dancers, 2,800+ expert-labelled segments. Real data, but improvised and salsa, and I did
  not verify the dataset licence or the file format.

### Notation and choreography software

- **Labanotation / Benesh**: precise, but "very few people understand these notations"
  ([tutoring-system paper](https://arxiv.org/pdf/1001.0440)); some tools only edit scores, a
  few turn them into animation ([LabanLab](https://cislab.hkust-gz.edu.cn/media/documents/LabanLab.pdf)). *Not a UI for our users.*
- **LifeForms / DanceForms** ([SFU](https://www.sfu.ca/sfunews/stories/2019/11/sfu-software-key-to-choreographer-merce-cunningham-work.html)):
  Merce Cunningham used it from 1989: figures made of simple shapes, posed in a studio window and played
  on a stage; meant as an *idea generator*, not a realistic simulator.
  **ChoreoVis** ([paper](https://arxiv.org/pdf/2404.04100), 2024): a web app for planning group
  formations with a floor view (positions, orientations, trajectories) and a pose view side by side.
- **Ballroom / Scottish diagrams** ([example](https://www.scottish-country-dancing-dictionary.com/diagram/conventions-in-footwork-diagrams.html)):
  footprints on a floor plan with a legend; readers are taught "where a step starts, how the body
  turns, where it arrives". This is the visual language dancers already know.

### Moving bodies in a browser

- **Rendering a figure**: three.js with a rigged glTF/VRM character is standard
  ([Mixamo to glTF](https://www.donmccurdy.com/2017/11/06/creating-animated-gltf-characters-with-mixamo-and-blender),
  [Mixamo onto VRM](https://github.com/V-Sekai/three-vrm-1-sandbox-mixamo)). Mixamo supplies single-dancer
  animations; I found no partner-dance clips there, and retargeting them to two bodies holding hands is
  its own project.
- **Inverse kinematics** (arms reaching a hand target): three.js ships a
  [CCD solver](https://threejs.org/docs/pages/CCDIKSolver.html) with per-bone rotation limits;
  [ik-threejs](https://github.com/upf-gti/ik-threejs) adds FABRIK with ball-socket and hinge constraints.
  For a two-bone arm, a small hand-written analytic solver is enough (my inference: our arms are
  already two segments with an elbow).
- **Joint limits and physics**: ball-socket joints are described by a swing cone and a twist range,
  hinges by one axis ([glTF constraints](https://docs.vulkan.org/tutorial/latest/Advanced_glTF/Physics_Integration/03_constraints_and_joint_limits.html));
  [Rapier in three.js](https://dev.to/mattvb91/realistic-ragdoll-physics-in-threejs-1pko) is a ragdoll
  example. Physics engines are for *falling*; for authored poses plain limit checks (which we already
  have in 2D) are the better fit (my inference).
- **Generated two-person motion**: [InterGen](https://tr3e.github.io/intergen-page) makes two-person
  motion from text, trained on a dataset that includes Latin dancing. It is not controllable enough
  for teaching a specific hold (my inference), so I would not build on it.
- **Posable mannequins** ([Magic Poser](https://magicposer.com/)): drag control points and a physics
  step settles the rest. Useful as a model for an *editor*, not for playback.

### Does 3D teach better than 2D?

The evidence I found is thin. A small study with a stereoscopic 3D dance video found better
reproduction of left/right direction than 2D
([Korean study](https://scholar.korea.ac.kr/handle/2021.sw.korea/70198),
[Japanese grant summary](https://kaken.nii.ac.jp/grant/KAKENHI-PROJECT-23500760)); a tennis-serve
study compared a 2D schematic with 3D styles ([UNIMAS](https://ir.unimas.my/id/eprint/31603/)); in
non-motor tasks people with more prior knowledge did better with the simpler 2D animation. My reading:
**3D helps beginners see direction and depth; simple schematics are enough, even preferred, once you
know the move.** Which suggests offering both.

## 2. What this means for us

1. **Our real difference from GrappleMap: poses are generated, not drawn.** Each position is a few
   attributes (orientation, frame, hands, crossing, arms) and the figure is derived; moves interpolate.
   That is why we have 23 positions and 151 moves checked by tests, which would be a large hand-drawing
   job in GrappleMap's way. The cost: the pose is only as good as our rules. The option that combines
   both: generate by default and let a position or move carry **hand-set pose overrides** where the
   rules look wrong.
2. **Our model is already 3D minus one number.** The top-down sketch is a projection. Heights exist only
   as three levels (waist, shoulder, over the head) used for collisions. If the *source model* held real
   3D joints (x, y and height z), then:
   - the current top-down view stays, as a projection of the same data;
   - a **side view** costs almost nothing (it is the same joints seen from the side);
   - a **3D orbit view** is just another renderer;
   - collision checks become correct (an arm passing *over* a head is then a fact, not a flag).
   This is the main idea of the proposal below.
3. **Two audiences need two views.** The map and the combo strip need a *small, glanceable* picture
   (like a transit-map icon); the move detail needs a *readable, rotatable* picture. GrappleMap's
   per-position pages and the BJJ maps both split it this way.
4. **Nobody did timing for dance in a map**, and our counts, beat sync and "usually on 5" are already
   ahead of what I found. Dance Kitchen shows feet on the counts, which we have no data for yet.

## 3. Options

| | Looks | Effort | Works offline / from a file | Fits our data | Main risk |
|---|---|---|---|---|---|
| **A. Better 2D top-down** (SVG, as now): jointed arms with elbows, hands, footprints, nicer figures | Schematic, like a ballroom diagram | Small | Yes | Fully | No height; hands over a head stay a ring |
| **B. Own small 3D skeleton**, drawn on a 2D canvas (no libraries): joints and capsule limbs, orbit camera, depth-sorted | GrappleMap-like stylised figures | Medium | Yes | Fully (one 3D model for all views) | We write the camera and sorting ourselves |
| **C. three.js with simple capsule/mannequin figures**, driven by our own solver | Cleaner, lit, smoother | Medium to large | Needs a vendored copy of three.js; module loading from `file://` is awkward | Fully | Adds a dependency and a build/vendoring step |
| **D. Rigged avatars** (VRM/Mixamo, skinned meshes) | Most realistic | Large | As C | Poorly: skinned bodies in contact need retargeting and collision work for every hold | Uncanny, and each hold becomes an animation job |
| **E. Motion capture** (e.g. CoMPAS3D, or our own) | Real | Very large | — | Poorly: improvised, other dance, unverified licence | Wrong moves, licensing |

## 4. Proposal (for discussion)

**Step 1: a 3D pose model underneath, no visible change.** Positions get joints in x, y, z
(shoulders, elbows, hands, hips, head; feet later). Arms by a two-bone solver with reach and
shoulder limits, the same limits we already test, now in 3D. The top-down SVG is drawn from it. All
current tests keep passing, and the "height" flag becomes real.

**Step 2: a better 2D**, option A: figures with shoulders, elbows and hands; a side view as a
small second picture (free from step 1); footprints once we have step data.

**Step 3: an orbit view**, option B or C. I would start with B (no dependency, works offline and
from a file) and judge by eye whether it needs C. D and E I would leave out.

**Step 4 (parallel, needs you): the website design**, section 5.

**Keep from GrappleMap:** one plain-text data file that diffs well (we have YAML), per-position pages,
a composer (our strip), and an *editor* for hand-fixing a pose. **Skip:** hand-drawing every pose.

## 5. The design of the site, and finding your taste

I found no source on what makes a site look generated, so this part is my own observation: the tells
are usually purple-to-blue gradients, glass cards, one font for everything, a centred hero with a
gradient headline, emoji or stock icon sets, and every box the same rounded rectangle with the same
shadow. Our current look (cream paper, terracotta accent) is already past some of these but is still a
template. A design that feels *made* usually has one strong idea that fits the subject.

Ideas grounded in what the site is, as three very different **directions** (not a menu to mix):

1. **Dance manual / field notebook.** Cream paper, ink line drawings, a serif for titles and a mono for
   counts, footprint-style diagrams, margin notes. Fits the top-down schematic and the "move
   dictionary" job. Reference idea: old ballroom charts.
2. **Studio at night.** Dark, one warm stage-light accent, big condensed numbers for counts, motion
   first, the figures glowing like a rehearsal-room mirror. Fits practice mode.
3. **Explorable essay.** Lots of white space, a move explained in a few sentences with the figure
   inline and draggable, like [Bret Victor's explorable explanations](https://worrydream.com/ExplorableExplanations/)
   or the hand-built interactive articles of Bartosz Ciechanowski. Fits learning, less so the map.
4. **Transit map** for the graph view only: positions as stations, moves as lines, a fixed layout by
   frame and orientation so you learn where things are.

**How we find your taste, as you said it is hard to put into words:**

1. **Collect, don't describe.** Send me 10 to 15 screenshots or links of anything you like the look of
   (apps, sites, posters, album covers, studio flyers, even rooms and clothes) and 5 you dislike. The
   subject doesn't matter.
2. **Pick between pairs.** I show two options for one thing at a time (type, colour, a card, the figure
   style) and you say which and, if you can, one word why. Fast, and you never write a brief.
3. **Three static mock-ups** of the *same screen* (the Build tab with a combo) in three directions
   from the list above. You mark what you like in each; we merge only after that.
4. **Then rules**: a small design system (colours, type, spacing, how things move) written down so it
   stays consistent.

## 6. Questions for you

1. Are you happy with **3D underneath, 2D on top first** (steps 1 and 2), and the orbit view later?
2. How **realistic** should the figures be: schematic stick figures (GrappleMap), simple capsule
   mannequins, or something closer to a person?
3. Which **views** matter most: top-down (as now), side, rotate-around, or the follower's point of
   view?
4. Do you want a hand-pose **editor** so you can fix a position yourself, or should fixes go through me?
5. Design: start with the collecting step?

## 7. What I could not find or verify

- Other partner-dance move graphs besides bachatamap.ru; no open-source one with animation.
- Any controlled study of 2D vs 3D for partner dance; only the small ones above.
- GrappleMap's position and transition counts and its pose file format in detail (the file is 2.5 MB;
  I could read only the first part), and whether it has any joint-limit checks.
- CoMPAS3D's dataset licence and file format; DanceVis's licence and internals.
- Pose estimation from phone video (MediaPipe and similar) as a way to capture real poses of our
  positions: not researched, but worth a look if we want real reference data.
