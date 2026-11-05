// Moves whose animation still breaks a body limit, to fix when we rework the moves between positions.
// The tests check that nothing else breaks one, and that each move here still does (so the list
// shrinks as moves get fixed).
export const KNOWN_UNREALISTIC = {
  'sweetheart-release-to-shadow': "his left arm cuts through her (shadow waist: her right arm across her stomach, his left round her left side)",
  'hammerlock-entry': "his arm passes through her for a moment when the folded-arm hold takes over",
  'hammerlock-exit': "his arm passes through her for a moment when the folded-arm hold takes over",
  'crossed-hammerlock-entry': "his arm passes through her for a moment when the folded-arm hold takes over",
  'hammerlock-unwind-to-cross': "his arm passes through her for a moment when the folded-arm hold takes over",
  'crossed-hammerlock-left-entry': "his arm passes through her for a moment when the folded-arm hold takes over",
  'hammerlock-left-unwind-to-cross': "his arm passes through her for a moment when the folded-arm hold takes over",
  'hammerlock-left-entry-from-ll': "his arm passes through her for a moment when the folded-arm hold takes over",
  'hammerlock-left-exit-to-ll': "his arm passes through her for a moment when the folded-arm hold takes over",
  'hammerlock-right-entry-double': "his arm passes through her for a moment when the folded-arm hold takes over",
  'hammerlock-right-entry-from-lr': "his arm passes through her for a moment when the folded-arm hold takes over",
  'hammerlock-right-unwind-double': "his arm passes through her for a moment when the folded-arm hold takes over",
  'hammerlock-left-entry': "his arm passes through her for a moment when the folded-arm hold takes over",
  'hammerlock-left-entry-from-rl': "his arm passes through her for a moment when the folded-arm hold takes over",
  'hammerlock-left-unwind': "his arm passes through her for a moment when the folded-arm hold takes over",
  'leader-hammerlock-dive-exit': "her arm cuts through the leader's body while he turns out",
  'cuddle-slide-to-shadow': "his left arm cuts through her (shadow waist: her right arm across her stomach, his left round her left side)",
  'shadow-wrap-into-cuddle': "his left arm cuts through her (shadow waist: her right arm across her stomach, his left round her left side)",
  'cuddle-throw-to-shadow': "his left arm cuts through her (shadow waist: her right arm across her stomach, his left round her left side)",
};
// Hands that jump between frames (a route round a body switching sides).
export const KNOWN_JUMPS = {
  'sweetheart-release-to-shadow': 'shadow-waist hold to be settled',
  // His right hand takes hold of her back while she is still turning, and finds its way round her
  // a little differently in the next frame.
  'cuddle-unwrap-to-closed': 'hand on her back re-routes once mid-turn',
  'wrap-exit-to-closed': 'hand on her back re-routes once mid-turn',
};
