import { createBrowserGameClient } from "./game-client";
import { requireWorldById } from "@/runtime/world/world-directory";
import type { WorldConfigMeta } from "@/hooks/use-world-availability";
import { fetchHeraldGameDirectory } from "@bibliothecadao/eternum/game-client";
import type { GameClient } from "@bibliothecadao/eternum";
import type { AccountInterface } from "starknet";

/** Entry has no renderer yet; all facts and execution still go through the shared client. */
export async function submitSettlement<T>(
  meta: WorldConfigMeta,
  signer: AccountInterface,
  submit: (client: GameClient, owner: string) => Promise<T>,
): Promise<T> {
  if (!meta.gameId) throw new Error("The selected game is not ready for settlement");
  const world = requireWorldById(meta.worldId);
  const directory = await fetchHeraldGameDirectory(world);
  const listing = directory.games.find((game) => game.game_id === meta.gameId);
  if (!listing) throw new Error("The selected game is absent from the world directory");
  const client = await createBrowserGameClient({ world, gameId: listing.game_id, presetId: listing.preset_id });
  try {
    client.connect(signer);
    const [owner] = await signer.callContract({
      contractAddress: world.playerRegistryAddress,
      entrypoint: "owner_of",
      calldata: [signer.address],
    });
    if (!owner || BigInt(owner) === 0n) throw new Error("Gameplay account is not bound");
    return await submit(client, owner);
  } finally {
    client.dispose();
  }
}
