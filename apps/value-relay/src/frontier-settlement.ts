import { Account, CallData, cairo, type RpcProvider } from "starknet";
import { rpcAt, readConfirmedLedgerHead, decodeFrontierSeason, ledgerU256 } from "@realms-world/value-ledger";
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
  const entrypoint = expired
    ? "settle_frontier"
    : await earlySettlementAction(provider, credentials.contractAddress, head, {
        chainId,
        gameId,
        chestWithdrawn: season.paid,
        prizeWithdrawn: season.prizePaid,
      });
  if (entrypoint === null) return;
  await submitSettlement(credentials, provider, entrypoint, {
    chainId,
    gameId,
    chestWithdrawn: season.paid,
    prizeWithdrawn: season.prizePaid,
  });
}

async function earlySettlementAction(
  provider: RpcProvider,
  address: string,
  head: { number: number; time: number },
  settlement: FrontierSettlement,
) {
  const report = await provider.callContract(
    {
      contractAddress: address,
      entrypoint: "get_settlement",
      calldata: [settlement.chainId, String(settlement.gameId)],
    },
    head.number,
  );
  if (report.length !== 5) throw new Error("invalid_settlement_report");
  const ready = BigInt(report[4]!);
  const matches =
    BigInt(ledgerU256(report[0]!, report[1]!)) === BigInt(settlement.chestWithdrawn) &&
    BigInt(ledgerU256(report[2]!, report[3]!)) === BigInt(settlement.prizeWithdrawn);
  if (ready === 0n || !matches) return "report_settlement";
  if (BigInt(head.time) < ready) return null;
  const approval = await provider.callContract(
    {
      contractAddress: address,
      entrypoint: "settlement_approved",
      calldata: [settlement.chainId, String(settlement.gameId)],
    },
    head.number,
  );
  if (approval.length !== 1 || ![0n, 1n].includes(BigInt(approval[0]!))) throw new Error("invalid_settlement_approval");
  return BigInt(approval[0]!) === 1n ? "settle_frontier" : null;
}

async function submitSettlement(
  credentials: Parameters<typeof ledgerReportAdapter>[0],
  provider: RpcProvider,
  entrypoint: "report_settlement" | "settle_frontier",
  settlement: FrontierSettlement,
) {
  const account = new Account({ provider, address: credentials.accountAddress, signer: credentials.privateKey });
  const tx = await account.execute({
    contractAddress: credentials.contractAddress,
    entrypoint,
    calldata: CallData.compile({
      shard: settlement.chainId,
      season_id: settlement.gameId,
      chest_withdrawn: cairo.uint256(settlement.chestWithdrawn),
      prize_withdrawn: cairo.uint256(settlement.prizeWithdrawn),
    }),
  });
  const receipt = await provider.waitForTransaction(tx.transaction_hash, { errorStates: [] });
  if (receipt.isReverted()) throw new Error("frontier_settlement_reverted", { cause: receipt.revert_reason });
}
