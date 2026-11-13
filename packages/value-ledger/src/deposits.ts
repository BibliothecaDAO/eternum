import { hash, shortString, type Call, type RpcProvider } from "starknet";
import { readConfirmedLedgerHead, readFinalLedgerHead } from "./codecs";
import type { CosigningDomain } from "./cosigning";

export const LORDS_UNIT = 10n ** 18n;
export interface LordsDeposit {
  shard: string;
  id: string;
  gameId: number;
  games: string;
  account: string;
  realmsId: string;
  home: string;
  payer: string;
  amount: string;
  paidAt: string;
  status: "pending" | "delivered" | "cancelled";
}
export type DepositSigningRequest =
  | { kind: "deposit"; shard: string; season: number; id: string; cancel: boolean }
  | { kind: "resolve-deposit"; shard: string; season: number; id: string }
  | { kind: "principal"; shard: string; season: number; account: string; wallet: string; amount: string };

export function depositUint(value: string, bits: number): bigint {
  if (!/^(0x[0-9a-f]+|[0-9]+)$/i.test(value)) throw new Error("invalid_deposit_integer");
  const number = BigInt(value);
  if (number < 0n || number >= 2n ** BigInt(bits)) throw new Error("deposit_integer_out_of_range");
  return number;
}
export function wholeLords(value: string): bigint {
  if (!/^[1-9][0-9]*$/.test(value)) throw new Error("Enter a positive whole number of LORDS.");
  return depositUint(value, 128);
}
const felt = (value: string) => {
  const number = depositUint(value, 252);
  if (number >= 2n ** 251n + 17n * 2n ** 192n + 1n) throw new Error("invalid_deposit_felt");
  return `0x${number.toString(16)}`;
};
const address = (value: string) => `0x${depositUint(value, 251).toString(16)}`;
const poseidon = (tag: string, fields: (string | number)[]) =>
  hash.computePoseidonHashOnElements([shortString.encodeShortString(tag), ...fields]);

export function decodeLordsDeposit(shard: string, id: string, fields: readonly string[]): LordsDeposit {
  if (fields.length !== 9) throw new Error("invalid_deposit_receipt");
  const status = ["pending", "delivered", "cancelled"] as const;
  const result = {
    shard: felt(shard),
    id: depositUint(id, 64).toString(),
    gameId: Number(depositUint(fields[0]!, 32)),
    games: address(fields[1]!),
    account: address(fields[2]!),
    realmsId: felt(fields[3]!),
    home: depositUint(fields[4]!, 64).toString(),
    payer: address(fields[5]!),
    amount: depositUint(fields[6]!, 128).toString(),
    paidAt: depositUint(fields[7]!, 64).toString(),
    status: status[Number(depositUint(fields[8]!, 8))],
  };
  if (
    !result.status ||
    !result.gameId ||
    BigInt(result.id) === 0n ||
    BigInt(result.amount) === 0n ||
    BigInt(result.games) === 0n ||
    BigInt(result.account) === 0n ||
    BigInt(result.realmsId) === 0n ||
    BigInt(result.home) === 0n ||
    BigInt(result.payer) === 0n
  )
    throw new Error("invalid_deposit_receipt");
  return result as LordsDeposit;
}

export function depositCommitment(domain: Pick<CosigningDomain, "chainId" | "ledger">, value: LordsDeposit): string {
  return poseidon("LORDS_DEPOSIT_V1", [
    domain.chainId,
    domain.ledger,
    value.shard,
    value.games,
    value.gameId,
    value.id,
    value.account,
    value.realmsId,
    value.home,
    value.payer,
    value.amount,
    value.paidAt,
  ]);
}
export const deliveryHash = (commitment: string, epoch: number, cancel: boolean) =>
  poseidon("LORDS_DELIVER_V1", [commitment, epoch, cancel ? 1 : 0]);
export const resolutionHash = (domain: CosigningDomain, commitment: string, cancelled: boolean) =>
  poseidon("LORDS_RESOLVE_V1", [domain.chainId, domain.ledger, domain.epoch, commitment, cancelled ? 1 : 0]);
export const principalHash = (
  domain: CosigningDomain,
  games: string,
  request: Extract<DepositSigningRequest, { kind: "principal" }>,
) =>
  poseidon("LORDS_PRINCIPAL_V1", [
    domain.chainId,
    domain.ledger,
    domain.epoch,
    request.shard,
    games,
    request.season,
    request.account,
    request.wallet,
    request.amount,
  ]);

export function decodeDepositSigningRequest(input: Record<string, unknown>): DepositSigningRequest {
  const string = (key: string) => {
    if (typeof input[key] !== "string") throw new Error("invalid_deposit_request");
    return input[key];
  };
  const shard = felt(string("shard"));
  if (
    typeof input.season !== "number" ||
    !Number.isSafeInteger(input.season) ||
    input.season < 1 ||
    input.season >= 2 ** 32
  )
    throw new Error("invalid_deposit_season");
  const season = input.season;
  if (input.kind === "deposit" && Object.keys(input).length === 5 && typeof input.cancel === "boolean")
    return { kind: "deposit", shard, season, id: depositUint(string("id"), 64).toString(), cancel: input.cancel };
  if (input.kind === "resolve-deposit" && Object.keys(input).length === 4)
    return { kind: "resolve-deposit", shard, season, id: depositUint(string("id"), 64).toString() };
  if (input.kind === "principal" && Object.keys(input).length === 6)
    return {
      kind: "principal",
      shard,
      season,
      account: address(string("account")),
      wallet: address(string("wallet")),
      amount: wholeLords(string("amount")).toString(),
    };
  throw new Error("invalid_deposit_request");
}

export interface DepositAnchor {
  number: number;
  hash: string;
}
export interface DepositAnchors {
  getAnchor(key: string): Promise<DepositAnchor | undefined>;
  putAnchor(key: string, anchor: DepositAnchor): Promise<void>;
}
export class DepositAnchorError extends Error {}

/** Pin evidence to a confirmed hash and refuse any rewrite of an already used head. */
export async function confirmedDepositBlock(
  provider: RpcProvider,
  previous?: DepositAnchor,
  number: number | "latest" = "latest",
) {
  const head = await readConfirmedLedgerHead(provider, number);
  if (previous) {
    if (head.number < previous.number) throw new DepositAnchorError("deposit_head_regressed");
    await assertDepositAnchor(provider, previous);
  }
  const assertCanonical = () => assertDepositAnchor(provider, head);
  await assertCanonical();
  return { head, assertCanonical };
}
async function assertDepositAnchor(provider: RpcProvider, anchor: DepositAnchor) {
  const canonical = await readConfirmedLedgerHead(provider, anchor.number);
  if (BigInt(canonical.hash) !== BigInt(anchor.hash)) throw new DepositAnchorError("deposit_head_rewritten");
}

/**
 * A stored anchor that no longer stands is only a fault if Ethereum had accepted its block. A head that was never
 * accepted can be replaced by the chain: its anchor is dropped, and the next reads (a payment, a deposit) start from
 * the canonical chain, which shows whether what the old head held survived.
 */
async function standingAnchor(provider: RpcProvider, previous: DepositAnchor): Promise<DepositAnchor | undefined> {
  const head = await readConfirmedLedgerHead(provider);
  const lost =
    head.number < previous.number
      ? new DepositAnchorError("deposit_head_regressed")
      : BigInt((await readConfirmedLedgerHead(provider, previous.number)).hash) !== BigInt(previous.hash)
        ? new DepositAnchorError("deposit_head_rewritten")
        : null;
  if (!lost) return previous;
  const final = await readFinalLedgerHead(provider).catch(() => null);
  if (!final || previous.number <= final.number) throw lost;
  return undefined;
}

export async function depositReader(provider: RpcProvider, ledger: string, chainId: string, previous?: DepositAnchor) {
  if (BigInt(await provider.getChainId()) !== BigInt(chainId)) throw new Error("deposit_chain_differs");
  const block = await confirmedDepositBlock(provider, previous && (await standingAnchor(provider, previous)));
  const read = (entrypoint: string, calldata: string[]) =>
    provider.callContract({ contractAddress: ledger, entrypoint, calldata }, block.head.hash);
  return {
    ...block,
    read,
    deposit: async (shard: string, id: string) => decodeLordsDeposit(shard, id, await read("get_deposit", [shard, id])),
    count: async (shard: string) => depositUint((await read("deposit_count", [shard]))[0]!, 64),
    principal: async (shard: string, game: number, account: string) =>
      decodePrincipalPayment(await read("principal_payment", [shard, String(game), account])),
    /** The same views as of the newest Ethereum-accepted block: the only place a fact is final enough to keep. */
    final: async () => {
      const finalHead = await readFinalLedgerHead(provider);
      const readFinal = (entrypoint: string, calldata: string[]) =>
        provider.callContract({ contractAddress: ledger, entrypoint, calldata }, finalHead.number);
      return {
        block: { number: finalHead.number, hash: finalHead.hash },
        deposit: async (shard: string, id: string) =>
          decodeLordsDeposit(shard, id, await readFinal("get_deposit", [shard, id])),
        principal: async (shard: string, game: number, account: string) =>
          decodePrincipalPayment(await readFinal("principal_payment", [shard, String(game), account])),
      };
    },
  };
}

export function decodePrincipalPayment(fields: readonly string[]): { wallet: string; amount: string } | null {
  if (fields.length === 1 && BigInt(fields[0]!) === 1n) return null;
  if (fields.length !== 3 || BigInt(fields[0]!) !== 0n || BigInt(fields[1]!) === 0n || BigInt(fields[2]!) === 0n)
    throw new Error("invalid_principal_payment");
  return { wallet: address(fields[1]!), amount: depositUint(fields[2]!, 128).toString() };
}

export function depositCalls(
  ledger: string,
  token: string,
  target: Pick<LordsDeposit, "shard" | "gameId" | "account" | "realmsId" | "home">,
  amount: string,
  request: string,
): Call[] {
  const wei = wholeLords(amount) * LORDS_UNIT;
  felt(request);
  return [
    {
      contractAddress: token,
      entrypoint: "approve",
      calldata: [ledger, String(wei & (2n ** 128n - 1n)), String(wei >> 128n)],
    },
    {
      contractAddress: ledger,
      entrypoint: "deposit_lords",
      calldata: [target.shard, String(target.gameId), target.account, target.realmsId, target.home, amount, request],
    },
  ];
}
