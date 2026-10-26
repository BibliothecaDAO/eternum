/** The lab shard's chain: its games' routes are the lab's, so a reload of one plays the lab game again. */
export const LAB_CHAIN_ID = "0x1ab9";

/** The game route on the lab shard, mounted by the app (dev only) ahead of every other game's. */
export const LAB_GAME_ROUTE = `/g/${LAB_CHAIN_ID}/:game/*`;
