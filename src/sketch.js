/*
 * Leader-view sketch: a top-down drawing of a position, as the leader would
 * picture it. The leader is always at the bottom, facing up (towards the top
 * of the picture). Everything is derived from the position's attributes, so a
 * sketch that looks wrong points at a position whose data is wrong.
 *
 * sketchSVG(position) -> SVG markup string (no DOM needed).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LeaderSketch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
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
  const SIDE_DISTANCE = { closed: 46, semi: 54, open: 80, apart: 96 };

  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const right = (f) => [-f[1], f[0]]; // screen coords, y grows downwards
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

  /** Layout of both dancers and every arm, in picture coordinates. */
  function layout(p) {
    const o = ORIENTATION[p.orientation] || ORIENTATION.facing;
    const sideways = Math.abs(o.dir[0]) > 0.5;
    const d = (sideways ? SIDE_DISTANCE : DISTANCE)[p.frame] ?? DISTANCE.open;
    const leader = body([LEADER.x, LEADER.y], [0, -1]);
    const follower = body(add([LEADER.x, LEADER.y], mul(o.dir, d)), o.face);
    const fr = right(follower.face);

    // Where each of the follower's hands ends up, before connections.
    const fHand = {};
    if (p.arms === 'hammerlock_follower_R') fHand.R = add(follower.c, mul(follower.face, -13));
    if (p.arms === 'hammerlock_follower_L') fHand.L = add(follower.c, mul(follower.face, -13));
    if (p.arms === 'wrap') {
      fHand.R = add(add(follower.c, mul(follower.face, 13)), mul(fr, -9));
      fHand.L = add(add(follower.c, mul(follower.face, 13)), mul(fr, 9));
    }
    if (p.arms === 'follower_R_behind_leader_neck') fHand.R = add(leader.c, [0, 9]);
    if (p.arms === 'wrap_follower_R') fHand.R = add(add(follower.c, mul(follower.face, 13)), mul(fr, -9));
    // The leader's own hand behind his back.
    const lHand = {};
    if (p.arms === 'hammerlock_leader_L') lHand.L = add(leader.c, mul(leader.face, -13));

    // A hand reaching the far side of the follower's body goes around her side, not through her.
    const side = (from) => {
      const a = add(follower.c, mul(fr, -18)), b = add(follower.c, mul(fr, 18));
      return dist(from, a) < dist(from, b) ? a : b;
    };
    const backOf = (from) => add(add(follower.c, mul(follower.face, -11)), mul(sub(side(from), follower.c), 0.35));
    const around = (from, to) => (dist(from, to) > dist(from, follower.c) + 4 ? side(from) : null);
    // Crossed or braided hands: keep the two grips a little apart so both show.
    const twisted = p.crossed && p.crossed !== 'none';
    const top = p.crossed === 'leader_R_over_L' ? 'R' : p.crossed === 'leader_L_over_R' ? 'L' : null;
    const spread = (lh) => (!twisted ? [0, 0] : [0, (lh === (top || 'R') ? -6 : 6)]);

    const arms = [];
    const used = new Set();
    for (const { leader: lh, follower: target } of parseHands(p.hands)) {
      const from = leader.shoulder[lh] || leader.c;
      let grip;
      let via = null;
      if (target === 'L' || target === 'R') {
        grip = fHand[target] || lHand[lh] || add(mid(from, follower.shoulder[target]), spread(lh));
        if (fHand[target]) via = around(from, grip);
        arms.push({ who: 'follower', hand: target, from: follower.shoulder[target], to: grip });
        used.add(target);
      } else if (target === 'back') {
        grip = backOf(from);
        via = around(from, grip);
      } else if (target === 'waist') {
        const a = add(follower.c, mul(fr, -15));
        const b = add(follower.c, mul(fr, 15));
        grip = dist(from, a) < dist(from, b) ? a : b;
      } else if (target === 'shoulder') {
        grip = follower.shoulder[lh === 'L' ? 'R' : 'L'];
      } else {
        grip = follower.c;
      }
      arms.push({ who: 'leader', hand: lh, from, via, to: grip, grip: target === 'L' || target === 'R' ? grip : null });
    }
    // Follower hands placed by `arms` but not held by the leader (e.g. behind his neck).
    for (const hnd of ['L', 'R']) {
      if (fHand[hnd] && !used.has(hnd)) {
        arms.push({ who: 'follower', hand: hnd, from: follower.shoulder[hnd], to: fHand[hnd] });
      }
    }

    // Crossed hands: draw the top hand last so it sits over the other.
    if (top) {
      arms.sort((a, b) => (a.who === 'leader' && a.hand === top) - (b.who === 'leader' && b.hand === top));
    }
    return { leader, follower, arms, top, label: o.label };
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

  function sketchSVG(p, opts = {}) {
    const L = layout(p);
    const eye = L.leader.c;
    const fov = `M${pt(eye)} L${pt(add(eye, [-80, -128]))} A150 150 0 0 1 ${pt(add(eye, [80, -128]))} Z`;
    const arms = L.arms.map((a) => {
      const isTop = L.top && a.who === 'leader' && a.hand === L.top;
      const points = [a.from, a.via, a.to].filter(Boolean).map(pt).join(' ');
      return `<polyline points="${points}" class="sk-arm sk-arm-${a.who}${isTop ? ' sk-top' : ''}"/>` +
        (a.grip ? `<circle cx="${r1(a.grip[0])}" cy="${r1(a.grip[1])}" r="3.2" class="sk-grip"/>` : '');
    }).join('\n  ');
    const title = opts.title ? `<title>${esc(opts.title)}</title>` : '';
    // Fixed scale, cropped to the content: close positions get a shorter picture,
    // not bigger dancers, so distances stay comparable between sketches.
    const behind = L.follower.c[1] > L.leader.c[1] + 5; // follower behind the leader
    const ys = [L.follower.c[1] - 34, L.leader.c[1] - 70, ...L.arms.map((a) => a.to[1] - 8)];
    const top = Math.max(0, Math.min(...ys));
    const bottom = Math.max(L.leader.c[1] + 36, L.follower.c[1] + 36);
    const x0 = 15;
    const vw = W - 30;
    return `<svg viewBox="${x0} ${r1(top)} ${vw} ${r1(bottom - top)}" class="sketch" role="img" xmlns="http://www.w3.org/2000/svg">${title}
  <path d="${fov}" class="sk-fov"/>
  ${dancer(L.follower, 'follower', 'follower', behind)}
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
    if (p.arms === 'wrap') parts.push("the follower's arms wrapped in front");
    if (p.arms === 'follower_R_behind_leader_neck') parts.push("the follower's right hand behind your neck");
    if (p.arms === 'wrap_follower_R') parts.push("the follower's right arm wrapped across the waist");
    if (p.arms === 'hammerlock_leader_L') parts.push('your left arm behind your back');
    if (p.crossed === 'braid') parts.push('both hands twisted into a braid');
    return parts.join(', ') + '.';
  }

  return { sketchSVG, describe, layout };
});
