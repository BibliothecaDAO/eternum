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
export type CosignRequest = PayoutTerms | SettlementTerms;
export interface Cosignature {
  r: string;
  s: string;
}

/** Same domain-separated Poseidon message as GameLedger; a rotation invalidates every old signature. */
export function cosigningHash(domain: CosigningDomain, request: CosignRequest): string {
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
  throw new Error("invalid_cosigning_request");
}
export function decodeCosigner(fields: readonly string[]) {
  if (fields.length !== 2 || BigInt(fields[0]!) <= 0n) throw new Error("invalid_cosigner");
  return { publicKey: fields[0]!, epoch: ledgerInteger(fields[1]!) };
}
