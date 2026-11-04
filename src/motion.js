/*
 * Motion: the couple at any moment of a move, for the animated leader view.
 *
 *   turnsOf(move) -> { follower, leader, couple }   how far each dancer turns, in degrees
 *                                           (clockwise seen from above is positive, so a
 *                                           right turn is +360, a left half turn -180);
 *                                           `couple` is both turning together
 *   frameAt(move, from, to, t) -> layout    the couple at t (0 = start, 1 = end), in the
 *                                           shape LeaderSketch.drawSVG draws
 *   movieBounds(move, from, to) -> bounds   one picture area for the whole move
 *   frameSVG(move, from, to, t, bounds) -> SVG markup
 *
 * Turns come from an optional `turn: { follower, leader, couple }` field on the move, otherwise
 * from its name ("Follower right turn (double)" → follower +720) or lead note. Either way the
 * total is made to agree with how the start and end positions face, so a frame at t = 1 is
 * exactly the end position.
 *
 * The picture is the leader's view (leader at the bottom facing up at the start and the end).
 * While a move plays, a leader turn on the spot shows the leader spinning and a couple turn turns
 * the whole picture of the couple, so turns that don't change the position still show.
 * Hands move gradually from where they are in the start hold to where they are in the end hold.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sketch.js'));
  else root.Motion = factory(root.LeaderSketch);
})(typeof self !== 'undefined' ? self : this, function (SK) {
  'use strict';

  const clamp01 = (t) => Math.min(1, Math.max(0, Number(t) || 0));
  const angleOf = (v) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  const unit = (deg) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpPt = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
  /** Smallest signed angle from a to b, in (-180, 180]. */
  const shortest = (a, b) => { const d = ((b - a) % 360 + 540) % 360 - 180; return d === -180 ? 180 : d; };

  /**
   * Turn size and direction read from a move's name, e.g. "Leader left turn", "half right turn".
   * Phrases about hands and arms ("under the left arm", "release left", "right over left") say
   * nothing about the turn's direction, so they are ignored. Both dancers turning together (a
   * couple turn) doesn't change anything from the leader's point of view.
   */
  const clean = (text) => String(text || '').toLowerCase()
    .replace(/\b(left|right) (arm|hand|shoulder|side|foot|leg|hip)s?\b/g, '')
    .replace(/\b(release|keep|catch|picks up|holds?) (the )?(left|right)\b/g, '')
    .replace(/\b(left|right) over (left|right)\b/g, '')
    .replace(/\b(left|right)-to-(left|right)\b/g, '');

  function turnFromName(name) {
    const n = clean(name);
    if (!/\b(turn|spin)\b/.test(n) || /\bcouple turn\b/.test(n)) return null;
    const who = /\bleader\b/.test(n) && !/\bfollower\b/.test(n) ? 'leader' : 'follower';
    const size = /\bhalf\b/.test(n) ? 180 : /\b(double|two turns)\b/.test(n) ? 720 : 360;
    const sign = /\b(left|inside)\b/.test(n) ? -1 : /\b(right|outside)\b/.test(n) ? 1 : 0;
    return { who, sign, size };
  }

  /** A turn described in the lead note: "the follower makes a half turn to the left", "into a left turn". */
  function turnFromNotes(notes) {
    const n = clean(notes);
    const m = n.match(/\b(left|right) (half )?turn\b/) || n.match(/\bturns? (half way |a half turn )?(to the )?(left|right)\b/) ||
      n.match(/\bhalf turn (to the )?(left|right)\b/) || n.match(/\bunwinds? (to the )?(left|right)\b/);
    if (!m) return null;
    const dir = m.slice(1).find((x) => x === 'left' || x === 'right');
    const who = /\bthe leader (turns|makes|spins)\b/.test(n) ? 'leader' : 'follower';
    return { who, sign: dir === 'left' ? -1 : 1, size: /\bhalf\b/.test(m[0]) ? 180 : 360 };
  }

  /**
   * { follower, leader } in degrees; `free` names a dancer whose turn has no stated direction
   * (frameAt then turns the shorter way, or a full right turn if start and end face the same way).
   */
  /** Both dancers turning together: "Couple turn", or a note like "pivot together to the right". */
  function coupleTurn(move) {
    const name = String((move && move.name) || '').toLowerCase();
    const notes = clean(move && move.notes);
    if (!/\bcouple turn\b/.test(name) && !/\b(pivot|turn|rotate)s? together\b/.test(notes)) return 0;
    const dir = notes.match(/\btogether (to the )?(left|right)\b/);
    return dir && dir[2] === 'left' ? -360 : 360;
  }

  function turnsOf(move) {
    const out = { follower: 0, leader: 0, couple: 0, free: null };
    if (move && move.turn && typeof move.turn === 'object') {
      for (const k of ['follower', 'leader', 'couple']) if (Number.isFinite(move.turn[k])) out[k] = move.turn[k];
      return out;
    }
    out.couple = coupleTurn(move);
    if (out.couple) return out;
    let t = turnFromName(move && move.name);
    // The name says "turn" but not which way, or doesn't mention a turn: the lead note may say.
    const fromNotes = move && /\bcouple turn\b/i.test(move.name || '') ? null : turnFromNotes(move && move.notes);
    if (fromNotes && (!t || !t.sign)) t = { ...fromNotes, size: t ? t.size : fromNotes.size };
    if (!t) return out;
    if (t.sign) out[t.who] = t.sign * t.size;
    else { out[t.who] = t.size; out.free = t.who; }
    return out;
  }

  /** How far a dancer turns between two facings, given the wanted turn (see turnsOf). */
  function turnFor(turns, who, fromDeg, toDeg) {
    if (turns.free === who) {
      const base = shortest(fromDeg, toDeg);
      return Math.abs(base) < 1 ? turns[who] : base;
    }
    return totalRotation(fromDeg, toDeg, turns[who]);
  }

  /**
   * Total rotation from a to b that matches the wanted turn as closely as the geometry allows, in
   * the wanted direction. On a tie the smaller turn wins: "unwinds to the right" from the cuddle to
   * facing is a half turn right, not one and a half.
   */
  function totalRotation(fromDeg, toDeg, wanted) {
    const base = shortest(fromDeg, toDeg);
    if (!wanted) return base;
    const k = Math.floor((wanted - base) / 360);
    const options = [base + 360 * k, base + 360 * (k + 1)].filter((c) => Math.sign(c) === Math.sign(wanted) || Math.abs(c) < 1e-9);
    options.sort((a, b) => Math.abs(a - wanted) - Math.abs(b - wanted) || Math.abs(a) - Math.abs(b));
    return options[0];
  }

  /** The cross body lead: the follower passes the leader's right side on the way. */
  const passesRightSide = (move) => /cross body lead/i.test((move && move.name) || '');

  function frameAt(move, from, to, t) {
    t = clamp01(t);
    const A = SK.placeBodies(from);
    const B = SK.placeBodies(to);
    const turns = turnsOf(move);

    const L0 = A.leader.c;
    const rel = (b) => [b.follower.c[0] - L0[0], b.follower.c[1] - L0[1]];
    const aFrom = angleOf(rel(A)), aTo = angleOf(rel(B));
    const samePlace = Math.abs(shortest(aFrom, aTo)) < 1;

    // The picture is the leader's own view, so the leader stays facing up. When the leader turns
    // and that changes where the follower is (e.g. a half turn into the leader's shadow), the
    // follower goes round him the other way. A leader turn on the spot is drawn as the leader spinning.
    const leaderSpins = turns.leader && samePlace;
    const orbit = !leaderSpins && turns.leader ? totalRotation(aFrom, aTo, -turns.leader) : shortest(aFrom, aTo);
    const dist = lerp(Math.hypot(...rel(A)), Math.hypot(...rel(B)), t);
    let center = [L0[0] + dist * unit(aFrom + orbit * t)[0], L0[1] + dist * unit(aFrom + orbit * t)[1]];

    const fFrom = angleOf(A.follower.face), fTo = angleOf(B.follower.face);
    const fAngle = fFrom + turnFor(turns, 'follower', fFrom, fTo) * t;
    const lFrom = angleOf(A.leader.face);
    const lAngle = lFrom + (leaderSpins ? turns.leader : 0) * t;

    if (passesRightSide(move)) {
      // Swing out to the leader's right side and back (a curve through a point beside him).
      const side = [A.leader.c[0] + 52, A.leader.c[1] - 14];
      const bend = 4 * t * (1 - t);
      center = lerpPt(center, side, bend);
    }

    let follower = SK.body(center, unit(fAngle));
    let leader = SK.body(L0, unit(lAngle));
    if (turns.couple) {
      // Both turn together: turn the whole couple about the point between them.
      const pivot = lerpPt(leader.c, follower.c, 0.5);
      const spin = (b) => SK.body(rotateAbout(b.c, pivot, turns.couple * t), unit(angleOf(b.face) + turns.couple * t));
      leader = spin(leader);
      follower = spin(follower);
    }
    return { leader, follower, label: (t < 0.5 ? A : B).label, ...blendHolds(from, to, leader, follower, t) };
  }

  function rotateAbout(p, c, deg) {
    const [cos, sin] = unit(deg);
    const dx = p[0] - c[0], dy = p[1] - c[1];
    return [c[0] + dx * cos - dy * sin, c[1] + dx * sin + dy * cos];
  }

  /** 0 for the first quarter of the move, 1 for the last quarter, a smooth S-curve in between. */
  const holdChange = (t) => { const x = clamp01((t - 0.25) / 0.5); return x * x * (3 - 2 * x); };

  /**
   * Hands during a move: each hand moves gradually from where it is in the start hold to where it is
   * in the end hold (an unwrap unwinds instead of jumping). A hand only in the start hold lets go
   * halfway; a hand only in the end hold takes hold halfway.
   */
  /** Which side of the follower each leader hand is on in a position's own sketch (kept while turning). */
  function sidesOf(pos) {
    return Object.fromEntries(SK.layout(pos).arms.filter((a) => a.who === 'leader').map((a) => [a.hand, a.side]));
  }

  function blendHolds(from, to, leader, follower, t) {
    const A = SK.armsFor(from, leader, follower, { sides: sidesOf(from) });
    const B = SK.armsFor(to, leader, follower, { sides: sidesOf(to) });
    const s = holdChange(t);
    if (s <= 0) return A;
    if (s >= 1) return B;
    const key = (a) => a.who + a.hand;
    const inB = new Map(B.arms.map((a) => [key(a), a]));
    const inA = new Set(A.arms.map(key));
    const arms = [];
    for (const a of A.arms) {
      const b = inB.get(key(a));
      if (!b) { if (s < 0.5) arms.push(a); continue; }
      const viaA = a.via || lerpPt(a.from, a.to, 0.5);
      const viaB = b.via || lerpPt(b.from, b.to, 0.5);
      const to = lerpPt(a.to, b.to, s);
      arms.push({
        ...(s < 0.5 ? a : b),
        from: lerpPt(a.from, b.from, s),
        via: a.via || b.via ? lerpPt(viaA, viaB, s) : null,
        to,
        grip: (s < 0.5 ? a.grip : b.grip) ? to : null,
      });
    }
    for (const b of B.arms) if (!inA.has(key(b)) && s >= 0.5) arms.push(b);
    return { arms, top: s < 0.5 ? A.top : B.top };
  }

  /** One picture area for the whole move, so the drawing doesn't jump while it plays. */
  function movieBounds(move, from, to) {
    const frames = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].map((t) => SK.boundsOf(frameAt(move, from, to, t)));
    const pick = (k, f) => f(...frames.map((b) => b[k]));
    return { top: pick('top', Math.min), bottom: pick('bottom', Math.max), left: pick('left', Math.min), right: pick('right', Math.max) };
  }

  function frameSVG(move, from, to, t, bounds = movieBounds(move, from, to)) {
    return SK.drawSVG(frameAt(move, from, to, t), { bounds });
  }

  return { turnsOf, frameAt, movieBounds, frameSVG, totalRotation, shortest, holdChange };
});
