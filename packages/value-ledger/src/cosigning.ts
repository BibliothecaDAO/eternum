import { hash, shortString } from "starknet";
import { ledgerInteger, ledgerU256 } from "./codecs";

export interface CosigningDomain {
  chainId: string;
  ledger: string;
  epoch: number;
}
export interface PayoutTerms {
  kind: "pay";
  shard: string;
  season: number;
  claim: string;
  wallet: string;
  amount: string;
  rank: number;
  count: number;
}
export interface SettlementTerms {
  kind: "settle";
  shard: string;
  season: number;
  chest: string;
  prize: string;
  treasuryAmount: string;
}
export interface RacePostTerms {
  kind: "race-post";
  shard: string;
  season: number;
  total: string;
}
export interface RacePayTerms {
  kind: "race-pay";
  shard: string;
  season: number;
  home: string;
  wallet: string;
  amount: string;
}
export type RaceTerms = RacePostTerms | RacePayTerms;
export type CosignRequest = PayoutTerms | SettlementTerms | RaceTerms;
export interface RaceCosigningDomain {
  chainId: string;
  rewards: string;
  epoch: number;
}
export interface Cosignature {
  r: string;
  s: string;
}

/** Same domain-separated Poseidon message as GameLedger; a rotation invalidates every old signature. */
export function cosigningHash(domain: CosigningDomain, request: PayoutTerms | SettlementTerms): string {
  return hash.computePoseidonHashOnElements([
    shortString.encodeShortString(request.kind === "pay" ? "ETERNUM_PAY_V1" : "ETERNUM_SETTLE_V2"),
    domain.chainId,
    domain.ledger,
    domain.epoch,
    request.shard,
    request.season,
    ...(request.kind === "pay"
      ? [request.claim, request.wallet, ...u256Parts(request.amount), request.rank, request.count]
      : [...u256Parts(request.chest), ...u256Parts(request.prize), ...u256Parts(request.treasuryAmount)]),
  ]);
}
export function raceCosigningHash(domain: RaceCosigningDomain, request: RaceTerms): string {
  return hash.computePoseidonHashOnElements([
    shortString.encodeShortString(request.kind === "race-post" ? "ETERNUM_RACE_POST_V1" : "ETERNUM_RACE_PAY_V1"),
    domain.chainId,
    domain.rewards,
    domain.epoch,
    request.shard,
    request.season,
    ...(request.kind === "race-post"
      ? u256Parts(request.total)
      : [request.home, request.wallet, ...u256Parts(request.amount)]),
  ]);
}
const u256Parts = (value: string) => {
  const amount = BigInt(value);
  if (amount < 0n || amount >= 2n ** 256n) throw new Error("invalid_cosigning_amount");
  return [String(amount & (2n ** 128n - 1n)), String(amount >> 128n)];
};

/** Requests name facts, never the source URLs or a hash chosen by the requesting operator. */
export function decodeCosignRequest(input: unknown): CosignRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("invalid_cosigning_request");
  const row = input as Record<string, unknown>;
  const felt = (name: string) => {
    if (typeof row[name] !== "string" || !/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(row[name]))
      throw new Error("invalid_cosigning_felt");
    const value = BigInt(row[name]);
    if (value <= 0n || value >= 2n ** 251n + 17n * 2n ** 192n + 1n) throw new Error("invalid_cosigning_felt");
    return `0x${value.toString(16)}`;
  };
  const number = (name: string, max: number) => {
    if (typeof row[name] !== "number" || !Number.isSafeInteger(row[name]) || row[name] < 0 || row[name] > max)
      throw new Error("invalid_cosigning_number");
    return row[name];
  };
  const amount = (name: string) => {
    if (typeof row[name] !== "string") throw new Error("invalid_cosigning_amount");
    const [low, high] = u256Parts(row[name]);
    return ledgerU256(low!, high!);
  };
  const home = () => {
    if (typeof row.home !== "string" || !/^[1-9][0-9]*$/.test(row.home) || BigInt(row.home) >= 2n ** 64n)
      throw new Error("invalid_cosigning_home");
    return row.home;
  };
  const paid = (name: string) => {
    const value = amount(name);
    if (BigInt(value) === 0n) throw new Error("invalid_cosigning_payment");
    return value;
  };
  const shard = felt("shard"),
    season = number("season", 2 ** 32 - 1);
  if (!season) throw new Error("invalid_cosigning_season");
  if (row.kind === "pay" && Object.keys(row).length === 8) {
    const rank = number("rank", 100),
      count = number("count", 100),
      value = amount("amount");
    if ((rank === 0) !== (count === 0) || rank > count || BigInt(value) === 0n)
      throw new Error("invalid_cosigning_payment");
    return { kind: "pay", shard, season, claim: felt("claim"), wallet: felt("wallet"), amount: value, rank, count };
  }
  if (row.kind === "settle" && Object.keys(row).length === 6)
    return {
      kind: "settle",
      shard,
      season,
      chest: amount("chest"),
      prize: amount("prize"),
      treasuryAmount: amount("treasuryAmount"),
    };
  if (row.kind === "race-post" && Object.keys(row).length === 4)
    return { kind: "race-post", shard, season, total: amount("total") };
  if (row.kind === "race-pay" && Object.keys(row).length === 6)
    return { kind: "race-pay", shard, season, home: home(), wallet: felt("wallet"), amount: paid("amount") };
  throw new Error("invalid_cosigning_request");
}
export function decodeCosigner(fields: readonly string[]) {
  if (fields.length !== 2 || BigInt(fields[0]!) <= 0n) throw new Error("invalid_cosigner");
  return { publicKey: fields[0]!, epoch: ledgerInteger(fields[1]!) };
}
