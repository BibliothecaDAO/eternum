import type { RpcProvider } from "starknet";
import { decodeFrontierSeason, decodeLedgerPreset, readConfirmedLedgerHead } from "./codecs";

/** Immutable confirmed GameRegistry, ChestRules and SliceRules facts, in native whole LORDS. */
export interface FrontierFundingTerms {
  start: number;
  end: number;
  seed: string;
  pool: string;
  dayUnit: number;
  claimWindow: number;
}

/** Unfunded views revert; unreadable or different custody cannot bind a receipt. */
export async function readFrontierFunding(
  provider: RpcProvider,
  ledgerAddress: string,
  key: { chainId: string; gameId: number },
  native: FrontierFundingTerms,
) {
  const head = await readConfirmedLedgerHead(provider);
  const read = (entrypoint: string, calldata: string[]) =>
    provider.callContract({ contractAddress: ledgerAddress, entrypoint, calldata }, head.number);
  const season = decodeFrontierSeason(await read("get_frontier", [key.chainId, String(key.gameId)]));
  const preset = decodeLedgerPreset(await read("get_preset", [String(season.presetId)]));
  if (
    ![native.start, native.end, native.dayUnit, native.claimWindow].every(Number.isSafeInteger) ||
    native.start < 0 ||
    native.dayUnit <= 0 ||
    native.claimWindow <= 0 ||
    native.end <= native.start ||
    season.start !== native.start ||
    season.end !== native.end ||
    BigInt(season.seed) !== BigInt(native.seed) ||
    BigInt(native.seed) <= 0n ||
    BigInt(native.pool) <= 0n ||
    BigInt(season.pool) !== BigInt(native.pool) * 10n ** 18n ||
    preset.dayUnit !== native.dayUnit ||
    preset.claimWindow !== native.claimWindow ||
    BigInt(native.end - native.start) !== 20n * BigInt(native.dayUnit) * BigInt(preset.bags)
  )
    throw new Error("frontier_funding_differs_from_game");
  return { ...season, claimDeadline: season.end + preset.claimWindow, confirmedBlock: head.number };
}
