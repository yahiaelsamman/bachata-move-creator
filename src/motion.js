/*
 * Motion: the couple at any moment of a move, for the animated leader view.
 *
 *   turnsOf(move) -> { follower, leader }   how far each dancer turns, in degrees
 *                                           (clockwise seen from above is positive, so a
 *                                           right turn is +360, a left half turn -180)
 *   frameAt(move, from, to, t) -> layout    the couple at t (0 = start, 1 = end), in the
 *                                           shape LeaderSketch.drawSVG draws
 *   movieBounds(move, from, to) -> bounds   one picture area for the whole move
 *   frameSVG(move, from, to, t, bounds) -> SVG markup
 *
 * Turns come from an optional `turn: { follower, leader }` field on the move, otherwise from its
 * name ("Follower right turn (double)" → follower +720). Either way the total is made to agree
 * with how the start and end positions face, so a frame at t = 1 is exactly the end position.
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
  function turnsOf(move) {
    const out = { follower: 0, leader: 0, free: null };
    if (move && move.turn && typeof move.turn === 'object') {
      for (const k of ['follower', 'leader']) if (Number.isFinite(move.turn[k])) out[k] = move.turn[k];
      return out;
    }
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

  /** Total rotation from a to b that matches the wanted turn as closely as the geometry allows. */
  function totalRotation(fromDeg, toDeg, wanted) {
    const base = shortest(fromDeg, toDeg);
    if (!wanted) return base;
    return base + 360 * Math.round((wanted - base) / 360);
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

    const follower = SK.body(center, unit(fAngle));
    const leader = SK.body(L0, unit(lAngle));
    // Hands: the start hold for the first half of the move, the end hold for the second.
    const hold = t < 0.5 ? from : to;
    return { leader, follower, label: (t < 0.5 ? A : B).label, ...SK.armsFor(hold, leader, follower) };
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

  return { turnsOf, frameAt, movieBounds, frameSVG, totalRotation, shortest };
});
