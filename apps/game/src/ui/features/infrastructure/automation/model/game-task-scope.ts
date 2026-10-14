import type { GameClient } from "@bibliothecadao/eternum";

type GameTaskClient = Pick<GameClient, "gameId"> & {
  shard: Pick<GameClient["shard"], "chainId" | "worldAddress">;
};

export const gameTaskScope = (client: GameTaskClient): string =>
  `${BigInt(client.shard.chainId)}:${BigInt(client.shard.worldAddress)}:${client.gameId}`;
