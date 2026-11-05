/*
 * Body limits for the top-down sketch: what bodies, shoulders and arms can physically do.
 * Sizes are in sketch units: the shoulders are 40 apart, so an arm reaches about 64.
 *
 *   fitGrip(a, b, wanted)        a point two arms can both reach, near `wanted`, without either hand
 *                                going behind its own back (a = { shoulder, face, hand, limit | mayGoBehind })
 *   shortenAround(from, via, to) a hand that goes round the partner's body, pulled in to arm length
 *   bodiesOverlap(a, b)          do two body outlines overlap?
 *   separate(leader, follower)   the follower's centre, moved out from the leader until they don't
 *   problems(layout, position)   what is still physically wrong in a frame (used by the tests)
 *
 * This is a 2D model seen from above: it keeps arms within reach, shoulders within their range and
 * bodies apart. It does not model height (a hand over a head is drawn where it is seen from above).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BodyLimits = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ARM = 64;            // shoulder to hand, fully stretched
  const BEHIND = -0.3;       // a hand may go a little behind the shoulder line (cos of the angle to the front), not behind the back
  // An arm's `limit` is the cos of the furthest-back angle it may point: BEHIND normally, -1 = any way.
  const limitOf = (arm) => (arm.limit !== undefined ? arm.limit : arm.mayGoBehind ? -1 : BEHIND);
  const BODY = { rx: 24, ry: 9 };   // the outline drawn in the sketch: shoulders across, chest to back

  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const len = (v) => Math.hypot(v[0], v[1]);
  const right = (f) => [-f[1], f[0]];

  /** Move a point into one arm's reach: no further than ARM, and not behind the back (unless allowed). */
  function intoReach(p, arm) {
    let v = sub(p, arm.shoulder);
    let L = len(v);
    if (L > ARM) { v = mul(v, ARM / L); L = ARM; }
    const limit = limitOf(arm);
    if (limit > -1 && L > 1e-6 && dot(v, arm.face) / L < limit) {
      // Swing the arm forward to the edge of its range: a left hand to the left side, a right hand to
      // the right (anatomically where it goes, and no flip-flopping when it points straight back).
      const r = right(arm.face);
      const sign = arm.hand === 'L' ? -1 : arm.hand === 'R' ? 1 : dot(v, r) >= 0 ? 1 : -1;
      const a = Math.acos(limit);
      v = mul(add(mul(arm.face, Math.cos(a)), mul(r, sign * Math.sin(a))), L);
    }
    return add(arm.shoulder, v);
  }

  /** A grip both arms can reach (alternating projections; converges quickly for these shapes). */
  function fitGrip(a, b, wanted) {
    let p = wanted;
    for (let i = 0; i < 200; i++) {
      const next = intoReach(intoReach(p, a), b);
      const moved = len(sub(next, p));
      p = next;
      if (moved < 1e-9) break;        // settled: fitting a fitted grip again leaves it where it is
    }
    return p;
  }

  /** A hand going round the partner's body to her back or waist, pulled in so the arm is long enough. */
  function shortenAround(from, via, to) {
    const first = len(sub(via, from));
    if (first >= ARM) return { via: add(from, mul(sub(via, from), ARM / first)), to: add(from, mul(sub(via, from), ARM / first)) };
    const rest = ARM - first;
    const second = len(sub(to, via));
    return { via, to: second > rest ? add(via, mul(sub(to, via), rest / second)) : to };
  }

  /**
   * Where the elbow is for a bent arm from `shoulder` to `hand` (upper arm and forearm half an arm
   * each), bending towards `outwards`. A hand at full stretch gives a straight arm.
   */
  function elbow(shoulder, hand, outwards) {
    const v = sub(hand, shoulder);
    const d = Math.min(len(v), ARM);
    if (d < 1e-6) return add(shoulder, mul(outwards, ARM / 2));
    const u = mul(v, 1 / len(v));
    const n = right(u);
    const up = Math.sqrt(Math.max(0, (ARM / 2) ** 2 - (d / 2) ** 2));
    // Which side the elbow bends to follows `outwards`; near the switch the bend fades through a straight
    // arm instead of jumping to the other side.
    return add(add(shoulder, mul(u, d / 2)), mul(n, up * Math.tanh(4 * dot(n, outwards))));
  }

  /** Is point p inside body b's outline (scaled by k)? */
  function inside(p, b, k = 1) {
    const d = sub(p, b.c);
    const u = dot(d, right(b.face)) / (BODY.rx * k);
    const v = dot(d, b.face) / (BODY.ry * k);
    return u * u + v * v < 1;
  }

  /** Points around a body's outline. */
  function outline(b, n = 24) {
    const r = right(b.face);
    return Array.from({ length: n }, (_, k) => {
      const th = (2 * Math.PI * k) / n;
      return add(b.c, add(mul(r, BODY.rx * Math.cos(th)), mul(b.face, BODY.ry * Math.sin(th))));
    });
  }

  /** Do two bodies overlap? (Touching, a few units in, is fine: dancers in close hold touch.) */
  function bodiesOverlap(a, b) {
    return outline(a).some((p) => inside(p, b, 0.85)) || outline(b).some((p) => inside(p, a, 0.85));
  }

  /** The follower's centre moved straight out from the leader until the bodies no longer overlap. */
  function separate(leader, follower, makeBody) {
    if (!bodiesOverlap(leader, follower)) return follower;
    const out = sub(follower.c, leader.c);
    const dir = len(out) > 1e-6 ? mul(out, 1 / len(out)) : [0, -1];
    for (let step = 1; step <= 40; step++) {
      const moved = makeBody(add(follower.c, mul(dir, step * 1.5)), follower.face);
      if (!bodiesOverlap(leader, moved)) return moved;
    }
    return follower;
  }

  /**
   * Hands that may go behind their own back in a position: the folded arm of a hammerlock, and the
   * follower reaching back over the shoulder to the leader's neck.
   */
  function allowedBehind(position) {
    const arms = String((position && position.arms) || '');
    const out = new Set();
    const m = arms.match(/^hammerlock_(leader|follower)_(L|R)$/);
    if (m) out.add(m[1] + m[2]);
    if (arms === 'follower_R_behind_leader_neck') out.add('followerR');
    return out;
  }

  const pathLength = (pts) => pts.slice(1).reduce((s, p, i) => s + len(sub(p, pts[i])), 0);

  const RAISED = 1.5;            // a hand this high (see sketch.js: 0 waist, 1 shoulder, 2 over the head) is over a head
  const OVER_SHOULDERS = 1.05;   // an arm with the hand this high goes over the partner's shoulders, not through her

  /** Do segments ab and cd cross? */
  function segmentsCross(a, b, c, d) {
    const side = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
  }

  /**
   * Does an arm go through a body? Seen from above an arm that hugs a body cuts its outline a little,
   * so only the inner part of the body counts (k). An arm's own shoulder is on its own body's edge, so
   * the first few units of its own arm don't count. A hand allowed behind its own back (a hammerlock)
   * lies across that back, so its own body doesn't count for it.
   */
  function armThroughBody(pts, b, skipStart, k = 0.55) {
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i];
      const n = Math.max(2, Math.ceil(len(sub(q, p)) / 2));
      for (let j = 1; j <= n; j++) {
        const x = add(p, mul(sub(q, p), j / n));
        if (len(sub(x, pts[0])) < skipStart) continue;
        if (inside(x, b, k)) return true;
      }
    }
    return false;
  }

  /**
   * What is still physically wrong in a frame:
   *   overlap  the bodies overlap
   *   reach    an arm longer than an arm
   *   behind   a hand behind its own back where the position doesn't allow it
   *   through  an arm at waist or shoulder height going through a body
   *   under    crossed hands: the bottom hand goes up over a head while the top one stays low, so its
   *            arm would pass through the arm on top
   * `allowedBehind` lists hands that may go behind their own back in this position (hammerlocks).
   */
  function problems(L, allowedBehind = new Set()) {
    const out = [];
    if (bodiesOverlap(L.leader, L.follower)) out.push({ kind: 'overlap' });
    for (const a of L.arms) {
      if ((a.h || 0) > OVER_SHOULDERS) continue;
      const pts = [a.from, a.via, a.to].filter(Boolean);
      const own = a.who === 'leader' ? L.leader : L.follower;
      const other = a.who === 'leader' ? L.follower : L.leader;
      // A segment at shoulder height or above (an elbow over a shoulder, a hand reaching up behind a
      // neck) goes over the shoulders, not through the chest.
      const overShoulder = a.via && a.viaH >= 1;
      const lowPts = !overShoulder ? pts : (a.h || 0) >= 1 ? [] : [a.via, a.to];
      if (lowPts.length > 1 && armThroughBody(lowPts, other, 0)) out.push({ kind: 'through', who: a.who, hand: a.hand, body: 'partner' });
      else if (!allowedBehind.has(a.who + a.hand) && !a.acrossFront && armThroughBody(pts, own, 8, 0.5)) out.push({ kind: 'through', who: a.who, hand: a.hand, body: 'own' });
    }
    for (const top of L.crossing || (L.top ? [L.top] : [])) {
      const arm = (hand) => L.arms.find((x) => x.who === 'leader' && x.hand === hand && x.grip);
      const upper = arm(top), lower = arm(top === 'R' ? 'L' : 'R');
      if (upper && lower && (lower.h || 0) >= RAISED && (upper.h || 0) < 1) {
        out.push({ kind: 'under', who: 'leader', hand: lower.hand });
      }
    }
    for (const a of L.arms) {
      const me = a.who === 'leader' ? L.leader : L.follower;
      const pts = [a.from, a.via, a.to].filter(Boolean);
      const length = pathLength(pts);
      if (length > ARM + 1) out.push({ kind: 'reach', who: a.who, hand: a.hand, amount: Math.round(length) });
      const dir = sub(pts[1], a.from);
      // A hand up over a head (a turn under the arm) may point further back when seen from above (`limit`).
      const limit = a.limit !== undefined ? a.limit : BEHIND;
      // (A hand right at its own shoulder is a folded arm; its direction says nothing.)
      if (len(dir) > 10 && !allowedBehind.has(a.who + a.hand) && dot(dir, me.face) / len(dir) < limit - 0.02) {
        out.push({ kind: 'behind', who: a.who, hand: a.hand });
      }
    }
    return out;
  }

  return { ARM, BEHIND, BODY, RAISED, OVER_SHOULDERS, allowedBehind, elbow, segmentsCross, fitGrip, intoReach, shortenAround, bodiesOverlap, separate, problems, inside };
});
