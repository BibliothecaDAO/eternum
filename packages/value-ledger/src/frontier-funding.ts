import type { RpcProvider } from "starknet";
import { decodeFrontierSeason, decodeLedgerPreset, readConfirmedLedgerHead } from "./codecs";

/** Immutable confirmed GameRegistry, ChestRules and SliceRules facts. */
export interface FrontierFundingTerms {
  start: number;
  end: number;
  seed: string;
  dayUnit: number;
  claimWindow: number;
}

/** Unfunded views revert; unreadable or different custody cannot bind a receipt. */
export async function readFrontierFunding(
  provider: Pick<RpcProvider, "callContract"> & Parameters<typeof readConfirmedLedgerHead>[0],
  ledgerAddress: string,
  key: { chainId: string; gameId: number },
  native: FrontierFundingTerms,
) {
  const head = await readConfirmedLedgerHead(provider);
  const read = (entrypoint: string, calldata: string[]) =>
    provider.callContract({ contractAddress: ledgerAddress, entrypoint, calldata }, head.number);
  const season = decodeFrontierSeason(await read("get_frontier", [key.chainId, String(key.gameId)]));
  const preset = decodeLedgerPreset(await read("get_preset", [String(season.presetId)]));
  assertFrontierPreset(preset, native);
  if (season.start !== native.start || season.end !== native.end || BigInt(season.seed) !== BigInt(native.seed))
    throw new Error("frontier_funding_differs_from_game");
  return { ...season, claimDeadline: season.end + preset.claimWindow, confirmedBlock: head.number };
}

/** Compare the immutable day rules before funding and when checking an existing pool. */
export function assertFrontierPreset(preset: ReturnType<typeof decodeLedgerPreset>, native: FrontierFundingTerms) {
  if (
    ![native.start, native.end, native.dayUnit, native.claimWindow].every(Number.isSafeInteger) ||
    native.start < 0 ||
    native.dayUnit <= 0 ||
    native.claimWindow <= 0 ||
    native.end <= native.start ||
    BigInt(native.seed) <= 0n ||
    preset.dayUnit !== native.dayUnit ||
    preset.claimWindow !== native.claimWindow ||
    BigInt(native.end - native.start) !== 20n * BigInt(native.dayUnit) * BigInt(preset.bags)
  )
    throw new Error("frontier_funding_differs_from_game");
}
