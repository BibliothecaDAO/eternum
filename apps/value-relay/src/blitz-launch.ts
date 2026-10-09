import { Account, hash, type RpcProvider } from "starknet";
import { rpcAt, readLedgerGame, ledgerInteger, type LedgerGameKey } from "@realms-world/value-ledger";
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

/** Only this Worker's operator stream signs economic mutations; the launcher supplies a real created shard key. */
export const openBlitzOnLedger = (credentials: Credentials, key: LedgerGameKey, window: Window) =>
  relayOperation("open ledger Blitz registration", async () => {
    const provider = rpcAt(credentials.rpcUrl);
    const head = await confirmedHead(provider);
    if (await gameOpened(provider, credentials.contractAddress, key, head.block_number)) {
      const game = await readLedgerGame(provider, credentials.contractAddress, key, head.block_number);
      if (game.start !== window.start || game.end !== window.end || game.cancelled || game.finalized)
        throw new Error("ledger_game_window_differs");
      return;
    }
    if (window.start <= head.timestamp || window.end <= window.start)
      throw new Error("paid_registration_must_open_before_start");
    const season = await containingSeason(provider, credentials.contractAddress, window, head.block_number);
    await submit(credentials, "open_game", [
      key.chainId,
      String(key.gameId),
      String(season.id),
      String(season.presetId),
      String(window.start),
      String(window.end),
    ]);
    const recorded = await readLedgerGame(provider, credentials.contractAddress, key, await provider.getBlockNumber());
    if (recorded.start !== window.start || recorded.end !== window.end || recorded.seasonId !== season.id)
      throw new Error("ledger_game_not_recorded");
  });

export const validateBlitzWindow = (credentials: Credentials, key: LedgerGameKey, window: Window) =>
  relayOperation("validate actual Blitz season window", async () => {
    const provider = rpcAt(credentials.rpcUrl);
    const head = await confirmedHead(provider);
    const game = await readLedgerGame(provider, credentials.contractAddress, key, head.block_number);
    const season = await seasonAt(provider, credentials.contractAddress, game.seasonId, head.block_number);
    if (
      game.cancelled ||
      game.finalized ||
      window.start < game.start ||
      window.end <= window.start ||
      window.end >= season.end ||
      window.start < season.start
    )
      throw new Error("actual_blitz_window_outside_season");
  });

/** The current contract cannot abort between start and end. Persisted cleanup retries at that boundary automatically. */
export const refundBlitzOnLedger = (credentials: Credentials, key: LedgerGameKey) =>
  relayOperation("unlock failed Blitz refunds", async (): Promise<number | null> => {
    const provider = rpcAt(credentials.rpcUrl);
    const head = await confirmedHead(provider);
    if (!(await gameOpened(provider, credentials.contractAddress, key, head.block_number))) return null;
    const game = await readLedgerGame(provider, credentials.contractAddress, key, head.block_number);
    if (game.cancelled || game.finalized) return null;
    if (head.timestamp >= game.start && head.timestamp < game.end) return game.end - head.timestamp;
    await submit(credentials, head.timestamp < game.start ? "cancel_game" : "abort_game", [
      key.chainId,
      String(key.gameId),
    ]);
    const refunded = await readLedgerGame(provider, credentials.contractAddress, key, await provider.getBlockNumber());
    if (!refunded.cancelled) throw new Error("ledger_refunds_not_enabled");
    return null;
  });

const confirmedHead = async (provider: RpcProvider) => {
  const head = await provider.getBlock("latest");
  if (
    !("block_number" in head) ||
    !("status" in head) ||
    !["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(head.status ?? "")
  )
    throw new Error("ledger_head_unconfirmed");
  return head;
};
const gameOpened = async (provider: RpcProvider, address: string, key: LedgerGameKey, head: number) => {
  const page = await provider.getEvents({
    address,
    from_block: { block_number: 0 },
    to_block: { block_number: head },
    keys: [[hash.getSelectorFromName("GameOpened")], [key.chainId], [`0x${key.gameId.toString(16)}`]],
    chunk_size: 2,
  });
  if (page.continuation_token || page.events.length > 1) throw new Error("ambiguous_ledger_game");
  for (const row of page.events)
    if (
      BigInt(row.from_address) !== BigInt(address) ||
      row.keys.length !== 3 ||
      BigInt(row.keys[1]!) !== BigInt(key.chainId) ||
      Number(BigInt(row.keys[2]!)) !== key.gameId
    )
      throw new Error("wrong_ledger_game_event");
  return page.events.length === 1;
};
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
  if (fields.length !== 16 || BigInt(fields[10]!) !== 1n) throw new Error("invalid_ledger_season");
  return { presetId: ledgerInteger(fields[11]!), start: ledgerInteger(fields[12]!), end: ledgerInteger(fields[13]!) };
};
const submit = async (credentials: Credentials, entrypoint: string, calldata: string[]) => {
  const provider = rpcAt(credentials.rpcUrl);
  const account = new Account({ provider, address: credentials.accountAddress, signer: credentials.privateKey });
  const transaction = await account.execute({ contractAddress: credentials.contractAddress, entrypoint, calldata });
  const receipt = await provider.waitForTransaction(transaction.transaction_hash);
  if (receipt.isReverted()) throw new Error("ledger_launch_mutation_reverted");
};
