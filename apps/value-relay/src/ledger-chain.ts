import { Effect } from "effect";
import { rpcAt } from "@realms-world/value-ledger";
import { RelayFailure, relayOperation } from "./ports";

/** Every ledger signing path uses identity's environment decision, never a second configured chain. */
export const onIdentityChain = <A, E>(
  rpcUrl: string,
  identity: { l2ChainId(): Promise<string> },
  operation: Effect.Effect<A, E>,
) =>
  relayOperation("verify ledger identity chain", async () => {
    const [actual, expected] = await Promise.all([rpcAt(rpcUrl).getChainId(), identity.l2ChainId()]);
    if (BigInt(actual) !== BigInt(expected)) throw new RelayFailure({ operation: "ledger_identity_chain_mismatch" });
  }).pipe(Effect.andThen(operation));
