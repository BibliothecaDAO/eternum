import { Account } from "starknet";
import {
  rpcAt,
  readConfirmedLedgerHead,
  decodeFrontierSeason,
  decodeWithdrawalPayment,
  decodeSettlementReport,
  ledgerBool,
} from "@realms-world/value-ledger";
import type { ledgerReportAdapter } from "./chain";
import type { FrontierSettlement } from "./frontier-sweep";
import { relayOperation, type MonitorPorts, type ReportedClaim } from "./ports";

type ReadApprovalState = (entrypoint: string, calldata: string[]) => Promise<string[]>;

/** Read current custody state before signing; a successful write or lost acknowledgment needs no second transaction. */
export const ledgerApprovals = (
  credentials: Parameters<typeof ledgerReportAdapter>[0],
): Pick<MonitorPorts["ledger"], "approvePayment" | "approveSettlement"> => {
  const approve = (
    entrypoint: string,
    calldata: string[],
    season: string[],
    needed: (read: ReadApprovalState) => Promise<boolean>,
  ) =>
    relayOperation("approve verified ledger report", async () => {
      const provider = rpcAt(credentials.rpcUrl);
      const head = await readConfirmedLedgerHead(provider);
      const read: ReadApprovalState = (entrypoint, calldata) =>
        provider.callContract({ contractAddress: credentials.contractAddress, entrypoint, calldata }, head.number);
      if (decodeFrontierSeason(await read("get_frontier", season)).closed || !(await needed(read))) return;
      const account = new Account({ provider, address: credentials.accountAddress, signer: credentials.privateKey });
      const transaction = await account.execute({ contractAddress: credentials.contractAddress, entrypoint, calldata });
      const receipt = await provider.waitForTransaction(transaction.transaction_hash);
      if (receipt.isReverted()) throw new Error("ledger_approval_reverted");
    });
  return {
    approvePayment: (report) =>
      approve(
        "approve_payment",
        [
          report.chainId,
          String(report.seasonId),
          report.transactionHash,
          report.wallet,
          ...u256Fields(report.amount),
          String(report.prizeRank),
          String(report.prizeCount),
        ],
        [report.chainId, String(report.seasonId)],
        (read) => paymentNeedsApproval(read, report),
      ),
    approveSettlement: (report) =>
      approve(
        "approve_settlement",
        [
          report.chainId,
          String(report.gameId),
          ...u256Fields(report.chestWithdrawn),
          ...u256Fields(report.prizeWithdrawn),
        ],
        [report.chainId, String(report.gameId)],
        (read) => settlementNeedsApproval(read, report),
      ),
  };
};

async function paymentNeedsApproval(read: ReadApprovalState, report: ReportedClaim) {
  const key = [report.chainId, report.transactionHash];
  const current = decodeWithdrawalPayment(await read("get_payment", key));
  if (
    !current ||
    current.paid ||
    current.seasonId !== report.seasonId ||
    BigInt(current.wallet) === 0n ||
    BigInt(current.wallet) !== BigInt(report.wallet) ||
    BigInt(current.amount) !== BigInt(report.amount) ||
    current.prizeRank !== report.prizeRank ||
    current.prizeCount !== report.prizeCount
  )
    return false;
  return !(await isApproved(read, "payment_approved", key));
}

async function settlementNeedsApproval(read: ReadApprovalState, report: FrontierSettlement) {
  const key = [report.chainId, String(report.gameId)];
  const current = decodeSettlementReport(await read("get_settlement", key));
  if (
    current.ready === 0 ||
    BigInt(current.chestWithdrawn) !== BigInt(report.chestWithdrawn) ||
    BigInt(current.prizeWithdrawn) !== BigInt(report.prizeWithdrawn)
  )
    return false;
  return !(await isApproved(read, "settlement_approved", key));
}

async function isApproved(read: ReadApprovalState, entrypoint: string, key: string[]) {
  const fields = await read(entrypoint, key);
  if (fields.length !== 1) throw new Error("invalid_ledger_approval");
  return ledgerBool(fields[0]!);
}
const u256Fields = (amount: string) => [String(BigInt(amount) & (2n ** 128n - 1n)), String(BigInt(amount) >> 128n)];
