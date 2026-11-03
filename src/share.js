/*
 * Share links and text exports. Pure functions, no DOM: runs in Node and the browser.
 *
 *   Link format (a contract, old links must keep working):
 *   #start=<position>&weight=<mirrored|parallel>&moves=a,b,c&custom=<base64url JSON of own moves>
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ComboShare = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Own moves as base64url of their UTF-8 JSON. */
  function encodeMoves(moves) {
    const bytes = new TextEncoder().encode(JSON.stringify(moves));
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  const isString = (v, max) => typeof v === 'string' && v.length <= max;

  /** A move from a link is trusted only if it looks exactly like one made with the add-a-move form. */
  function isValidOwnMove(m) {
    return Boolean(m) && isString(m.id, 80) && m.id.startsWith('my-') && isString(m.name, 60) &&
      ['move', 'styling', 'adjuster'].includes(m.kind) && [1, 2, 3].includes(m.level) &&
      Array.isArray(m.from) && m.from.every((f) => isString(f, 40)) && isString(m.to, 40) &&
      Number.isInteger(m.counts) && m.counts >= 0 && m.counts <= 64 &&
      (m.notes === undefined || isString(m.notes, 200));
  }

  /** Inverse of encodeMoves. Drops anything invalid; returns [] for garbage. */
  function decodeMoves(text) {
    if (!text) return [];
    try {
      const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const list = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!Array.isArray(list)) return [];
      return list.filter(isValidOwnMove).map((m) => ({
        id: m.id, name: m.name, kind: m.kind, level: m.level, from: m.from, to: m.to, counts: m.counts,
        ...(m.notes ? { notes: m.notes } : {}),
      }));
    } catch {
      return [];
    }
  }

  /** "#start=…&moves=…" -> { startPos, startWeight, strip, custom }, or null if it holds no combo. */
  function parseHash(hash) {
    const q = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    if (!q.has('moves') && !q.has('start')) return null;
    return {
      startPos: q.get('start') || undefined,
      startWeight: q.get('weight') || undefined,
      strip: (q.get('moves') || '').split(',').filter(Boolean),
      custom: decodeMoves(q.get('custom')),
    };
  }

  /** The share hash. Own compounds are spelled out into their parts; own moves that are used travel along. */
  function buildHash({ startPos, startWeight, strip, myMoves = [], myCompounds = [] }) {
    const compoundById = Object.fromEntries(myCompounds.map((c) => [c.id, c]));
    const flatten = (id) => (compoundById[id] ? compoundById[id].sequence.flatMap(flatten) : [id]);
    const ids = strip.flatMap(flatten);
    const q = new URLSearchParams({ start: startPos, weight: startWeight });
    q.set('moves', ids.join(','));
    const custom = myMoves.filter((m) => ids.includes(m.id));
    if (custom.length) q.set('custom', encodeMoves(custom));
    return '#' + q.toString().replace(/%2C/g, ',');
  }

  /** YAML for data/moves.yaml. */
  function moveYaml(m) {
    return `- id: ${m.id}\n  name: ${JSON.stringify(m.name)}\n  kind: ${m.kind}\n  level: ${m.level}\n` +
      `  from: [${m.from.join(', ')}]\n  to: ${m.to}\n  counts: ${m.counts}\n` +
      (m.notes ? `  notes: ${JSON.stringify(m.notes)}\n` : '');
  }

  function compoundYaml(c) {
    return `- id: ${c.id}\n  name: ${JSON.stringify(c.name)}\n  kind: compound\n  sequence: [${c.sequence.join(', ')}]\n`;
  }

  /** The combo as a short text message, ending with its link. `result` is MoveGraph.evaluateStrip(...). */
  function comboText(result, startName, endName, url) {
    const parts = result.items.filter((it) => it.move)
      .map((it) => `${it.move.name} (${it.move.counts ? it.move.counts : 'on the fly'})`);
    return `Bachata combo, starting in ${startName}:\n${parts.join(' › ')}\n` +
      `${result.totalCounts} counts, ends in ${endName}.\n${url}`;
  }

  return { encodeMoves, decodeMoves, isValidOwnMove, parseHash, buildHash, moveYaml, compoundYaml, comboText };
});
