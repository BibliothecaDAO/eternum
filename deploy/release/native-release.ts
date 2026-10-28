/**
 * The world release this commit ships. Bump it for every published change to the logic table or migration: the box
 * half registers it on the running shard, and the Cloudflare half advances the running Frontier games to it before the
 * client that expects it goes live.
 */
export const NATIVE_RELEASE_ID = 5;
