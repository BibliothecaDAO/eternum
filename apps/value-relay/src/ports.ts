import { Data, Effect } from "effect";
import type { PayoutWallet } from "@realms-world/identity";

export class RelayFailure extends Data.TaggedError("RelayFailure")<{ operation: string }> {}
export type RelayEffect<A> = Effect.Effect<A, RelayFailure>;
export interface Withdrawal {
  chainId: string;
  seasonId: number;
  transactionHash: string;
  realmsId: string;
  amount: string;
}
export interface BlitzCommitment {
  chainId: string;
  gameId: number;
  commitment: string;
}
interface BlitzResultRow {
  wallet: string;
  rank: number;
}
export interface ChestRequest {
  tokenId: string;
  requester: string;
  requestBlock: number;
}
export type ChestChange = { kind: "requested"; request: ChestRequest } | { kind: "finished"; tokenId: string };
export interface ChestPage extends Page<ChestChange> {
  head: number;
}
export interface ChestPorts {
  changes(fromBlock: number, cursor: string | null): RelayEffect<ChestPage>;
  head(): RelayEffect<number>;
  chest(
    tokenId: string,
  ): RelayEffect<{ requested: boolean; finished: boolean; requester: string; requestBlock: number }>;
  blockTime(number: number): RelayEffect<number>;
  finish(tokenId: string): RelayEffect<void>;
}
export interface BlitzResult extends BlitzCommitment {
  rows: readonly BlitzResultRow[];
}
export interface ConfirmedBlock {
  chainId: string;
  number: number;
  hash: string;
  parentHash: string;
  status: "ACCEPTED_ON_L2" | "ACCEPTED_ON_L1";
  withdrawals: readonly Withdrawal[];
  results: readonly BlitzResult[];
}
export interface PaidClaim extends Omit<Withdrawal, "realmsId"> {
  wallet: string;
}
export interface LaborClaim {
  chainId: string;
  realmId: string;
  day: number;
  realmsId: string;
  account: string;
}
export interface Page<A> {
  rows: readonly A[];
  next: string | null;
}

/** Domain ports; receipt decoding and contract calls belong to the published contract adapters. */
export interface RelayPorts {
  shard: {
    confirmedHead(): RelayEffect<number>;
    block(number: number): RelayEffect<ConfirmedBlock>;
    withdrawal(chainId: string, transactionHash: string): RelayEffect<Withdrawal | null>;
    result(chainId: string, gameId: number): RelayEffect<BlitzResult | null>;
    grantLabor(claim: LaborClaim): RelayEffect<void>;
  };
  identity: {
    payoutWallet(realmsId: string): RelayEffect<PayoutWallet>;
    linkedWallet(realmsId: string): RelayEffect<string | null>;
  };
  ledger: {
    pay(withdrawal: Withdrawal, wallet: string): RelayEffect<void>;
    postResult(result: BlitzResult): RelayEffect<void>;
    paidClaims(after: string | null): RelayEffect<Page<PaidClaim>>;
    postedResults(after: string | null): RelayEffect<Page<BlitzCommitment>>;
  };
  realms: { ownerOf(realmId: string): RelayEffect<string> };
}
export interface MonitorPorts {
  shard: Pick<RelayPorts["shard"], "withdrawal" | "result">;
  ledger: Pick<RelayPorts["ledger"], "paidClaims" | "postedResults"> & { pause(): RelayEffect<void> };
}

export const relayOperation = <A>(operation: string, run: () => Promise<A>): RelayEffect<A> =>
  Effect.tryPromise({ try: run, catch: () => new RelayFailure({ operation }) });
