import { hash } from "starknet";
export const batchRemaining = (
  events: readonly { from_address: string; keys: string[]; data: string[] }[],
  address: string,
  gameId: number,
  transactionHash: string,
): bigint => {
  const rows = events.filter(
    (event) =>
      BigInt(event.from_address) === BigInt(address) &&
      BigInt(event.keys[0] ?? "0") === BigInt(hash.getSelectorFromName("BatchProgress")),
  );
  if (rows.length !== 1) throw new Error("batch_progress_missing_or_invalid");
  const progress = decodeBatchProgress(rows[0]!);
  if (progress.gameId !== BigInt(gameId) || progress.transactionHash !== BigInt(transactionHash))
    throw new Error("batch_progress_missing_or_invalid");
  return progress.remaining;
};

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
