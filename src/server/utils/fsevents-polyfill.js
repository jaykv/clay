/**
 * Simple polyfill for fsevents
 * This is used when fsevents is not available (e.g., on non-macOS platforms)
 */
module.exports = function() {
  // Return a no-op implementation
  return {
    start: function() {},
    stop: function() {},
    on: function() {}
  };
};
