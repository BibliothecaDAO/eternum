import { z } from "zod";
import { Context, Effect } from "effect";

import { BoundaryDecodeError, PlayerRegistryUnavailable } from "../effect/errors";

const ACCOUNT_OF_SELECTOR = "0x3a8811430aebb75d552578aa4b5de4d0be0630bc4d3f4d82ea3fd41242de6f9";
const rpcResponseSchema = z.object({ result: z.array(z.string()).optional(), error: z.unknown().optional() });

interface GameplayAccountService {
  readonly resolve: (owner: string) => Effect.Effect<string | null, PlayerRegistryUnavailable | BoundaryDecodeError>;
}

export class GameplayAccounts extends Context.Service<GameplayAccounts, GameplayAccountService>()(
  "chat/GameplayAccounts",
) {}

export const createGameplayAccountService = ({
  rpcUrl,
  playerRegistryAddress,
  fetch: callRpc = globalThis.fetch,
}: {
  rpcUrl: string;
  playerRegistryAddress: string;
  fetch?: (input: string | URL, init?: RequestInit) => Promise<Response>;
}): GameplayAccountService => ({
  resolve: (owner) =>
    Effect.tryPromise({
      try: () =>
        callRpc(rpcUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "starknet_call",
            params: {
              request: {
                contract_address: playerRegistryAddress,
                entry_point_selector: ACCOUNT_OF_SELECTOR,
                calldata: [owner],
              },
              block_id: "pre_confirmed",
            },
          }),
        }),
      catch: (cause) => new PlayerRegistryUnavailable({ cause }),
    }).pipe(
      Effect.filterOrFail(
        (response) => response.ok,
        (response) => new PlayerRegistryUnavailable({ cause: `status ${response.status}` }),
      ),
      Effect.flatMap((response) =>
        Effect.tryPromise({
          try: () => response.json(),
          catch: (cause) => new BoundaryDecodeError({ boundary: "player-registry", cause }),
        }),
      ),
      Effect.flatMap((payload) =>
        Effect.try({
          try: () => rpcResponseSchema.parse(payload),
          catch: (cause) => new BoundaryDecodeError({ boundary: "player-registry", cause }),
        }),
      ),
      Effect.flatMap((result) =>
        result.error || !result.result?.[0]
          ? Effect.fail(new PlayerRegistryUnavailable({ cause: "account_of returned an RPC error" }))
          : Effect.succeed(BigInt(result.result[0])),
      ),
      Effect.map((address) => (address === 0n ? null : `0x${address.toString(16)}`)),
    ),
});
