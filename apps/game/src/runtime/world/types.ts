/** A game the client has entered: its shard, its id, and the directory facts entry needs before the stream opens. */
export interface GameProfile {
  chainId: string;
  gameId: number;
  presetId: number;
  /** The game's registry name from its shard's directory, an id ("frontier-1793451600") no player reads. */
  name: string;
  /** A Frontier season's number ("Season 0"), which its alerts name it by; null for any other game. */
  seasonNumber: number | null;
}
