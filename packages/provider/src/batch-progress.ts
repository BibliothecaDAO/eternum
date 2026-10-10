import { hash } from "starknet";
type ReceiptEvent = { from_address: string; keys: string[]; data: string[] };
interface Scope {
  gameId?: number;
  actor?: string;
}
export function batchRemaining(
  events: readonly ReceiptEvent[],
  address: string,
  transactionHash: string,
  options: Scope & { missing: "reject" },
): bigint;
export function batchRemaining(
  events: readonly ReceiptEvent[],
  address: string,
  transactionHash: string,
  options: Scope & { missing: "allow" },
): bigint | undefined;
export function batchRemaining(
  events: readonly ReceiptEvent[],
  address: string,
  transactionHash: string,
  options: Scope & { missing: "allow" | "reject" },
): bigint | undefined {
  const rows = events.filter(
    (event) =>
      BigInt(event.from_address) === BigInt(address) &&
      BigInt(event.keys[0] ?? "0") === BigInt(hash.getSelectorFromName("BatchProgress")) &&
      BigInt(event.data[1] ?? "0") === BigInt(transactionHash),
  );
  if (!rows.length) {
    if (options.missing === "allow") return undefined;
    throw new Error("batch_progress_missing_or_invalid");
  }
  if (rows.length !== 1) throw new Error("Ambiguous batch result");
  let progress;
  try {
    progress = decodeBatchProgress(rows[0]!);
  } catch {
    throw new Error("Malformed native batch result");
  }
  if (
    (options.gameId !== undefined && progress.gameId !== BigInt(options.gameId)) ||
    (options.actor !== undefined && progress.actor !== BigInt(options.actor))
  )
    throw new Error("Malformed BatchProgress identity");
  return progress.remaining;
}

export const decodeBatchProgress = (event: { keys: string[]; data: string[] }) => {
  if (event.keys.length !== 2 || event.data.length !== 3) throw new Error("Malformed native batch result");
  const [gameId, actor, transactionHash, remaining] = [event.keys[1], ...event.data].map((value) => BigInt(value!));
  const field = 2n ** 251n + 17n * 2n ** 192n + 1n;
  if (
    gameId! < 1n ||
    gameId! >= 2n ** 32n ||
    actor! < 0n ||
    actor! >= field ||
    transactionHash! < 0n ||
    transactionHash! >= field ||
    remaining! < 0n ||
    remaining! >= 2n ** 64n
  )
    throw new Error("Invalid native batch result");
  return { gameId: gameId!, actor: actor!, transactionHash: transactionHash!, remaining: remaining! };
};
