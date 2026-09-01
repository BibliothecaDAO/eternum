import { Duration, Effect, Schedule, Schema } from "effect";
import type { Abi } from "starknet";
import { Contract, RpcProvider } from "starknet";

import { env } from "@/env";
import { decodeBoundary } from "./decode";
import type { BoundaryDecodeError } from "./errors";
import { RpcError } from "./errors";

const READ_TIMEOUT = Duration.seconds(12);
const readRetrySchedule = Schedule.exponential("300 millis").pipe(Schedule.intersect(Schedule.recurs(2)));

/**
 * The one mainnet JSON-RPC boundary. Reads go through starknet.js contracts on
 * a batching provider — concurrent calls collapse into one HTTP request, which
 * is what "multicall reads" means over plain JSON-RPC. Writes never live here;
 * they go through the Wallet service.
 */
export class Rpc extends Effect.Service<Rpc>()("platform/Rpc", {
  sync: () => {
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
        Effect.timeoutFail({
          duration: READ_TIMEOUT,
          onTimeout: () => new RpcError({ call: method, cause: "timeout" }),
        }),
        Effect.retry(readRetrySchedule),
      );

    const read = <A, I>(input: {
      address: string;
      abi: Abi;
      method: string;
      args: unknown[];
      schema: Schema.Schema<A, I>;
    }): Effect.Effect<A, RpcError | BoundaryDecodeError> =>
      call(input.address, input.abi, input.method, input.args).pipe(
        Effect.flatMap(decodeBoundary(`rpc:${input.method}`, input.schema)),
      );

    return { provider, read };
  },
}) {}
