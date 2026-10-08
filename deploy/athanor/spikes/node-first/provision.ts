import { RpcError, RpcProvider } from "starknet";
import { now, ms } from "./common";

export class SetupFailure extends Error {}

export async function provisioningWindow(
  count: number,
  startNonce: bigint,
  width: number,
  submit: (index: number, nonce: bigint) => Promise<string>,
  wait: (hash: string) => Promise<void>,
  progress: (completed: number) => void,
) {
  if (!Number.isInteger(width) || width < 1 || width > 32) throw new SetupFailure("Setup window must be 1..32");
  const pending: { result: Promise<SetupFailure | null> }[] = [];
  let completed = 0;
  let failure: SetupFailure | null = null;
  const finishOldest = async () => {
    const flight = pending.shift()!;
    const error = await flight.result;
    if (error) throw error;
    progress(++completed);
  };
  try {
    for (let index = 0; index < count; index++) {
      if (failure) throw failure;
      const nonce = startNonce + BigInt(index);
      let tx: string;
      try {
        tx = await submit(index, nonce);
      } catch {
        throw new SetupFailure(`Setup submission failed at batch ${index}, nonce ${nonce}; no fixture published`);
      }
      const result = wait(tx).then(
        () => null,
        () => {
          failure = new SetupFailure(`Setup batch ${index}, nonce ${nonce} failed or timed out; no fixture published`);
          return failure;
        },
      );
      pending.push({ result });
      if (pending.length >= width) await finishOldest();
    }
    while (pending.length) await finishOldest();
  } catch (error) {
    // Observe every admitted flight, including those behind a rejected nonce; never publish a partial fixture.
    await Promise.all(pending.map((flight) => flight.result));
    throw error;
  }
}

export async function preconfirmedSuccess(provider: RpcProvider, tx: string) {
  const started = now();
  while (ms(now() - started) < 300000) {
    const receipt = await provider.getTransactionReceipt(tx).catch((error: unknown) => {
      if (error instanceof RpcError && error.isType("TXN_HASH_NOT_FOUND")) return null;
      throw error;
    });
    if (receipt) {
      if (!("execution_status" in receipt) || receipt.execution_status !== "SUCCEEDED")
        throw new SetupFailure("Setup transaction reverted");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new SetupFailure("Setup pre-confirmation timed out");
}
