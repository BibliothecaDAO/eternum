import { Data, Effect } from "effect";
import type { LedgerPayDecision, PayoutWallet } from "@realms-world/identity";

export class RelayFailure extends Data.TaggedError("RelayFailure")<{ operation: string }> {}
export type RelayEffect<A> = Effect.Effect<A, RelayFailure>;
export interface Withdrawal {
  blockNumber?: number;
  chainId: string;
  seasonId: number;
  transactionHash: string;
  realmsId: string;
  amount: string;
  confirmedAt: number;
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
  finish(tokenId: string): RelayEffect<void>;
}
export interface BlitzResult extends BlitzCommitment {
  blockNumber?: number;
  rows: readonly BlitzResultRow[];
}
export interface ConfirmedBlock {
  anchors?: readonly { number: number; hash: string }[];
  chainId: string;
  number: number;
  hash: string;
  parentHash: string;
  status: "ACCEPTED_ON_L2" | "ACCEPTED_ON_L1";
  withdrawals: readonly Withdrawal[];
  results: readonly BlitzResult[];
  held?: readonly HeldObligation[];
  fromBlock?: number;
  next?: string | null;
}
export type HeldObligation =
  | { kind: "result"; reason: string; result: BlitzResult }
  | {
      kind: "row";
      reason: string;
      row: {
        chainId: string;
        model: string;
        keys: readonly string[];
        values: readonly string[];
        transactionHash: string;
        blockNumber: number;
      };
    }
  | {
      kind: "receipt";
      reason: string;
      receipt: {
        blockNumber?: number;
        chainId: string;
        transactionHash: string;
        keys: readonly string[];
        values: readonly string[];
        confirmedAt: number;
      };
    }
  | { kind: "payment"; reason: string; withdrawal: Withdrawal };
export interface PaidClaim extends Omit<Withdrawal, "realmsId" | "confirmedAt"> {
  wallet: string;
  paidAt: number;
  paymentTransactionHash: string;
}
export interface LaborGrant {
  gameId: number;
  account: string;
  home: string;
  amount: string;
}
export interface LaborClaim {
  gameId: number;
  home: string;
  chainId: string;
  realmId: string;
  day: number;
  realmsId: string;
  account: string;
}
export interface LedgerPage<A> extends Page<A> {
  head: number;
}
export interface Page<A> {
  rows: readonly A[];
  next: string | null;
}

/** Domain ports; receipt decoding and contract calls belong to the published contract adapters. */
export interface ClaimOutcome {
  claimId: string;
  error: string | null;
}
export interface PayableClaim {
  withdrawal: Withdrawal;
  wallet: string;
}
export interface RelayPorts {
  shard: {
    confirmedHead(): RelayEffect<number>;
    blockHash(number: number): RelayEffect<string>;
    eventsPage(from: number, to: number, cursor: string | null): RelayEffect<ConfirmedBlock>;
    withdrawal(chainId: string, transactionHash: string): RelayEffect<Withdrawal | null>;
    grantLabor(claim: LaborClaim): RelayEffect<LaborGrant>;
  };
  identity: {
    payoutWallet(realmsId: string): RelayEffect<PayoutWallet>;
    accountForRealmsId(realmsId: string): RelayEffect<string | null>;
    linkedWallet(realmsId: string): RelayEffect<string | null>;
  };
  ledger: {
    payment(
      withdrawal: Withdrawal,
    ): RelayEffect<{ paid: boolean; seasonId: number; wallet: string; amount: string } | null>;
    voided(withdrawal: Withdrawal): RelayEffect<boolean>;
    reportMany(withdrawals: readonly Withdrawal[]): RelayEffect<ClaimOutcome[]>;
    payMany(rows: readonly PayableClaim[]): RelayEffect<ClaimOutcome[]>;
    postResult(result: BlitzResult): RelayEffect<void>;
  };
  realms: { ownerOf(realmId: string): RelayEffect<string> };
}
export interface MonitorPorts {
  identity: {
    matchesPayDecision(decision: LedgerPayDecision): RelayEffect<boolean>;
  };
  shard: Pick<RelayPorts["shard"], "withdrawal"> & {
    result(chainId: string, gameId: number): RelayEffect<BlitzResult | null>;
    conservation(): RelayEffect<readonly ConservationBalance[]>;
  };
  ledger: {
    paidClaims(after: string | null, fromBlock?: number): RelayEffect<LedgerPage<PaidClaim>>;
    postedResults(after: string | null, fromBlock?: number): RelayEffect<LedgerPage<BlitzCommitment>>;
    pause(): RelayEffect<void>;
  };
}

export interface ConservationBalance {
  chainId?: string;
  gameId: number;
  confirmedBlock: number;
  receipts: string;
  netIssued: string;
}

export const relayOperation = <A>(operation: string, run: () => Promise<A>): RelayEffect<A> =>
  Effect.tryPromise({
    try: run,
    catch: (error) => (error instanceof RelayFailure ? error : new RelayFailure({ operation })),
  });
