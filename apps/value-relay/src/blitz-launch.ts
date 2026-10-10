import { Account, hash, type RpcProvider } from "starknet";
import {
  rpcAt,
  readLedgerSlot,
  ledgerInteger,
  decodeBlitzSeason,
  readConfirmedLedgerHead,
  type LedgerSlotKey,
} from "@realms-world/value-ledger";
import { relayOperation } from "./ports";

interface Credentials {
  rpcUrl: string;
  contractAddress: string;
  accountAddress: string;
  privateKey: string;
}
interface Window {
  start: number;
  end: number;
}

/** Only this Worker's operator stream signs economic mutations; the launcher supplies the scheduled slot key. */
export const openSlotOnLedger = (credentials: Credentials, key: LedgerSlotKey, window: Window) =>
  relayOperation("open ledger Blitz registration", async () => {
    const provider = rpcAt(credentials.rpcUrl);
    const head = await readConfirmedLedgerHead(provider);
    const slot = await readLedgerSlot(provider, credentials.contractAddress, key, head.number);
    if (slot.exists) {
      if (slot.close !== window.start || slot.end !== window.end || slot.cancelled)
        throw new Error("ledger_slot_window_differs");
      return;
    }
    if (window.start <= head.time || window.end <= window.start)
      throw new Error("paid_registration_must_open_before_start");
    const season = await containingSeason(provider, credentials.contractAddress, window, head.number);
    await submit(credentials, "open_slot", [
      key.chainId,
      String(key.slotId),
      String(season.id),
      String(season.presetId),
      String(window.start),
      String(window.end),
    ]);
    const recorded = await readLedgerSlot(provider, credentials.contractAddress, key, await provider.getBlockNumber());
    if (
      !recorded.exists ||
      recorded.close !== window.start ||
      recorded.end !== window.end ||
      recorded.seasonId !== season.id
    )
      throw new Error("ledger_slot_not_recorded");
  });

/** The current contract cannot abort between start and end. Persisted cleanup retries at that boundary automatically. */
export const refundSlotOnLedger = (credentials: Credentials, key: LedgerSlotKey) =>
  relayOperation("unlock failed Blitz refunds", async (): Promise<number | null> => {
    const provider = rpcAt(credentials.rpcUrl);
    const head = await readConfirmedLedgerHead(provider);
    const slot = await readLedgerSlot(provider, credentials.contractAddress, key, head.number);
    if (!slot.exists || slot.cancelled) return null;
    if (head.time >= slot.close && head.time < slot.end) return slot.end - head.time;
    await submit(credentials, head.time < slot.close ? "cancel_slot" : "abort_slot", [key.chainId, String(key.slotId)]);
    const refunded = await readLedgerSlot(provider, credentials.contractAddress, key, await provider.getBlockNumber());
    if (!refunded.exists || !refunded.cancelled) throw new Error("ledger_refunds_not_enabled");
    return null;
  });

export const markSlotRefundable = (credentials: Credentials, key: LedgerSlotKey, wallets: readonly string[]) =>
  relayOperation("mark unseated registrations refundable", async () => {
    if (wallets.length)
      await submit(credentials, "mark_refundable", [
        key.chainId,
        String(key.slotId),
        String(wallets.length),
        ...wallets,
      ]);
  });

const containingSeason = async (provider: RpcProvider, address: string, window: Window, head: number) => {
  const matches: { id: number; presetId: number }[] = [];
  let token: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await provider.getEvents({
      address,
      from_block: { block_number: 0 },
      to_block: { block_number: head },
      keys: [[hash.getSelectorFromName("SeasonOpened")]],
      chunk_size: 100,
      ...(token ? { continuation_token: token } : {}),
    });
    for (const row of page.events) {
      if (row.keys.length !== 2 || row.data.length !== 3 || BigInt(row.from_address) !== BigInt(address))
        throw new Error("invalid_season_event");
      const id = ledgerInteger(row.keys[1]!);
      const season = await seasonAt(provider, address, id, head);
      if (window.start >= season.start && window.end < season.end) matches.push({ id, presetId: season.presetId });
    }
    token = page.continuation_token;
    if (token && seen.has(token)) throw new Error("season_page_cycle");
    if (token) seen.add(token);
  } while (token);
  if (matches.length !== 1) throw new Error("ledger_season_missing_or_ambiguous");
  return matches[0]!;
};
const seasonAt = async (provider: RpcProvider, address: string, id: number, head: number) => {
  const fields = await provider.callContract(
    { contractAddress: address, entrypoint: "get_season", calldata: [String(id)] },
    head,
  );
  return decodeBlitzSeason(fields);
};
const submit = async (credentials: Credentials, entrypoint: string, calldata: string[]) => {
  const provider = rpcAt(credentials.rpcUrl);
  const account = new Account({ provider, address: credentials.accountAddress, signer: credentials.privateKey });
  const transaction = await account.execute({ contractAddress: credentials.contractAddress, entrypoint, calldata });
  const receipt = await provider.waitForTransaction(transaction.transaction_hash);
  if (receipt.isReverted()) throw new Error("ledger_launch_mutation_reverted");
};
