import type { ResolvedEntryContext } from "@/game-entry/context";
import { attachGameClient } from "@/init/bootstrap";
import type { GameClient } from "@bibliothecadao/eternum";
import { TransactionNoAnswerError, waitForConfirmedActionReceipt } from "@bibliothecadao/eternum/game-client";

export async function submitGameCommand(
  context: ResolvedEntryContext,
  submit: (client: GameClient) => Promise<unknown>,
  attachment?: Parameters<typeof attachGameClient>[2],
) {
  const client = await attachGameClient(context, undefined, attachment);
  const startedAt = Date.now();
  const result = await submit(client);
  if (
    typeof result !== "object" ||
    result === null ||
    !("transaction_hash" in result) ||
    typeof result.transaction_hash !== "string"
  )
    throw new Error("The command did not return its transaction identity");
  const { transaction_hash: hash } = result;
  const world = client.shard.worldAddress;
  const outcome = await client.waitForAction(hash).catch((error: unknown) => {
    if (!attachment || error instanceof TransactionNoAnswerError) throw error;
    return waitForConfirmedActionReceipt(client.setup.network.provider.provider, world, hash, undefined, startedAt);
  });
  if (outcome.status !== "SUCCEEDED") throw new Error(outcome.revertReason ?? outcome.status);
  return { outcome, world, startedAt };
}
