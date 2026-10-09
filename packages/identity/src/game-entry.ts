import type { GameEntry, PaidGameLedger } from "./types";
const address = (value: unknown): value is string =>
  typeof value === "string" && /^0x[0-9a-f]{1,64}$/i.test(value) && BigInt(value) > 0n && BigInt(value) < 2n ** 251n;
/** Missing terms are unavailable, never a free-entry default. */
export const readGameEntry = (value: unknown): GameEntry => {
  if (!value || typeof value !== "object" || !("kind" in value)) throw new Error("game_entry_missing");
  if (value.kind === "free") return { kind: "free" };
  if (value.kind !== "paid" || !("ledger" in value) || !value.ledger || typeof value.ledger !== "object")
    throw new Error("invalid_game_entry");
  const ledger = value.ledger as Partial<PaidGameLedger>;
  if (
    !address(ledger.address) ||
    !address(ledger.chainId) ||
    !address(ledger.feeToken) ||
    !address(ledger.shard) ||
    !Number.isSafeInteger(ledger.gameId) ||
    Number(ledger.gameId) <= 0 ||
    Number(ledger.gameId) > 0xffffffff
  )
    throw new Error("invalid_paid_game_entry");
  return {
    kind: "paid",
    ledger: {
      address: ledger.address,
      chainId: ledger.chainId,
      feeToken: ledger.feeToken,
      shard: ledger.shard,
      gameId: ledger.gameId!,
    },
  };
};
