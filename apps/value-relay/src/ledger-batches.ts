import { Effect } from "effect";
import { Account, type Call, type RpcProvider } from "starknet";
import { rpcAt } from "@realms-world/value-ledger";
import type { LedgerPayDecision } from "@realms-world/identity";
import { RecordedSigner } from "./recorded-signer";
import { ledgerPaymentRead, ledgerPaymentAdapter, ledgerReportAdapter, paymentFailure } from "./chain";
import { RelayFailure, relayOperation, type Withdrawal, type ClaimOutcome, type PayableClaim } from "./ports";

type Credentials = Parameters<typeof ledgerReportAdapter>[0];
type Phase = "report" | "pay";
interface BatchContext {
  credentials: Credentials;
  provider: RpcProvider;
  record(decisions: LedgerPayDecision[]): Promise<void>;
}
const resultOf = (withdrawal: Withdrawal, error: string | null): ClaimOutcome => ({
  claimId: withdrawal.transactionHash,
  error,
});

/** Reports and pays are separate confirmed multicalls. A reverting pay cannot erase recorded debt. */
export const ledgerBatches = (credentials: Credentials, record: BatchContext["record"]) => {
  const context: BatchContext = { credentials, record, provider: rpcAt(credentials.rpcUrl) };
  return {
    reportMany: (withdrawals: readonly Withdrawal[]) =>
      relayOperation("report Frontier withdrawal page", () =>
        submitBatch(
          context,
          withdrawals.map((withdrawal) => ({ withdrawal, wallet: "0x0" })),
          "report",
        ),
      ),
    payMany: (rows: readonly PayableClaim[]) =>
      relayOperation("pay Frontier withdrawal page", () => payAffordable(context, rows)),
  };
};
const submitBatch = async (
  context: BatchContext,
  rows: readonly PayableClaim[],
  phase: Phase,
): Promise<ClaimOutcome[]> => {
  if (!rows.length) return [];
  if (rows.length === 1) return submitSingle(context, rows[0]!, phase);
  try {
    await submitConfirmed(context, rows, phase);
    return rows.map(({ withdrawal }) => resultOf(withdrawal, null));
  } catch (error) {
    const failure = classifyFailure(error);
    if (isPermanentFailure(failure)) {
      const middle = Math.ceil(rows.length / 2);
      return [
        ...(await submitBatch(context, rows.slice(0, middle), phase)),
        ...(await submitBatch(context, rows.slice(middle), phase)),
      ];
    }
    return rows.map(({ withdrawal }) => resultOf(withdrawal, failure.operation));
  }
};
const submitSingle = async (context: BatchContext, row: PayableClaim, phase: Phase) => {
  try {
    const operation =
      phase === "report"
        ? ledgerReportAdapter(context.credentials)(row.withdrawal)
        : ledgerPaymentAdapter(context.credentials, (decision) => context.record([decision]))(
            row.withdrawal,
            row.wallet,
          );
    await Effect.runPromise(operation);
    return [resultOf(row.withdrawal, null)];
  } catch (error) {
    return [resultOf(row.withdrawal, classifyFailure(error).operation)];
  }
};
const submitConfirmed = async (context: BatchContext, rows: readonly PayableClaim[], phase: Phase) => {
  const signer =
    phase === "pay"
      ? new RecordedSigner(context.credentials.privateKey, (transactionHash) =>
          context.record(rows.map(({ withdrawal, wallet }) => payDecision(withdrawal, wallet, transactionHash))),
        )
      : context.credentials.privateKey;
  const account = new Account({ provider: context.provider, address: context.credentials.accountAddress, signer });
  const tx = await account.execute(rows.map((row) => claimCall(context.credentials.contractAddress, row, phase)));
  const receipt = await context.provider.waitForTransaction(tx.transaction_hash, { errorStates: [] });
  if (receipt.isReverted()) throw paymentFailure(receipt.revert_reason);
  if (phase === "report") await verifyReportedDebt(context.credentials, rows);
};
const payDecision = (withdrawal: Withdrawal, wallet: string, transactionHash: string): LedgerPayDecision => ({
  chainId: withdrawal.chainId,
  claimId: withdrawal.transactionHash,
  transactionHash,
  realmsId: withdrawal.realmsId,
  seasonId: withdrawal.seasonId,
  wallet,
  amount: withdrawal.amount,
});
const claimCall = (contractAddress: string, { withdrawal, wallet }: PayableClaim, phase: Phase): Call => ({
  contractAddress,
  entrypoint: phase === "report" ? "report_withdrawal" : "pay",
  calldata: [
    withdrawal.chainId,
    String(withdrawal.seasonId),
    withdrawal.transactionHash,
    ...(phase === "pay" ? [wallet] : []),
    ...amountOf(withdrawal.amount),
  ],
});
const verifyReportedDebt = async (credentials: Credentials, rows: readonly PayableClaim[]) => {
  await Promise.all(
    rows.map(async ({ withdrawal }) => {
      const saved = await Effect.runPromise(
        ledgerPaymentRead(credentials.rpcUrl, credentials.contractAddress)(withdrawal),
      );
      if (!saved || saved.seasonId !== withdrawal.seasonId || BigInt(saved.amount) !== BigInt(withdrawal.amount))
        throw paymentFailure("Ledger: conflicting withdrawal report");
    }),
  );
};
const payAffordable = async (context: BatchContext, rows: readonly PayableClaim[]) => {
  if (!rows.length) return [];
  const head = await context.provider.getBlock("latest");
  if (
    !("block_number" in head) ||
    !("status" in head) ||
    !["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(head.status ?? "")
  )
    throw new Error("batch_payment_head_unconfirmed");
  const budgets = new Map<string, bigint | null>(),
    payable: PayableClaim[] = [],
    waiting: ClaimOutcome[] = [];
  for (const row of rows) {
    const key = `${row.withdrawal.chainId}:${row.withdrawal.seasonId}`;
    if (!budgets.has(key)) budgets.set(key, await availableBudget(context, row.withdrawal, head.block_number));
    const available = budgets.get(key);
    if (available === undefined) throw new Error("batch_budget_missing");
    if (available === null) waiting.push(resultOf(row.withdrawal, "ledger_season_closed"));
    else if (BigInt(row.withdrawal.amount) > available)
      waiting.push(resultOf(row.withdrawal, "ledger_unlock_exceeded"));
    else {
      payable.push(row);
      budgets.set(key, available - BigInt(row.withdrawal.amount));
    }
  }
  return [...waiting, ...(await submitBatch(context, payable, "pay"))];
};
const availableBudget = async (context: BatchContext, withdrawal: Withdrawal, block: number) => {
  const query = {
    contractAddress: context.credentials.contractAddress,
    calldata: [withdrawal.chainId, String(withdrawal.seasonId)],
  };
  const [season, unlocked] = await Promise.all([
    context.provider.callContract({ ...query, entrypoint: "get_frontier" }, block),
    context.provider.callContract({ ...query, entrypoint: "frontier_unlocked" }, block),
  ]);
  if (
    season.length !== 10 ||
    unlocked.length !== 2 ||
    BigInt(season[0]!) !== 1n ||
    ![0n, 1n].includes(BigInt(season[7]!))
  )
    throw new Error("batch_frontier_abi_differs");
  if (BigInt(season[7]!) === 1n) return null;
  const amount = decodeAmount(unlocked[0]!, unlocked[1]!) - decodeAmount(season[5]!, season[6]!);
  return amount < 0n ? 0n : amount;
};
const amountOf = (amount: string) => [String(BigInt(amount) & (2n ** 128n - 1n)), String(BigInt(amount) >> 128n)];
const decodeAmount = (low: string, high: string) => {
  const a = BigInt(low),
    b = BigInt(high);
  if (a < 0n || b < 0n || a >= 2n ** 128n || b >= 2n ** 128n) throw new Error("invalid_batch_amount");
  return a + (b << 128n);
};
const classifyFailure = (error: unknown) =>
  error instanceof RelayFailure ? error : paymentFailure(error instanceof Error ? error.message : "");
const isPermanentFailure = (failure: RelayFailure) =>
  [
    "ledger_withdrawal_exceeds_backing",
    "ledger_season_closed",
    "ledger_invalid_withdrawal",
    "ledger_report_mismatch",
    "ledger_claim_window_ended",
  ].includes(failure.operation);
