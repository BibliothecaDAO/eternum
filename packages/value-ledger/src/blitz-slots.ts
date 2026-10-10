import { hash, type RpcProvider, type EmittedEvent } from "starknet";
import { decodeLedgerSlot, type LedgerSlot, readConfirmedLedgerHead } from "./codecs";

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
  head: number,
): Promise<LedgerSlot> {
  const fields = await provider.callContract(
    { contractAddress: address, entrypoint: "get_slot", calldata: [key.chainId, String(key.slotId)] },
    head,
  );
  return decodeLedgerSlot(fields);
}

/** One bounded page, ordered by the ledger index, with link cutoffs from confirmed registration blocks. */
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
  const wallets = await readRegisteredWallets(provider, address, query, head.number, from, end);
  const registrations = await readRegistrationTimes(provider, address, query, head.number, slot.close, wallets);
  if (BigInt((await readConfirmedLedgerHead(provider, head.number)).hash) !== BigInt(head.hash))
    throw new Error("registration_head_changed");
  return { ...base, registrations, next: end < slot.registeredCount ? end : null };
}

const readRegisteredWallets = async (
  provider: RpcProvider,
  address: string,
  key: LedgerSlotKey,
  head: number,
  from: number,
  end: number,
) => {
  const wallets = await Promise.all(
    Array.from({ length: end - from }, async (_, offset) => {
      const fields = await provider.callContract(
        {
          contractAddress: address,
          entrypoint: "get_registered_player",
          calldata: [key.chainId, String(key.slotId), String(from + offset)],
        },
        head,
      );
      if (fields.length !== 1 || BigInt(fields[0]!) <= 0n) throw new Error("invalid_registered_wallet");
      return fields[0]!;
    }),
  );
  if (new Set(wallets.map((wallet) => BigInt(wallet).toString())).size !== wallets.length)
    throw new Error("duplicate_registered_wallet");
  return wallets;
};

const readRegistrationTimes = async (
  provider: RpcProvider,
  address: string,
  key: LedgerSlotKey,
  head: number,
  close: number,
  wallets: string[],
) => {
  const selector = hash.getSelectorFromName("Registered");
  const timestamps = new Map<string, number>();
  const blocks = new Map<number, Awaited<ReturnType<typeof readConfirmedLedgerHead>>>();
  let token: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await provider.getEvents({
      address,
      from_block: { block_number: 0 },
      to_block: { block_number: head },
      keys: [[selector], [key.chainId], [String(key.slotId)], wallets],
      chunk_size: 100,
      ...(token ? { continuation_token: token } : {}),
    });
    for (const event of page.events) {
      if (!matchesRegistration(event, address, key, selector, head)) throw new Error("invalid_registration_event");
      const wallet = BigInt(event.keys[3]!).toString();
      if (timestamps.has(wallet)) throw new Error("duplicate_registration_event");
      let block = blocks.get(event.block_number);
      if (!block) {
        block = await readConfirmedLedgerHead(provider, event.block_number);
        blocks.set(event.block_number, block);
      }
      if (BigInt(block.hash) !== BigInt(event.block_hash) || block.time >= close)
        throw new Error("registration_block_differs");
      timestamps.set(wallet, block.time);
    }
    token = page.continuation_token;
    if (token && seen.has(token)) throw new Error("registration_page_cycle");
    if (token) seen.add(token);
  } while (token);
  if (timestamps.size !== wallets.length) throw new Error("registration_history_incomplete");
  return wallets.map((wallet) => {
    const registeredAt = timestamps.get(BigInt(wallet).toString());
    if (registeredAt === undefined) throw new Error("registration_history_incomplete");
    return { wallet, registeredAt };
  });
};
const matchesRegistration = (
  event: EmittedEvent,
  address: string,
  key: LedgerSlotKey,
  selector: string,
  head: number,
): event is EmittedEvent & { block_number: number; block_hash: string } =>
  event.keys.length === 4 &&
  event.data.length === 0 &&
  typeof event.block_number === "number" &&
  Number.isSafeInteger(event.block_number) &&
  event.block_number >= 0 &&
  event.block_number <= head &&
  typeof event.block_hash === "string" &&
  event.block_hash.length > 0 &&
  BigInt(event.from_address) === BigInt(address) &&
  BigInt(event.keys[0]!) === BigInt(selector) &&
  BigInt(event.keys[1]!) === BigInt(key.chainId) &&
  BigInt(event.keys[2]!) === BigInt(key.slotId);
