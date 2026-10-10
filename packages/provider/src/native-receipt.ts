export { batchRemaining } from "./batch-progress";
import { byteArray, hash, shortString } from "starknet";

const GAMEPLAY_REJECTED = BigInt(hash.getSelectorFromName("GameplayRejected"));

type ReceiptEvent = { from_address: string; keys: string[]; data: string[] };

/** The game's refusal of an action: it rolled back, and Games recorded the class and the reason. */
export interface GameplayRejection {
  statusClass: string;
  reason: string;
}

/**
 * The game's refusal recorded in this transaction's receipt, if any (games-interface GameplayRejected v1: keys
 * version, game_id, actor, tx_hash; data status_class, reason as a ByteArray). A transaction that succeeded with no
 * rejection was applied. Anything but one well-formed v1 rejection for this transaction is refused, never guessed.
 */
export function gameplayRejection(
  events: readonly ReceiptEvent[],
  games: string,
  transactionHash: string,
  scope?: { gameId: number; actor: string },
): GameplayRejection | undefined {
  const event = onlyOne(
    events.filter(
      (candidate) =>
        BigInt(candidate.from_address) === BigInt(games) &&
        BigInt(candidate.keys[0] ?? "0") === GAMEPLAY_REJECTED &&
        BigInt(candidate.keys[4] ?? "0") === BigInt(transactionHash),
    ),
    "gameplay rejection",
  );
  if (!event) return undefined;
  const [, version, gameId] = event.keys.map(BigInt);
  if (event.keys.length !== 5 || version !== 1n || gameId! <= 0n || gameId! >= 2n ** 32n)
    throw new Error("Malformed gameplay rejection");
  if (scope && (gameId !== BigInt(scope.gameId) || BigInt(event.keys[3]!) !== BigInt(scope.actor)))
    throw new Error("Malformed GameplayRejected identity");
  const [statusClass, ...reason] = event.data;
  if (statusClass === undefined) throw new Error("Malformed gameplay rejection");
  return {
    statusClass: BigInt(statusClass) === 0n ? "" : shortString.decodeShortString(statusClass),
    reason: decodeByteArray(reason),
  };
}

function onlyOne(events: readonly ReceiptEvent[], what: string): ReceiptEvent | undefined {
  if (events.length > 1) throw new Error(`Ambiguous ${what}: one transaction has ${events.length}`);
  return events[0];
}

/** A Cairo ByteArray (word count, words, pending word, its length), validated whole before it is decoded. */
function decodeByteArray(fields: readonly string[]): string {
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
