import { shortString } from "starknet";
import { setTimeout as sleep } from "node:timers/promises";
import { HarnessProvider } from "./provider";
import { classifyPlayReceipt, type PlayReceipt, type ActionReceipt } from "./player-actions";
import type { RouteCase } from "./self-check";

/** Refusal coverage requires the exact domain outcome at both boundaries, never just a failed helper promise. */
export async function verifyRouteReceipt(
  step: RouteCase,
  transactionHash: string,
  stopped: AbortSignal,
): Promise<void> {
  const rpc = new HarnessProvider(step.client.shard.rpcUrl);
  try {
    let result: ActionReceipt = { state: "pending" };
    while (result.state === "pending") {
      stopped.throwIfAborted();
      const receipt = await rpc.getTransactionReceipt(transactionHash).catch(() => undefined);
      if (receipt)
        result = classifyPlayReceipt(receipt as PlayReceipt, {
          gameId: step.client.gameId,
          games: step.client.shard.worldAddress,
          actor: step.account.address,
          hash: transactionHash,
        });
      if (result.state === "pending") await sleep(250, undefined, { signal: stopped });
    }
    assertDomainRefusal(result, step.expectedRejection!);
    const transaction = await step.client.runtime.waitForTransaction(transactionHash);
    if (String(transaction.status) !== "REJECTED" || transaction.revertReason !== step.expectedRejection)
      throw new Error("Herald did not record the expected domain refusal");
  } finally {
    rpc.dispose();
  }
}

export function assertDomainRefusal(result: ActionReceipt, reason: string): void {
  if (
    result.state !== "rejected" ||
    result.statusClass === undefined ||
    BigInt(result.statusClass) !== BigInt(shortString.encodeShortString("GAMEPLAY_REJECTED")) ||
    result.reason !== reason
  )
    throw new Error("Receipt differs from the fixture's domain refusal");
}
