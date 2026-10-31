import { Effect } from "effect";
import { Account, type Call, type RpcProvider } from "starknet";
import { rpcAt, decodeFrontierSeason, ledgerU256, readConfirmedLedgerHead } from "@realms-world/value-ledger";
import type { LedgerPayDecision } from "@realms-world/identity";
import { RecordedSigner } from "./recorded-signer";
import { ledgerPaymentRead, ledgerClaimAdapter, ledgerReportAdapter, paymentFailure } from "./chain";
import { RelayFailure, relayOperation, type Withdrawal, type ClaimOutcome, type PayableClaim } from "./ports";

type Credentials = Parameters<typeof ledgerReportAdapter>[0];
type Phase = "report" | "prepare" | "pay";
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
        : ledgerClaimAdapter(phase, context.credentials, (decision) => context.record([decision]))(
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
    phase !== "report"
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
const claimCall = (contractAddress: string, { withdrawal, wallet }: PayableClaim, phase: Phase): Call => {
  if (phase === "prepare")
    return {
      contractAddress,
      entrypoint: "prepare_payment",
      calldata: [withdrawal.chainId, withdrawal.transactionHash, wallet],
    };
  return {
    contractAddress,
    entrypoint: phase === "report" ? "report_withdrawal" : "pay",
    calldata: [
      withdrawal.chainId,
      String(withdrawal.seasonId),
      withdrawal.transactionHash,
      ...(phase === "pay" ? [wallet] : []),
      ...amountOf(withdrawal.amount),
      ...(phase === "report" ? [String(withdrawal.prizeRank), String(withdrawal.prizeCount)] : []),
    ],
  };
};
const verifyReportedDebt = async (credentials: Credentials, rows: readonly PayableClaim[]) => {
  await Promise.all(
    rows.map(async ({ withdrawal }) => {
      const saved = await Effect.runPromise(
        ledgerPaymentRead(credentials.rpcUrl, credentials.contractAddress)(withdrawal),
      );
      if (
        !saved ||
        saved.seasonId !== withdrawal.seasonId ||
        BigInt(saved.amount) !== BigInt(withdrawal.amount) ||
        saved.prizeRank !== withdrawal.prizeRank ||
        saved.prizeCount !== withdrawal.prizeCount
      )
        throw paymentFailure("Ledger: conflicting withdrawal report");
    }),
  );
};
const payAffordable = async (context: BatchContext, rows: readonly PayableClaim[]) => {
  if (!rows.length) return [];
  const head = await readConfirmedLedgerHead(context.provider);
  const limits = await context.provider.callContract(
    { contractAddress: context.credentials.contractAddress, entrypoint: "payout_allowance", calldata: [] },
    head.number,
  );
  if (limits.length !== 7) throw new Error("invalid_payout_allowance");
  const capacity = BigInt(ledgerU256(limits[0]!, limits[1]!));
  let allowance = BigInt(ledgerU256(limits[4]!, limits[5]!));
  const delay = BigInt(limits[6]!);
  const budgets = new Map<string, bigint | null>(),
    payable: PayableClaim[] = [],
    preparing: PayableClaim[] = [],
    waiting: ClaimOutcome[] = [];
  for (const row of rows) {
    const payment = await Effect.runPromise(
      ledgerPaymentRead(context.credentials.rpcUrl, context.credentials.contractAddress, head.number)(row.withdrawal),
    );
    if (payment?.paid) {
      waiting.push(resultOf(row.withdrawal, null));
      continue;
    }
    const key = `${row.withdrawal.chainId}:${row.withdrawal.seasonId}:${row.withdrawal.prizeRank > 0}`;
    if (!budgets.has(key)) budgets.set(key, await availableBudget(context, row.withdrawal, head.number));
    const available = budgets.get(key);
    if (available === undefined) throw new Error("batch_budget_missing");
    if (available === null) {
      waiting.push(resultOf(row.withdrawal, "ledger_season_closed"));
      continue;
    }
    const amount = BigInt(row.withdrawal.amount);
    const slow = row.withdrawal.prizeRank > 0 || amount > capacity;
    if (slow && payment && BigInt(payment.wallet) !== BigInt(row.wallet)) {
      preparing.push(row);
      continue;
    }
    if (!payment || (slow && BigInt(head.time) < BigInt(payment.reportedAt) + delay))
      waiting.push(resultOf(row.withdrawal, "ledger_payment_delay"));
    else if (BigInt(row.withdrawal.amount) > available)
      waiting.push(resultOf(row.withdrawal, "ledger_unlock_exceeded"));
    else if (!slow && amount > allowance) waiting.push(resultOf(row.withdrawal, "ledger_payout_allowance_spent"));
    else {
      payable.push(row);
      if (!slow) allowance -= amount;
      budgets.set(key, available - amount);
    }
  }
  const prepared = (await submitBatch(context, preparing, "prepare")).map((row) => ({
    ...row,
    error: row.error ?? "ledger_payment_delay",
  }));
  return [...waiting, ...prepared, ...(await submitBatch(context, payable, "pay"))];
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
  const funded = decodeFrontierSeason(season);
  if (unlocked.length !== 2) throw new Error("batch_frontier_abi_differs");
  if (funded.closed) return null;
  const amount =
    withdrawal.prizeRank > 0
      ? BigInt(funded.prizePool) - BigInt(funded.prizePaid)
      : BigInt(ledgerU256(unlocked[0]!, unlocked[1]!)) - BigInt(funded.paid);
  return amount < 0n ? 0n : amount;
};
const amountOf = (amount: string) => [String(BigInt(amount) & (2n ** 128n - 1n)), String(BigInt(amount) >> 128n)];
const classifyFailure = (error: unknown) =>
  error instanceof RelayFailure ? error : paymentFailure(error instanceof Error ? error.message : "");
const isPermanentFailure = (failure: RelayFailure) =>
  ["ledger_season_closed", "ledger_invalid_withdrawal", "ledger_report_mismatch", "ledger_claim_window_ended"].includes(
    failure.operation,
  );
