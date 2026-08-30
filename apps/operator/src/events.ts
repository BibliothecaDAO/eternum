import { hash } from "starknet";
import type { ChainEvent, LedgerRegistrationMessage, LedgerResultRow, LedgerResultsMessage } from "./types";

export const REGISTERED_SELECTOR = normalizeFelt(hash.getSelectorFromName("Registered"));
export const EVENT_EMITTED_SELECTOR = normalizeFelt(hash.getSelectorFromName("EventEmitted"));

export function resultCommitment(message: LedgerResultsMessage): string {
  const rows = message.rows.flatMap(({ owner, rank, chests }) => [BigInt(owner), BigInt(rank), BigInt(chests)]);
  return normalizeFelt(
    hash.computePoseidonHashOnElements([BigInt(message.gameId), BigInt(message.rows.length), ...rows]),
  );
}

export function parseLedgerRegistration(event: ChainEvent): LedgerRegistrationMessage {
  assertSelector(event.keys[0], REGISTERED_SELECTOR, "Registered");
  if (event.keys.length < 3 || event.data.length !== 5) throw new Error("Malformed ledger Registered event");

  return {
    gameId: parseSafeNumber(event.keys[1], "registration game id"),
    owner: normalizeFelt(event.keys[2]!),
    realmId: BigInt(event.data[0]!) + (BigInt(event.data[1]!) << 128n),
    metadata: [normalizeFelt(event.data[2]!), normalizeFelt(event.data[3]!), normalizeFelt(event.data[4]!)],
  };
}

export function parseLedgerResults(
  events: readonly ChainEvent[],
  selectors: { resultReadySelector: string; resultRowSelector: string },
): LedgerResultsMessage[] {
  const groups = new Map<string, Map<number, LedgerResultRow>>();
  const completed: LedgerResultsMessage[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    const position = `${normalizeFelt(event.transaction_hash)}:${event.event_index}`;
    if (seen.has(position)) continue;
    seen.add(position);
    assertSelector(event.keys[0], EVENT_EMITTED_SELECTOR, "EventEmitted");

    const eventSelector = normalizeFelt(event.keys[1] ?? "0x0");
    const { keys, values } = readKeyAndValueSpans(event.data);
    if (eventSelector === normalizeFelt(selectors.resultRowSelector)) {
      const row = parseResultRow(keys, values);
      const group = groups.get(row.key) ?? new Map<number, LedgerResultRow>();
      const existing = group.get(row.index);
      if (existing && JSON.stringify(existing) !== JSON.stringify(row.value)) {
        throw new Error(`Conflicting result row ${row.key}:${row.index}`);
      }
      group.set(row.index, row.value);
      groups.set(row.key, group);
      continue;
    }
    if (eventSelector !== normalizeFelt(selectors.resultReadySelector)) continue;

    const ready = parseResultsReady(keys, values);
    const rows = groups.get(ready.key) ?? new Map();
    completed.push({ gameId: ready.gameId, trialId: ready.trialId, rows: orderedRows(rows, ready.playerCount) });
    groups.delete(ready.key);
  }

  return completed;
}

function parseResultRow(keys: string[], values: string[]) {
  if (keys.length !== 3 || values.length !== 3) throw new Error("Malformed LedgerResultRowReady event");
  const gameId = parseSafeNumber(keys[0], "result game id");
  const trialId = BigInt(keys[1]!);
  return {
    key: resultKey(gameId, trialId),
    index: parseSafeNumber(keys[2], "result index"),
    value: {
      owner: normalizeFelt(values[0]!),
      rank: parseSafeNumber(values[1], "result rank"),
      chests: parseSafeNumber(values[2], "result chests"),
    },
  };
}

function parseResultsReady(keys: string[], values: string[]) {
  if (keys.length !== 2 || values.length !== 1) throw new Error("Malformed LedgerResultsReady event");
  const gameId = parseSafeNumber(keys[0], "ready game id");
  const trialId = BigInt(keys[1]!);
  return {
    gameId,
    trialId,
    key: resultKey(gameId, trialId),
    playerCount: parseSafeNumber(values[0], "result player count"),
  };
}

function orderedRows(rows: Map<number, LedgerResultRow>, playerCount: number): LedgerResultRow[] {
  if (rows.size !== playerCount) throw new Error(`Result ready declared ${playerCount} rows but received ${rows.size}`);
  return Array.from({ length: playerCount }, (_, index) => {
    const row = rows.get(index);
    if (!row) throw new Error(`Result row ${index} is missing`);
    return row;
  });
}

function readKeyAndValueSpans(data: string[]): { keys: string[]; values: string[] } {
  const keys = readSpan(data, 0);
  const values = readSpan(data, keys.nextOffset);
  if (values.nextOffset !== data.length) throw new Error("Dojo event has trailing data");
  return { keys: keys.values, values: values.values };
}

function readSpan(data: string[], offset: number): { nextOffset: number; values: string[] } {
  const length = parseSafeNumber(data[offset], "event span length");
  const nextOffset = offset + length + 1;
  if (nextOffset > data.length) throw new Error("Dojo event span exceeds payload");
  return { nextOffset, values: data.slice(offset + 1, nextOffset) };
}

function assertSelector(actual: string | undefined, expected: string, label: string): void {
  if (!actual || normalizeFelt(actual) !== normalizeFelt(expected)) throw new Error(`Expected ${label} event`);
}

function resultKey(gameId: number, trialId: bigint): string {
  return `${gameId}:${trialId}`;
}

function parseSafeNumber(value: string | undefined, label: string): number {
  if (value === undefined) throw new Error(`${label} is missing`);
  const number = Number(BigInt(value));
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label} is invalid: ${value}`);
  return number;
}

function normalizeFelt(value: string): string {
  return `0x${BigInt(value).toString(16)}`;
}
