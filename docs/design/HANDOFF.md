# Design handoff: build the approved look into the real app

Status: implemented in `web/` (all six screens). Decisions made while building:
- Map "Whole map": option B. The hub stays the main view; an "All positions" overview (force layout, dots and faint links) sits under it, and tapping a dot moves the middle of the hub there. On phones the outer-ring names are hidden (they are in the overview and on tap).
- Levels are the user's own ratings (Library, tap ○○○), stored in this browser; unrated moves always pass the level filter (More menu). Share links accept moves without a level.
- Font is self-hosted (`web/fonts/`, SIL OFL) so the page works offline and from file://.
- Less-used actions (extend, clear, share, print, save as combo, level filter, start weight) live in the More menu; on phones Random and Undo move there too.
Read `docs/DESIGN_TASTE.md` first. Mockups: `docs/design/mockups/*.dc.html` (static HTML with `{{c.token}}` placeholders; the PNG renders show them filled in with the `mvv` palette).

## The look (approved)
- Modelled on the MVV (Munich public transport) 2026 network map, because Yahia is from Munich.
- Font: **Asap** (Google Fonts; weights 400-800). It is the font used on the MVV map.
- Tokens (`mvv`):
  - bg `#ffffff`, panel `#f6f7e8`, land `#ebeccc` (map background), ink/navy `#1b2644`, muted `#5d6479`, rule `#dcdec2`
  - header lime `#acc13f` (header text `#1b2644`, inactive tabs `#3b4720`), link (map connectors) `#7d849c`
  - move (blue) `#2a3f9a`, styling (green) `#2a8a45`, adjuster (orange) `#c95d00`, partner (purple) `#8a2f86`, cone `#e1e5c0`
  - Keep an alternate `munich` palette (cool greys, U-Bahn blue/green/orange) as a second option.
- Layout chrome: lime rounded header band (logo = two overlapping circles, tabs Build / Map / Library / My moves, buttons on the right), white page, panels with 2px navy outline and 10px radius, navy footer bar ("151 moves · 23 positions" on the right).
- The kind of move (move / styling / adjuster) is a small dot plus the word (words omitted only on the phone list). Colour is never the only signal.
- Blue means "move" and nothing else: the partner is purple, count highlight is navy.
- No new colours or functions beyond this. Yahia explicitly does not want extra route colours or extra features in the design phase.

## Screens
1. **Build** (1000x680): combo as a compact metro line (stations = moves, line colour = kind, `+` station at the end, "16 counts / ends in X" on the right); leader view card (bigger couple, leader cone navy-tinted, partner cone purple-tinted, labels YOU / PARTNER); tiny COUNT widget bottom-left (1-8, current one navy), segmented scrubber, play button; right column "What can follow" with kind filter chips and rows (name, dot+kind word, counts, "usually on N", "stays X" / "to X").
2. **Map**: see the open question below. Current mock = hub around the selected position, inner ring = positions one step away, outer ring = further dots; spokes only from the selected position; move = solid blue, adjuster = dotted orange, both = two parallel lines; labels outside the dots with a halo; sidebar with position info, "Ways out" list, buttons "Start a combo here" / "Routes from my combo". The layout sketch is `mockups/map-layout-sketch.cjs` (radial layout from the real graph).
3. **Library**: search, kind chips, Moves/Positions toggle, table (Move, Starts in, Ends in, Counts, Level). Yahia likes this one as is. Levels: my estimates were wrong, so levels are shown as unrated until the user sets them (tap to set).
4. **My moves**: cards for the user's own moves plus a "New move" form (name, starts in, ends in, kind, length 4 / 8 counts). Longer things are called combos and live in a Combos tab; moves stay short.
5. **Practice**: big leader view, speed and beat options, the combo list, Prev / Pause / Next. Yahia will not use it much; do not spend time here.
6. **Phone** (390x844): lime header, compact combo strip, leader view, "What can follow" as a bottom sheet with 44px rows, each row shows where it ends ("stays" / "to X") so more is visible without extra taps; bottom tabs.

## Open question for the implementer: the Map's "Whole map" chip
The chip row says `Around Open L-R | Whole map`, but the mock only shows the hub around one position (the other 9 positions as plain dots). Options:
- A. Keep the hub as the only view; "Whole map" = every position placed on the rings by distance, no extra edges. Scales best.
- B. Hub plus a small overview of all 23 positions beside it (dots only), tapping a dot re-centres the hub.
- C. A true full graph (all links). Rejected for now: it was an unreadable hairball with about 100 crossing lines.
Recommendation: B, with the hub unchanged. Ask Yahia before building if unsure.

## Implementation notes
- The real app is plain browser scripts (UMD) in `web/` with `web/style.css`, `web/ui/*.js`, `web/app.js`; data in `web/data.js` built by `scripts/build.mjs`. Keep that structure; no framework.
- Start with tokens (CSS variables), font, header and footer; then Build; then Map (use `src/map.js` data; the radial layout replaces the force layout); then Library, My moves, Practice, phone layout.
- Bump the service worker cache (`web/sw.js`, currently `bmc-v9`) when assets change. Run the tests (`npm test`) and the Playwright checks before pushing.
- Follow the contrast rules: text at least 4.5:1, graphics at least 3:1 (the orange `#c95d00` was chosen for this), touch targets at least 44px on the phone, no text under 10px.
- Do not name any AI tool in commits, code or docs (user rule). Git identity: Yahia <yahiaelsamman03@gmail.com>.
