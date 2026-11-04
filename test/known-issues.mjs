// Moves whose animation still breaks a body limit, to fix when we rework the moves between positions.
// The tests check that nothing else breaks one, and that each move here still does (so the list
// shrinks as moves get fixed).
export const KNOWN_UNREALISTIC = {
  // Wait for the shadow-waist hold to be settled: today its sketch doesn't match its notes (the
  // follower's right arm across the waist), so the hand has nowhere sensible to travel.
  'cuddle-slide-to-shadow': 'shadow-waist hold to be settled',
  'cuddle-throw-to-shadow': 'shadow-waist hold to be settled',
  'shadow-wrap-into-cuddle': 'shadow-waist hold to be settled',
  // The follower's right hand follows the leader's left round his back while he turns.
  'leader-hammerlock-entry': "her arm cuts through the leader's body mid-turn",
};
// Hands that jump between frames (a route round a body switching sides).
export const KNOWN_JUMPS = {
  'sweetheart-release-to-shadow': 'shadow-waist hold to be settled',
  // His right hand takes hold of her back while she is still turning, and finds its way round her
  // a little differently in the next frame.
  'cuddle-unwrap-to-closed': 'hand on her back re-routes once mid-turn',
  'wrap-exit-to-closed': 'hand on her back re-routes once mid-turn',
};
