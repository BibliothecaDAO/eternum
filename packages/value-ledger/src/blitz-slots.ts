import type { RpcProvider } from "starknet";
import { decodeLedgerSlot, decodeRegistration, type LedgerSlot } from "./codecs";

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
