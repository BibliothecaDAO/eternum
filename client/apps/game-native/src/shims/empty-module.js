/**
 * Empty module shim for Node.js core modules that aren't available in React Native.
 * Used by Metro resolver to satisfy imports from packages like `ws` that are
 * never actually called at runtime (React Native has native WebSocket).
 */
module.exports = {};
