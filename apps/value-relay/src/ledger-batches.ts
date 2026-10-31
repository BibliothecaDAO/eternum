import type { PayoutCosigner } from "./cosigner-client";
import type { Cosignature } from "@realms-world/value-ledger";
import { Effect } from "effect";
import { Account, type Call, type RpcProvider } from "starknet";
import { rpcAt, decodeFrontierSeason, ledgerU256, readConfirmedLedgerHead } from "@realms-world/value-ledger";
import type { LedgerPayDecision } from "@realms-world/identity";
import { RecordedSigner } from "./recorded-signer";
import { ledgerPaymentRead, ledgerClaimAdapter, ledgerReportAdapter, paymentFailure } from "./chain";
import { RelayFailure, relayOperation, type Withdrawal, type ClaimOutcome, type PayableClaim } from "./ports";

type Credentials = Parameters<typeof ledgerReportAdapter>[0];
type Batch = { phase: "report"; rows: readonly PayableClaim[] } | { phase: "pay"; rows: readonly SignedClaim[] };
interface SignedClaim extends PayableClaim {
  signature: Cosignature;
}
interface BatchContext {
  credentials: Credentials;
  cosigner: PayoutCosigner;
  provider: RpcProvider;
  record(decisions: LedgerPayDecision[]): Promise<void>;
}
const resultOf = (withdrawal: Withdrawal, error: string | null): ClaimOutcome => ({
  claimId: withdrawal.transactionHash,
  error,
});

/** Reports and pays are separate confirmed multicalls. A reverting pay cannot erase recorded debt. */
export const ledgerBatches = (credentials: Credentials, record: BatchContext["record"], cosigner: PayoutCosigner) => {
  const context: BatchContext = { credentials, record, cosigner, provider: rpcAt(credentials.rpcUrl) };
  return {
    reportMany: (withdrawals: readonly Withdrawal[]) =>
      relayOperation("report Frontier withdrawal page", () =>
        submitBatch(context, {
          phase: "report",
          rows: withdrawals.map((withdrawal) => ({ withdrawal, wallet: "0x0" })),
        }),
      ),
    payMany: (rows: readonly PayableClaim[]) =>
      relayOperation("pay Frontier withdrawal page", () => payAffordable(context, rows)),
  };
};
const submitBatch = async (context: BatchContext, batch: Batch): Promise<ClaimOutcome[]> => {
  if (!batch.rows.length) return [];
  try {
    await submitConfirmed(context, batch);
    return batch.rows.map(({ withdrawal }) => resultOf(withdrawal, null));
  } catch (error) {
    const failure = classifyFailure(error);
    if (batch.rows.length > 1 && isPermanentFailure(failure)) {
      const middle = Math.ceil(batch.rows.length / 2);
      const halves: Batch[] =
        batch.phase === "pay"
          ? [
              { phase: "pay", rows: batch.rows.slice(0, middle) },
              { phase: "pay", rows: batch.rows.slice(middle) },
            ]
          : [
              { phase: "report", rows: batch.rows.slice(0, middle) },
              { phase: "report", rows: batch.rows.slice(middle) },
            ];
      return [...(await submitBatch(context, halves[0]!)), ...(await submitBatch(context, halves[1]!))];
    }
    return batch.rows.map(({ withdrawal }) => resultOf(withdrawal, failure.operation));
  }
};
const submitConfirmed = async (context: BatchContext, batch: Batch) => {
  if (batch.rows.length === 1) {
    if (batch.phase === "report")
      return Effect.runPromise(ledgerReportAdapter(context.credentials)(batch.rows[0]!.withdrawal));
    const row = batch.rows[0]!;
    return Effect.runPromise(
      ledgerClaimAdapter(context.credentials, (decision) => context.record([decision]))(
        row.withdrawal,
        row.wallet,
        row.signature,
      ),
    );
  }
  const signer =
    batch.phase === "pay"
      ? new RecordedSigner(context.credentials.privateKey, (transactionHash) =>
          context.record(batch.rows.map(({ withdrawal, wallet }) => payDecision(withdrawal, wallet, transactionHash))),
        )
      : context.credentials.privateKey;
  const account = new Account({ provider: context.provider, address: context.credentials.accountAddress, signer });
  const calls =
    batch.phase === "pay"
      ? batch.rows.map((row) => claimCall(context.credentials.contractAddress, row, row.signature))
      : batch.rows.map((row) => claimCall(context.credentials.contractAddress, row, null));
  const tx = await account.execute(calls);
  const receipt = await context.provider.waitForTransaction(tx.transaction_hash, { errorStates: [] });
  if (receipt.isReverted()) throw paymentFailure(receipt.revert_reason);
  if (batch.phase === "report") await verifyReportedDebt(context.credentials, batch.rows);
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
const claimCall = (
  contractAddress: string,
  { withdrawal, wallet }: PayableClaim,
  signature: Cosignature | null,
): Call => ({
  contractAddress,
  entrypoint: signature ? "pay" : "report_withdrawal",
  calldata: [
    withdrawal.chainId,
    String(withdrawal.seasonId),
    withdrawal.transactionHash,
    ...(signature ? [wallet] : []),
    ...amountOf(withdrawal.amount),
    ...(signature ? [signature.r, signature.s] : [String(withdrawal.prizeRank), String(withdrawal.prizeCount)]),
  ],
});
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
  const budgets = new Map<string, bigint | null>(),
    payable: SignedClaim[] = [],
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
    if (!payment) waiting.push(resultOf(row.withdrawal, "ledger_withdrawal_unreported"));
    else if (amount > available) waiting.push(resultOf(row.withdrawal, "ledger_unlock_exceeded"));
    else {
      try {
        const signature = await context.cosigner.pay(row.withdrawal, row.wallet);
        payable.push({ ...row, signature });
        budgets.set(key, available - amount);
      } catch {
        waiting.push(resultOf(row.withdrawal, "cosigner_unavailable"));
      }
    }
  }
  return [...waiting, ...(await submitBatch(context, { phase: "pay", rows: payable }))];
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
  [
    "ledger_season_closed",
    "ledger_invalid_withdrawal",
    "ledger_report_mismatch",
    "ledger_claim_window_ended",
    "ledger_invalid_cosignature",
    "ledger_claim_already_paid",
  ].includes(failure.operation);
