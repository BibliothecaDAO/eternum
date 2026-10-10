import type { RpcProvider } from "starknet";
export const ledgerInteger = (value: string): number => {
  const n = Number(unsigned(value));
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("invalid_ledger_integer");
  return n;
};
export const ledgerBool = (value: string): boolean => {
  if (![0n, 1n].includes(unsigned(value))) throw new Error("invalid_ledger_bool");
  return unsigned(value) === 1n;
};
export const ledgerU256 = (low: string, high: string): string => {
  const a = unsigned(low),
    b = unsigned(high);
  if (a < 0n || b < 0n || a >= 2n ** 128n || b >= 2n ** 128n) throw new Error("invalid_u256_limb");
  return String(a + (b << 128n));
};
/** WithdrawalPayment: paid, season_id, wallet, amount (low, high); an all-zero row has no report. */
export const decodeWithdrawalPayment = (fields: readonly string[]) => {
  if (fields.length !== 5) throw new Error("invalid_payment_record");
  const paid = ledgerBool(fields[0]!);
  const seasonId = ledgerInteger(fields[1]!);
  const wallet = unsigned(fields[2]!);
  const amount = ledgerU256(fields[3]!, fields[4]!);
  if (amount === "0" && !paid && seasonId === 0 && wallet === 0n) return null;
  if (amount === "0" || (paid && wallet === 0n) || (!paid && wallet !== 0n)) throw new Error("invalid_payment_report");
  return { paid, seasonId, wallet: fields[2]!, amount };
};

/** Chest: exists, season_id, band, requested, finished, requester, request_block. */
export const decodeChest = (fields: readonly string[]) => {
  if (fields.length !== 7 || !ledgerBool(fields[0]!)) throw new Error("invalid_chest");
  return {
    seasonId: ledgerInteger(fields[1]!),
    band: ledgerInteger(fields[2]!),
    requested: ledgerBool(fields[3]!),
    finished: ledgerBool(fields[4]!),
    requester: fields[5]!,
    requestBlock: ledgerInteger(fields[6]!),
  };
};

/** get_season_winner returns the wallet and its allocated u256 share. */
export const decodeSeasonWinner = (fields: readonly string[]) => {
  if (fields.length !== 3 || unsigned(fields[0]!) === 0n) throw new Error("invalid_season_winner");
  return { wallet: fields[0]!, share: BigInt(ledgerU256(fields[1]!, fields[2]!)) };
};

export const decodeBlitzSeason = (fields: readonly string[]) => {
  if (fields.length !== 16 || !ledgerBool(fields[10]!)) throw new Error("invalid_ledger_season");
  return {
    participantCount: ledgerInteger(fields[2]!),
    topCount: ledgerInteger(fields[3]!),
    posted: ledgerBool(fields[4]!),
    challenged: ledgerBool(fields[5]!),
    reviewUntil: ledgerInteger(fields[6]!),
    settlementStarted: ledgerBool(fields[7]!),
    presetId: ledgerInteger(fields[11]!),
    start: ledgerInteger(fields[12]!),
    end: ledgerInteger(fields[13]!),
    pool: ledgerU256(fields[14]!, fields[15]!),
  };
};
/** One confirmed header format for immutable reads; no pending head can become a cache anchor. */
export const readConfirmedLedgerHead = async (provider: RpcProvider, number: number | "latest" = "latest") => {
  const block = await provider.getBlock(number);
  if (
    !("block_number" in block) ||
    !("block_hash" in block) ||
    !("status" in block) ||
    !["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(block.status ?? "") ||
    !Number.isSafeInteger(block.block_number) ||
    block.block_number < 0 ||
    (number !== "latest" && block.block_number !== number) ||
    !Number.isSafeInteger(block.timestamp) ||
    block.timestamp < 0 ||
    typeof block.block_hash !== "string" ||
    !/^0x[0-9a-f]+$/i.test(block.block_hash)
  )
    throw new Error("ledger_head_unconfirmed");
  return { number: block.block_number, hash: block.block_hash, time: block.timestamp };
};

/** Published FrontierSeason backing and clock, shared by discovery and batched payments. */
export const decodeFrontierSeason = (fields: readonly string[]) => {
  if (fields.length !== 10) throw new Error("invalid_frontier_season");
  return {
    configured: ledgerBool(fields[0]!),
    start: ledgerInteger(fields[1]!),
    end: ledgerInteger(fields[2]!),
    pool: ledgerU256(fields[3]!, fields[4]!),
    paid: ledgerU256(fields[5]!, fields[6]!),
    closed: ledgerBool(fields[7]!),
    presetId: ledgerInteger(fields[8]!),
    seed: fields[9]!,
  };
};
export const decodeLedgerPreset = (fields: readonly string[]) => {
  if (fields.length !== 20) throw new Error("invalid_ledger_preset");
  return {
    paidFraction: ledgerInteger(fields[4]!),
    dayUnit: ledgerInteger(fields[17]!),
    bags: ledgerInteger(fields[18]!),
    claimWindow: ledgerInteger(fields[19]!),
  };
};

const unsigned = (value: string) => {
  if (!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(value)) throw new Error("invalid_ledger_felt");
  return BigInt(value);
};
