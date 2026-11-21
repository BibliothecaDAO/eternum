import type { RpcProvider } from "starknet";
import { decodeLedgerSlot, decodeRegistration, type LedgerSlot } from "./codecs";

/** The ledger requires strictly more than ten minutes after a game's end to settle its result. */
const BLITZ_SETTLEMENT_MARGIN_SECONDS = 600;

/** Whole-second slot bounds, checked identically for the launch calendar and the confirmed ledger season. */
export const blitzSlotFitsSeason = (close: number, end: number, season: { start: number; end: number }): boolean =>
  close >= season.start && close < end && end + BLITZ_SETTLEMENT_MARGIN_SECONDS < season.end;

export interface LedgerSlotKey {
  chainId: string;
  slotId: number;
}

export async function readLedgerSlot(
  provider: RpcProvider,
  address: string,
  key: LedgerSlotKey,
  head: number | "latest",
): Promise<LedgerSlot> {
  const fields = await provider.callContract(
    { contractAddress: address, entrypoint: "get_slot", calldata: [key.chainId, String(key.slotId)] },
    head,
  );
  return decodeLedgerSlot(fields);
}

/** One wallet's current registration, without enumerating an uncapped slot. */
export async function readLedgerRegistration(
  provider: RpcProvider,
  address: string,
  key: LedgerSlotKey,
  wallet: string,
) {
  return decodeRegistration(
    await provider.callContract(
      { contractAddress: address, entrypoint: "get_registration", calldata: [key.chainId, String(key.slotId), wallet] },
      "latest",
    ),
  );
}
