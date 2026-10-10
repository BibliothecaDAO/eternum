import { resolveGameTransactionResourceBounds } from "@bibliothecadao/eternum/shard-fees";
import type { AccountInterface } from "starknet";
export async function resolveRegistrarExecutionDetails(
  account: Pick<AccountInterface, "callContract">,
  gamesAddress: string,
) {
  const fields = await account.callContract(
    { contractAddress: gamesAddress, entrypoint: "l2_gas_bound", calldata: [] },
    "latest",
  );
  if (fields.length !== 1) throw new Error("invalid_shard_gas_bound");
  return { version: 3 as const, tip: 0, resourceBounds: resolveGameTransactionResourceBounds(BigInt(fields[0]!)) };
}
