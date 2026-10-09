import { hash, shortString } from "starknet";
import type { BlitzResult } from "./ports";

/** The ledger's published v2 felt sequence, including frozen payout wallets and little-endian u256 limbs. */
export const blitzCommitment = (result: Pick<BlitzResult, "chainId" | "gameId" | "rows">): string => {
  const felts: (string | number | bigint)[] = [
    shortString.encodeShortString("ETERNUM_BLITZ_RESULT"),
    2,
    result.chainId,
    result.gameId,
    result.rows.length,
  ];
  for (const row of result.rows) {
    const amount = BigInt(row.chest.lords);
    if (amount < 0n || amount >= 2n ** 256n) throw new Error("Invalid chest amount");
    felts.push(
      row.wallet,
      row.points,
      row.rank,
      row.chest.kind,
      row.chest.cosmetic,
      amount & (2n ** 128n - 1n),
      amount >> 128n,
    );
  }
  return hash.computePoseidonHashOnElements(felts);
};
