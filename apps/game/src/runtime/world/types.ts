/** A game the client has entered: its shard, its id, and the directory facts entry needs before the stream opens. */
export interface GameProfile {
  chainId: string;
  gameId: number;
  presetId: number;
  /** The game's display name from its shard's directory. */
  name: string;
  fetchedAt: number;
}
