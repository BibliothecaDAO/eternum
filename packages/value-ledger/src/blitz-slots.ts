import type { RpcProvider } from "starknet";
import {
  decodeLedgerSlot,
  decodeRegistration,
  ledgerInteger,
  type LedgerSlot,
  readConfirmedLedgerHead,
} from "./codecs";

/** Registration freezes before the common game clock starts, leaving time to create and seat every group. */
export const BLITZ_SLOT_PREPARATION_SECONDS = 300;

export interface LedgerSlotKey {
  chainId: string;
  slotId: number;
}
export interface SlotRegistration {
  wallet: string;
  registeredAt: number;
}
export interface RegistrationPage {
  slot: LedgerSlot;
  blockNumber: number;
  blockHash: string;
  secondsUntilClose: number;
  registrations: SlotRegistration[];
  next: number | null;
}
export interface RegistrationQuery extends LedgerSlotKey {
  from?: number;
  blockNumber?: number;
  blockHash?: string;
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

/** One bounded page, ordered by the ledger index, with the stored block timestamp as each wallet's link cutoff. */
export async function readRegistrationPage(
  provider: RpcProvider,
  address: string,
  query: RegistrationQuery,
): Promise<RegistrationPage> {
  const head = await readConfirmedLedgerHead(provider, query.blockNumber ?? "latest");
  if (query.blockHash !== undefined && BigInt(head.hash) !== BigInt(query.blockHash))
    throw new Error("registration_head_changed");
  const slot = await readLedgerSlot(provider, address, query, head.number);
  if (!slot.exists) throw new Error("invalid_ledger_slot");
  const from = query.from ?? 0;
  if (!Number.isSafeInteger(from) || from < 0 || from > slot.registeredCount)
    throw new Error("invalid_registration_offset");
  const base = {
    slot,
    blockNumber: head.number,
    blockHash: head.hash,
    secondsUntilClose: Math.max(0, slot.close - head.time),
  };
  if (head.time < slot.close || from === slot.registeredCount) return { ...base, registrations: [], next: null };
  const end = Math.min(from + 100, slot.registeredCount);
  const registrations = await readStoredRegistrations(provider, address, query, head.number, slot.close, from, end);
  if (BigInt((await readConfirmedLedgerHead(provider, head.number)).hash) !== BigInt(head.hash))
    throw new Error("registration_head_changed");
  return { ...base, registrations, next: end < slot.registeredCount ? end : null };
}

const readStoredRegistrations = async (
  provider: RpcProvider,
  address: string,
  key: LedgerSlotKey,
  head: number,
  close: number,
  from: number,
  end: number,
): Promise<SlotRegistration[]> => {
  const fields = await provider.callContract(
    {
      contractAddress: address,
      entrypoint: "get_registrations",
      calldata: [key.chainId, String(key.slotId), String(from), String(end - from)],
    },
    head,
  );
  const count = ledgerInteger(fields[0]!);
  if (count !== end - from || fields.length !== 1 + count * 2) throw new Error("invalid_registration_page");
  const registrations = Array.from({ length: count }, (_, index) => {
    const wallet = fields[1 + index * 2]!;
    const registeredAt = ledgerInteger(fields[2 + index * 2]!);
    if (BigInt(wallet) <= 0n || BigInt(wallet) >= 2n ** 251n || registeredAt >= close)
      throw new Error("invalid_registration_page");
    return { wallet, registeredAt };
  });
  if (new Set(registrations.map(({ wallet }) => BigInt(wallet).toString())).size !== count)
    throw new Error("duplicate_registered_wallet");
  return registrations;
};
