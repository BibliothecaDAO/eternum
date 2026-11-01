import type { PayoutCosigner } from "./cosigner-client";
import { Account, CallData, cairo, type RpcProvider } from "starknet";
import {
  rpcAt,
  readConfirmedLedgerHead,
  decodeFrontierSeason,
  frontierTreasuryAmount,
} from "@realms-world/value-ledger";
import type { FrontierSettlement } from "./frontier-sweep";
import type { ledgerReportAdapter } from "./chain";

/** Custody checks the exact totals again in the closing transaction, under the ledger's shared signer permit. */
export async function settleFrontier(
  credentials: Parameters<typeof ledgerReportAdapter>[0],
  settlement: FrontierSettlement,
  cosigner: PayoutCosigner,
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
  const deadline = await provider.callContract(
    {
      contractAddress: credentials.contractAddress,
      entrypoint: "frontier_claim_deadline",
      calldata: [chainId, String(gameId)],
    },
    head.number,
  );
  if (deadline.length !== 1) throw new Error("frontier_claim_deadline_invalid");
  const expired = BigInt(head.time) >= BigInt(deadline[0]!);
  const paidBeyondReceipts =
    BigInt(season.paid) > BigInt(chestWithdrawn) || BigInt(season.prizePaid) > BigInt(prizeWithdrawn);
  const fullyPaid =
    BigInt(season.paid) === BigInt(chestWithdrawn) &&
    BigInt(season.prizePaid) === BigInt(prizeWithdrawn) &&
    season.prizePaid === season.prizePool;
  if (head.time < season.end || paidBeyondReceipts || (!expired && !fullyPaid))
    throw new Error("frontier_settlement_not_paid");
  const terms = {
    chainId,
    gameId,
    chestWithdrawn: season.paid,
    prizeWithdrawn: season.prizePaid,
    treasuryAmount: frontierTreasuryAmount(season),
  };
  const signature = await cosigner.settle(terms);
  await submitSettlement(credentials, provider, terms, signature);
}

async function submitSettlement(
  credentials: Parameters<typeof ledgerReportAdapter>[0],
  provider: RpcProvider,
  settlement: FrontierSettlement,
  signature: import("@realms-world/value-ledger").Cosignature,
) {
  const account = new Account({ provider, address: credentials.accountAddress, signer: credentials.privateKey });
  const tx = await account.execute({
    contractAddress: credentials.contractAddress,
    entrypoint: "settle_frontier",
    calldata: CallData.compile({
      shard: settlement.chainId,
      season_id: settlement.gameId,
      chest_withdrawn: cairo.uint256(settlement.chestWithdrawn),
      prize_withdrawn: cairo.uint256(settlement.prizeWithdrawn),
      signature_r: signature.r,
      signature_s: signature.s,
    }),
  });
  const receipt = await provider.waitForTransaction(tx.transaction_hash, { errorStates: [] });
  if (receipt.isReverted()) throw new Error("frontier_settlement_reverted", { cause: receipt.revert_reason });
}
