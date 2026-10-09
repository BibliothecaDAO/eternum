import { hash, shortString } from "starknet";
import type { BlitzResult } from "./ports";

/** The published v3 commitment binds the frozen wallets and competition ranks; chest draws belong to Starknet. */
export const blitzCommitment = (result: Pick<BlitzResult, "chainId" | "gameId" | "rows">): string => {
  const felts: (string | number)[] = [
    shortString.encodeShortString("ETERNUM_BLITZ_RESULT"),
    3,
    result.chainId,
    result.gameId,
    result.rows.length,
  ];
  for (const row of result.rows) felts.push(row.wallet, row.rank);
  return hash.computePoseidonHashOnElements(felts);
};
