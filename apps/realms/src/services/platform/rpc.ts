import { Context, Duration, Effect, Layer, Schedule, Schema } from "effect";
import type { Abi } from "starknet";
import { Contract, RpcProvider } from "starknet";

import { env } from "@/env";
import { decodeBoundary } from "./decode";
import type { BoundaryDecodeError } from "./errors";
import { RpcError } from "./errors";

const READ_TIMEOUT = Duration.seconds(12);
const readRetrySchedule = Schedule.max([Schedule.exponential("300 millis"), Schedule.recurs(2)]);

const makeRpc = () => {
  const provider = new RpcProvider({ nodeUrl: env.VITE_PUBLIC_IDENTITY_RPC_URL, batch: 0 });
  const contracts = new Map<string, Contract>();

  const contractAt = (address: string, abi: Abi): Contract => {
    const cached = contracts.get(address);
    if (cached) return cached;
    const contract = new Contract({ abi, address, providerOrAccount: provider });
    contracts.set(address, contract);
    return contract;
  };

  const call = (address: string, abi: Abi, method: string, args: unknown[]): Effect.Effect<unknown, RpcError> =>
    Effect.tryPromise({
      try: () => contractAt(address, abi).call(method, args as never[]),
      catch: (cause) => new RpcError({ call: method, cause }),
    }).pipe(
      Effect.timeoutOrElse({
        duration: READ_TIMEOUT,
        orElse: () => Effect.fail(new RpcError({ call: method, cause: "timeout" })),
      }),
      Effect.retry(readRetrySchedule),
    );

  const read = <A>(input: {
    address: string;
    abi: Abi;
    method: string;
    args: unknown[];
    schema: Schema.ConstraintDecoder<A, never>;
  }): Effect.Effect<A, RpcError | BoundaryDecodeError> =>
    call(input.address, input.abi, input.method, input.args).pipe(
      Effect.flatMap(decodeBoundary(`rpc:${input.method}`, input.schema)),
    );

  return { provider, read };
};

type RpcShape = ReturnType<typeof makeRpc>;

/**
 * The one mainnet JSON-RPC boundary. Reads go through starknet.js contracts on
 * a batching provider — concurrent calls collapse into one HTTP request, which
 * is what "multicall reads" means over plain JSON-RPC. Writes never live here;
 * they go through the Wallet service.
 */
export class Rpc extends Context.Service<Rpc, RpcShape>()("platform/Rpc") {
  static readonly layer = Layer.succeed(Rpc, makeRpc());
}
