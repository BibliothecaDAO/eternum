/**
 * The most blocks one relay page covers; every header in it is checked against its parent. It imports nothing, so the
 * deploy commands that read shard pages load it before any workspace package is built.
 */
export const SHARD_PAGE_BLOCKS = 500;
