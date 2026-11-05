/*
 * Leader-view sketch: a top-down drawing of a position, as the leader would
 * picture it. The leader is always at the bottom, facing up (towards the top
 * of the picture). Everything is derived from the position's attributes, so a
 * sketch that looks wrong points at a position whose data is wrong.
 *
 *   sketchSVG(position) -> SVG markup string (no DOM needed)
 *   placeBodies(position) -> { leader, follower }   where the two dancers stand
 *   armsFor(position, leader, follower) -> arms      the hand connections between them
 *   drawSVG(layout, { bounds }) -> SVG               used by the animation (src/motion.js)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./reach.js'));
  else root.LeaderSketch = factory(root.BodyLimits);
})(typeof self !== 'undefined' ? self : this, function (Limits) {
  'use strict';

  const W = 180;
  const H = 190;
  const LEADER = { x: 90, y: 148 };
  const SHOULDER = 20;

  // Where the follower stands relative to the leader, and which way she faces.
  // dir: unit vector from leader to follower; face: follower's facing vector.
  const ORIENTATION = {
    facing:         { dir: [0, -1], face: [0, 1], label: 'facing you' },
    shadow:         { dir: [0, -1], face: [0, -1], label: 'in front of you, facing away' },
    reverse_shadow: { dir: [0, 1], face: [0, -1], label: 'behind you' },
    side_by_side_R: { dir: [0.96, -0.28], face: [0, -1], label: 'at your right side' },
    side_by_side_L: { dir: [-0.96, -0.28], face: [0, -1], label: 'at your left side' },
    hip_to_hip:     { dir: [1, 0], face: [0, 1], label: 'at your right, facing the other way' },
    back_to_back:   { dir: [0, 1], face: [0, 1], label: 'back to back' },
  };
  const DISTANCE = { closed: 36, semi: 48, open: 86, apart: 108 };
  // How high a hand on the body is (0 = waist, 1 = shoulder, 2 = over the head). The hand on her back
  // in closed position is on the shoulder blade.
  const CONTACT_HEIGHT = { back: 1, waist: 0, shoulder: 1 };
  const SIDE_DISTANCE = { closed: 46, semi: 54, open: 80, apart: 96 };

  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const right = (f) => [-f[1], f[0]]; // screen coords, y grows downwards
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const r1 = (n) => Math.round(n * 10) / 10;
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const pt = (p) => `${r1(p[0])},${r1(p[1])}`;

  function body(center, face) {
    const r = right(face);
    return {
      c: center,
      face,
      shoulder: { L: add(center, mul(r, -SHOULDER)), R: add(center, mul(r, SHOULDER)) },
      angle: (Math.atan2(face[1], face[0]) * 180) / Math.PI + 90,
    };
  }

  function parseHands(h) {
    return String(h || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [leader, follower] = s.split('>');
        return { leader: leader.trim(), follower: (follower || '').trim() };
      });
  }

  /** Where the two dancers stand for a position (leader at the bottom, facing up). */
  function placeBodies(p) {
    const o = ORIENTATION[p.orientation] || ORIENTATION.facing;
    const sideways = Math.abs(o.dir[0]) > 0.5;
    let d = (sideways ? SIDE_DISTANCE : DISTANCE)[p.frame] ?? DISTANCE.open;
    // In a hammerlock the couple stands closer: the hand behind a back has to be reached round a body.
    if (/^hammerlock_/.test(p.arms || '') && p.frame === 'semi') d = 40;
    return {
      leader: body([LEADER.x, LEADER.y], [0, -1]),
      follower: body(add([LEADER.x, LEADER.y], mul(o.dir, d)), o.face),
      label: o.label,
    };
  }

  /** Whether she stands beside the leader (arms go round her back over the far shoulder) and which shoulder is far. */
  function styleOf(p, leader, follower) {
    if (!leader) ({ leader, follower } = placeBodies(p));
    const rel = sub(follower.c, leader.c);
    return {
      beside: Math.abs(dot(rel, right(leader.face))) > Math.abs(dot(rel, leader.face)),
      farSide: dist(leader.c, follower.shoulder.R) > dist(leader.c, follower.shoulder.L) ? 'R' : 'L',
    };
  }

  /** Layout of both dancers and every arm, in picture coordinates. */
  function layout(p) {
    const { leader, follower, label } = placeBodies(p);
    return { leader, follower, label, ...armsFor(p, leader, follower) };
  }

  /**
   * The hand connections of a position, drawn between two dancers wherever they stand.
   * A hand on the follower's back or waist goes to the nearer side of her body; `opts.sides`
   * ({ L: 1 | -1, R: ... }, +1 = the follower's right side) fixes that side instead, so a hand
   * doesn't flip sides while she turns in an animation. Each leader arm reports its `side`.
   */
  function armsFor(p, leader, follower, opts = {}) {
    const fr = right(follower.face);
    const sides = opts.sides || {};

    // Where each of the follower's hands ends up, before connections.
    const fHand = {};
    // A folded arm (hammerlock) goes behind the back to the opposite side: her right arm ends at her
    // left hip (small of the back), her left arm at her right hip.
    if (p.arms === 'hammerlock_follower_R') fHand.R = add(add(follower.c, mul(follower.face, -9)), mul(fr, -16));
    if (p.arms === 'hammerlock_follower_L') fHand.L = add(add(follower.c, mul(follower.face, -9)), mul(fr, 16));
    if (p.arms === 'wrap') {
      fHand.R = add(add(follower.c, mul(follower.face, 13)), mul(fr, -9));
      fHand.L = add(add(follower.c, mul(follower.face, 13)), mul(fr, 9));
    }
    // Her hand behind the back of the leader's neck (the arm is bent, see below).
    const neck = p.arms === 'follower_R_behind_leader_neck';
    if (neck) fHand.R = add(leader.c, mul(leader.face, -5));
    if (p.arms === 'wrap_follower_R') fHand.R = add(add(follower.c, mul(follower.face, 13)), mul(fr, -9));
    // Side by side in a cuddle, the leader's hand on her far side gets there with his arm round her
    // back, the elbow out past her far shoulder.
    // `opts.style` (from styleOf) fixes this from the finished position, so an animation keeps the same route.
    const { beside, farSide } = opts.style || styleOf(p, leader, follower);
    const overShoulder = p.arms === 'wrap' && beside
      ? add(add(follower.shoulder[farSide], mul(fr, farSide === 'R' ? 2 : -2)), mul(follower.face, -7)) : null;
    // The leader's own hand behind his back.
    const lHand = {};
    // His left arm ends at his right hip, behind his back.
    const lr = right(leader.face);
    if (p.arms === 'hammerlock_leader_L') lHand.L = add(add(leader.c, mul(leader.face, -9)), mul(lr, 16));

    // A hand reaching the far side of the follower's body goes around her side, not through her.
    const sideSign = (from, lh) => sides[lh] || (dist(from, add(follower.c, fr)) < dist(from, sub(follower.c, fr)) ? 1 : -1);
    const side = (from, lh, r = 18) => add(follower.c, mul(fr, r * sideSign(from, lh)));
    const backOf = (from, lh) => add(add(follower.c, mul(follower.face, -11)), mul(sub(side(from, lh), follower.c), 0.35));
    const around = (from, to, lh) => (dist(from, to) > dist(from, follower.c) + 4 ? side(from, lh) : null);
    // To a folded hand behind her back. On his own side of her it goes round her side, a little behind
    // it. On the far side (her left arm folded to her right hip, held by his right hand) the arm crosses
    // diagonally in front of her body and then round her side to the hand.
    const aroundBack = (from, lh, hand) => {
      const handSide = Math.sign(dot(sub(hand, follower.c), fr)) || 1;
      if (handSide === sideSign(from, lh)) return add(side(from, lh, 20), mul(follower.face, -5));
      return add(add(follower.c, mul(follower.face, 11)), mul(fr, handSide * 18));
    };
    // The leader's own hand behind his back, held by her: her arm crosses in front of him if the hand
    // is on the far side from her shoulder, otherwise it goes round his side.
    const aroundLeader = (shoulder, hand) => {
      const handSide = Math.sign(dot(sub(hand, leader.c), lr)) || 1;
      if (handSide === (Math.sign(dot(sub(shoulder, leader.c), lr)) || 1)) return add(add(leader.c, mul(lr, handSide * 22)), mul(leader.face, -5));
      return add(add(leader.c, mul(leader.face, 11)), mul(lr, handSide * 18));
    };
    // Crossed hands: keep the two grips a little apart so both show.
    const twisted = p.crossed && p.crossed !== 'none';
    const top = p.crossed === 'leader_R_over_L' ? 'R' : p.crossed === 'leader_L_over_R' ? 'L' : null;
    const spread = (lh) => (!twisted ? [0, 0] : [0, (lh === (top || 'R') ? -6 : 6)]);

    // Body limits: a hand may only go behind its own back where the position says so (hammerlocks).
    const behindOk = Limits.allowedBehind(p);
    const mayGoBehind = (who, hand) => behindOk.has(who + hand);
    const armOf = (who, hand) => {
      const b = who === 'leader' ? leader : follower;
      return { shoulder: b.shoulder[hand], face: b.face, hand, mayGoBehind: mayGoBehind(who, hand) };
    };

    // How high each hand is: 0 = waist or hip, 1 = shoulder, 2 = over the head (turns, see motion.js).
    const heightOf = (fh) => (neck && fh === 'R' ? 1 : 0);
    // Her arm wrapped across her own front (cuddle, sweetheart, one-hand wrap): it lies on her body.
    const wrapped = (fh) => p.arms === 'wrap' || (p.arms === 'wrap_follower_R' && fh === 'R');

    const arms = [];
    const used = new Set();
    for (const { leader: lh, follower: target } of parseHands(p.hands)) {
      const from = leader.shoulder[lh] || leader.c;
      let grip;
      let via = null;
      if (target === 'L' || target === 'R') {
        grip = fHand[target] || lHand[lh] || add(mid(from, follower.shoulder[target]), spread(lh));
        const folded = behindOk.has('follower' + target);
        if (fHand[target]) via = overShoulder && target === (farSide === 'R' ? 'L' : 'R') ? overShoulder : folded ? aroundBack(from, lh, grip) : around(from, grip, lh);
        let fVia = null;
        if (lHand[lh]) {
          fVia = aroundLeader(follower.shoulder[target], grip);
          ({ via: fVia, to: grip } = Limits.shortenAround(follower.shoulder[target], fVia, grip));
        }
        // Joined hands: a hand going round the partner's body is pulled in to arm length; any other
        // grip is moved to where both arms reach without a hand going behind its own back.
        if (via) ({ via, to: grip } = Limits.shortenAround(from, via, grip));
        else if (!fVia) grip = Limits.fitGrip(armOf('leader', lh), armOf('follower', target), grip);
        arms.push({ who: 'follower', hand: target, from: follower.shoulder[target], via: fVia, to: grip, heldBy: lh, h: heightOf(target), acrossFront: wrapped(target) || undefined });
        used.add(target);
      } else if (target === 'back') {
        grip = backOf(from, lh);
        via = around(from, grip, lh);
        if (via) ({ via, to: grip } = Limits.shortenAround(from, via, grip));
      } else if (target === 'waist') {
        grip = side(from, lh, 15);
      } else if (target === 'shoulder') {
        grip = follower.shoulder[lh === 'L' ? 'R' : 'L'];
      } else {
        grip = follower.c;
      }
      const h = target === 'L' || target === 'R' ? heightOf(target) : CONTACT_HEIGHT[target] ?? 0;
      arms.push({ who: 'leader', hand: lh, from, via, viaH: via && via === overShoulder ? 1 : undefined, to: grip, grip: target === 'L' || target === 'R' ? grip : null, side: sideSign(from, lh), holds: target, h });
    }
    // Follower hands placed by `arms` but not held by the leader (e.g. behind his neck): the arm bends
    // at the elbow, which goes out to her side and up.
    for (const hnd of ['L', 'R']) {
      if (fHand[hnd] && !used.has(hnd)) {
        const from = follower.shoulder[hnd];
        const out = mul(fr, hnd === 'R' ? 1 : -1);
        const via = neck && hnd === 'R' ? Limits.elbow(from, fHand[hnd], out) : null;
        arms.push({ who: 'follower', hand: hnd, from, via, viaH: via ? 1 : undefined, to: fHand[hnd], h: heightOf(hnd) });
      }
    }

    // Crossed hands: draw the top hand last so it sits over the other.
    if (top) {
      arms.sort((a, b) => (a.who === 'leader' && a.hand === top) - (b.who === 'leader' && b.hand === top));
    }
    return { arms, top };
  }

  function dancer(b, cls, labelText, labelBelow) {
    const ly = labelBelow ? b.c[1] + 28 : b.c[1] - 24;
    return `<g class="sk-${cls}">
  <ellipse cx="${r1(b.c[0])}" cy="${r1(b.c[1])}" rx="${SHOULDER + 4}" ry="9" transform="rotate(${r1(b.angle)} ${pt(b.c)})" class="sk-body"/>
  <circle cx="${r1(b.c[0])}" cy="${r1(b.c[1])}" r="8" class="sk-head"/>
  <path d="M${pt(add(b.c, mul(b.face, 17)))} L${pt(add(add(b.c, mul(b.face, 7)), mul(right(b.face), 5)))} L${pt(add(add(b.c, mul(b.face, 7)), mul(right(b.face), -5)))} Z" class="sk-nose"/>
  <text x="${r1(b.c[0])}" y="${r1(ly)}" text-anchor="middle" class="sk-label">${labelText}</text>
</g>`;
  }

  /**
   * Picture area: fixed scale, cropped to the content. Close positions get a shorter picture, not
   * bigger dancers, so distances stay comparable between sketches.
   */
  function boundsOf(L) {
    const ys = [L.follower.c[1] - 34, L.leader.c[1] - 70, ...L.arms.map((a) => a.to[1] - 8)];
    const xs = [L.follower.c[0], L.leader.c[0], ...L.arms.map((a) => a.to[0])];
    return {
      top: Math.max(0, Math.min(...ys)),
      bottom: Math.max(L.leader.c[1] + 36, L.follower.c[1] + 36),
      // Usually 15..165; wider only when someone stands further out to the side.
      left: Math.min(15, Math.min(...xs) - 30),
      right: Math.max(W - 15, Math.max(...xs) + 30),
    };
  }

  /** The dot for a hand: bigger the higher it is, with a ring when it is over the head. */
  function handDot(p, h = 0, touch = false) {
    const r = 2.6 + 1.3 * Math.max(0, Math.min(2, h));
    return `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r1(r)}" class="sk-grip${touch ? ' sk-touch' : ''}"/>` +
      (h >= 1.75 ? `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r1(r + 2.6)}" class="sk-high"/>` : '');
  }

  /** The key to the dots (an SVG strip to put under a sketch). */
  function heightKey() {
    const items = [[0, 'waist'], [1, 'shoulder'], [2, 'over the head']];
    let x = 6;
    const parts = items.map(([h, label]) => {
      const pad = h >= 1.75 ? 9 : 5;
      const out = handDot([x + pad, 9], h) + `<text x="${x + pad * 2 + 4}" y="12.5" class="sk-key">${label}</text>`;
      x += pad * 2 + 12 + label.length * 5.2;
      return out;
    });
    return `<svg viewBox="0 0 ${Math.round(x)} 18" class="sk-legend" role="img" aria-label="Dot size shows how high the hand is: waist, shoulder, over the head" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
  }

  function sketchSVG(p, opts = {}) {
    return drawSVG(layout(p), opts);
  }

  /** Draw a layout. `opts.bounds` fixes the picture area (an animation keeps one frame for the whole move). */
  function drawSVG(L, opts = {}) {
    // A view cone for each dancer, pointing where they face.
    const cone = (b) => {
      const tip = add(b.c, mul(b.face, 128));
      return `M${pt(b.c)} L${pt(add(tip, mul(right(b.face), -80)))} A150 150 0 0 1 ${pt(add(tip, mul(right(b.face), 80)))} Z`;
    };
    const arms = L.arms.map((a) => {
      const isTop = L.top && a.who === 'leader' && a.hand === L.top;
      const points = [a.from, a.via, a.to].filter(Boolean).map(pt).join(' ');
      // A dot where the hand is: a grip on the leader's arm, a hand on the body, or her free hand on him.
      const dot = a.grip || (a.who === 'leader' ? a.to : a.heldBy ? null : a.to);
      // A light casing under each arm keeps it visible where it crosses a body of the same colour,
      // and shows which arm is on top where two cross (like lines on a metro map).
      const cls = isTop ? ' sk-top' : '';
      return `<polyline points="${points}" class="sk-arm-case${cls}"/><polyline points="${points}" class="sk-arm sk-arm-${a.who}${cls}"/>` +
        (dot ? handDot(dot, a.h, !a.grip) : '');
    }).join('\n  ');
    const title = opts.title ? `<title>${esc(opts.title)}</title>` : '';
    const behind = L.follower.c[1] > L.leader.c[1] + 5; // follower behind the leader
    const { top, bottom, left, right: rightEdge } = opts.bounds || boundsOf(L);
    const x0 = left ?? 15;
    const vw = (rightEdge ?? W - 15) - x0;
    return `<svg viewBox="${x0} ${r1(top)} ${vw} ${r1(bottom - top)}" class="sketch" ${title ? 'role="img"' : 'aria-hidden="true"'} xmlns="http://www.w3.org/2000/svg">${title}
  <path d="${cone(L.follower)}" class="sk-fov sk-fov-partner"/>
  <path d="${cone(L.leader)}" class="sk-fov"/>
  ${dancer(L.follower, 'follower', 'partner', behind)}
  ${dancer(L.leader, 'leader', 'you', !behind)}
  ${arms}
</svg>`;
  }

  /** One-line plain description to go with the sketch. */
  function describe(p) {
    const L = layout(p);
    const parts = [`Follower ${L.label}`];
    if (p.frame === 'closed') parts.push('close');
    else if (p.frame === 'apart') parts.push('no connection');
    if (L.top) parts.push(`your ${L.top === 'R' ? 'right' : 'left'} hand on top`);
    if (p.arms === 'hammerlock_follower_R') parts.push("the follower's right arm behind the back");
    if (p.arms === 'hammerlock_follower_L') parts.push("the follower's left arm behind the back");
    if (p.arms === 'wrap') parts.push(L.follower && Math.abs(L.follower.c[0] - L.leader.c[0]) > 30
      ? "the follower's arms wrapped in front, your right arm round the follower's back to the far hip" : "the follower's arms wrapped in front");
    if (p.arms === 'follower_R_behind_leader_neck') parts.push("the follower's right hand behind your neck");
    if (p.arms === 'wrap_follower_R') parts.push("the follower's right arm wrapped across the waist");
    if (p.arms === 'hammerlock_leader_L') parts.push('your left arm behind your back');
    return parts.join(', ') + '.';
  }

  return { sketchSVG, describe, layout, placeBodies, styleOf, armsFor, body, boundsOf, drawSVG, heightKey, CONTACT_HEIGHT };
});
