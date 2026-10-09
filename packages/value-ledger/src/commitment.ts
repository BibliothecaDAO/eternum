import { hash, shortString } from "starknet";
interface BlitzResult {
  chainId: string;
  gameId: number;
  rows: readonly { wallet: string | bigint; rank: number }[];
}

/** The published v3 commitment binds the frozen wallets and competition ranks; chest draws belong to Starknet. */
export const blitzCommitment = (result: Pick<BlitzResult, "chainId" | "gameId" | "rows">): string => {
  const felts: (string | number | bigint)[] = [
    shortString.encodeShortString("ETERNUM_BLITZ_RESULT"),
    3,
    result.chainId,
    result.gameId,
    result.rows.length,
  ];
  for (const row of result.rows) felts.push(row.wallet, row.rank);
  return hash.computePoseidonHashOnElements(felts);
};
