/**
 * The shard entry: opening a shard by URL and reading its Herald. It is its own package entry so the app shell can
 * list games without evaluating the game-client barrel, whose submission path imports Starknet.
 */
export * from "./shard";
export * from "./herald-http";
