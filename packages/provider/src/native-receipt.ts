import { byteArray, hash, shortString } from "starknet";

const GAMEPLAY_REJECTED = BigInt(hash.getSelectorFromName("GameplayRejected"));
const BATCH_PROGRESS = BigInt(hash.getSelectorFromName("BatchProgress"));

type ReceiptEvent = { from_address: string; keys: string[]; data: string[] };

/** The game's refusal of an action: it rolled back, and Games recorded the class and the reason. */
export interface GameplayRejection {
  statusClass: string;
  reason: string;
}

/**
 * The game's refusal recorded in this transaction's receipt, if any (games-interface GameplayRejected v1: keys
 * version, game_id, actor, tx_hash; data status_class, reason as a ByteArray). A transaction that succeeded with no
 * rejection was applied.
 */
export function gameplayRejection(
  events: readonly ReceiptEvent[],
  games: string,
  transactionHash: string,
): GameplayRejection | undefined {
  const event = events.find(
    (candidate) =>
      BigInt(candidate.from_address) === BigInt(games) &&
      BigInt(candidate.keys[0] ?? "0") === GAMEPLAY_REJECTED &&
      BigInt(candidate.keys[4] ?? "0") === BigInt(transactionHash),
  );
  if (!event) return undefined;
  const [statusClass, ...reason] = event.data;
  if (statusClass === undefined) throw new Error("Malformed gameplay rejection");
  return {
    statusClass: BigInt(statusClass) === 0n ? "" : shortString.decodeShortString(statusClass),
    reason: decodeByteArray(reason),
  };
}

/**
 * What a batched command left to do after this transaction (games-interface BatchProgress: key game_id; data actor,
 * tx_hash, remaining); undefined when the command is not batched.
 */
export function batchRemaining(
  events: readonly ReceiptEvent[],
  games: string,
  transactionHash: string,
): bigint | undefined {
  const event = events.find(
    (candidate) =>
      BigInt(candidate.from_address) === BigInt(games) &&
      BigInt(candidate.keys[0] ?? "0") === BATCH_PROGRESS &&
      BigInt(candidate.data[1] ?? "0") === BigInt(transactionHash),
  );
  if (!event) return undefined;
  if (event.data.length !== 3) throw new Error("Malformed native batch result");
  return BigInt(event.data[2]!);
}

/** A Cairo ByteArray (word count, words, pending word, its length), validated whole before it is decoded. */
export function decodeByteArray(fields: readonly string[]): string {
  const count = Number(BigInt(fields[0] ?? "-1"));
  if (!Number.isSafeInteger(count) || count < 0 || fields.length !== count + 3)
    throw new Error("Malformed native rejection reason");
  const data = fields.slice(1, count + 1);
  const pending = BigInt(fields[count + 1]!);
  const length = BigInt(fields[count + 2]!);
  if (
    data.some((word) => BigInt(word) < 0n || BigInt(word) >= 1n << 248n) ||
    length < 0n ||
    length >= 31n ||
    pending < 0n ||
    pending >= 1n << (8n * length)
  )
    throw new Error("Invalid native rejection reason");
  return byteArray.stringFromByteArray({ data, pending_word: pending.toString(), pending_word_len: Number(length) });
}
