import { Account, CallData, cairo, type RpcProvider } from "starknet";
import { rpcAt, readConfirmedLedgerHead, decodeFrontierSeason } from "@realms-world/value-ledger";
import type { FrontierSettlement } from "./frontier-sweep";
import type { ledgerReportAdapter } from "./chain";

/** Custody checks the exact totals again in the closing transaction, under the ledger's shared signer permit. */
export async function settleFrontier(
  credentials: Parameters<typeof ledgerReportAdapter>[0],
  settlement: FrontierSettlement,
) {
  const provider = rpcAt(credentials.rpcUrl);
  const { chainId, gameId, chestWithdrawn, prizeWithdrawn } = settlement;
  const head = await readConfirmedLedgerHead(provider);
  const season = decodeFrontierSeason(
    await provider.callContract(
      {
        contractAddress: credentials.contractAddress,
        entrypoint: "get_frontier",
        calldata: [chainId, String(gameId)],
      },
      head.number,
    ),
  );
  if (season.closed) return;
  if (
    head.time < season.end ||
    BigInt(season.paid) !== BigInt(chestWithdrawn) ||
    BigInt(season.prizePaid) !== BigInt(prizeWithdrawn)
  )
    throw new Error("frontier_settlement_not_paid");
  if (!(await supportsSettlement(provider, credentials.contractAddress, head.number))) return;
  const account = new Account({ provider, address: credentials.accountAddress, signer: credentials.privateKey });
  const tx = await account.execute({
    contractAddress: credentials.contractAddress,
    entrypoint: "settle_frontier",
    calldata: CallData.compile({
      shard: chainId,
      season_id: gameId,
      chest_withdrawn: cairo.uint256(chestWithdrawn),
      prize_withdrawn: cairo.uint256(prizeWithdrawn),
    }),
  });
  const receipt = await provider.waitForTransaction(tx.transaction_hash, { errorStates: [] });
  if (receipt.isReverted()) throw new Error("frontier_settlement_reverted", { cause: receipt.revert_reason });
}

async function supportsSettlement(provider: RpcProvider, address: string, block: number) {
  const contract = await provider.getClassAt(address, block);
  const abi = typeof contract.abi === "string" ? JSON.parse(contract.abi) : contract.abi;
  if (!Array.isArray(abi)) throw new Error("frontier_ledger_abi_unavailable");
  const entrypoints = abi.flatMap((item) => (item.type === "interface" ? item.items : [item]));
  return entrypoints.some((item) => item.type === "function" && item.name === "settle_frontier");
}
