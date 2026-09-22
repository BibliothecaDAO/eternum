import { createBrowserGameClient } from "./game-client";
import { requireOpenShard } from "@/runtime/world/shards";
import type { WorldConfigMeta } from "@/hooks/use-world-availability";
import { fetchHeraldGameDirectory } from "@bibliothecadao/eternum/game-client";
import type { GameClient } from "@bibliothecadao/eternum";
import type { AccountInterface } from "starknet";

/** Entry has no renderer yet; all facts and execution still go through the shared client. */
export async function submitSettlement<T>(
  meta: WorldConfigMeta,
  signer: AccountInterface,
  submit: (client: GameClient) => Promise<T>,
): Promise<T> {
  if (!meta.gameId) throw new Error("The selected game is not ready for settlement");
  if (!meta.chainId) throw new Error("The selected game has no shard");
  const shard = await requireOpenShard(meta.chainId);
  const directory = await fetchHeraldGameDirectory(shard);
  const listing = directory.games.find((game) => game.game_id === meta.gameId);
  if (!listing) throw new Error("The selected game is absent from its shard's directory");
  const client = await createBrowserGameClient({ shard, gameId: listing.game_id, presetId: listing.preset_id });
  try {
    client.connect(signer);
    const result = await submit(client);
    if (
      typeof result !== "object" ||
      result === null ||
      !("transaction_hash" in result) ||
      typeof result.transaction_hash !== "string"
    )
      throw new Error("Settlement did not return its transaction identity");
    await client.runtime.waitForTransaction(result.transaction_hash);
    return result;
  } finally {
    client.dispose();
  }
}
