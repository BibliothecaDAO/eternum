import type { ResolvedEntryContext } from "@/game-entry/context";
import { attachGameClient } from "@/init/bootstrap";
import type { GameClient } from "@bibliothecadao/eternum";

/** Settles through the game's one client, which the scene then boots on, so entry keeps a single Herald session. */
export async function submitSettlement<T>(
  context: ResolvedEntryContext,
  submit: (client: GameClient) => Promise<T>,
): Promise<T> {
  const client = await attachGameClient(context);
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
}
