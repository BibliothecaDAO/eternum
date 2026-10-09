import { rpcAt } from "@realms-world/value-ledger";
import { Account, RpcProvider } from "starknet";
import type { RelayPorts } from "./ports";
import { frontierPayment } from "./adapters";
import { Effect } from "effect";
import { RelayFailure, relayOperation } from "./ports";

interface LedgerCredentials {
  rpcUrl: string;
  contractAddress: string;
  accountAddress: string;
  privateKey: string;
}

export const ledgerPaymentRead =
  (rpcUrl: string, address: string): RelayPorts["ledger"]["payment"] =>
  (withdrawal) =>
    relayOperation("read withdrawal report", async () => {
      const fields = await rpcAt(rpcUrl).callContract(
        {
          contractAddress: address,
          entrypoint: "get_payment",
          calldata: [withdrawal.chainId, withdrawal.transactionHash],
        },
        "latest",
      );
      if (fields.length !== 5 || ![0n, 1n].includes(BigInt(fields[0]!))) throw new Error("invalid_payment_record");
      const low = BigInt(fields[3]!),
        high = BigInt(fields[4]!);
      if (low < 0n || high < 0n || low >= 2n ** 128n || high >= 2n ** 128n) throw new Error("invalid_payment_amount");
      const amount = low + (high << 128n);
      if (amount === 0n && BigInt(fields[0]!) === 0n && BigInt(fields[1]!) === 0n && BigInt(fields[2]!) === 0n)
        return null;
      if (!amount || BigInt(fields[2]!) === 0n) throw new Error("invalid_payment_report");
      return {
        paid: BigInt(fields[0]!) === 1n,
        seasonId: Number(BigInt(fields[1]!)),
        wallet: fields[2]!,
        amount: String(amount),
      };
    });

/** Reporting is a separate confirmed transaction; a failed later payment cannot erase the custody guard. */
export const ledgerReportAdapter =
  (credentials: LedgerCredentials): RelayPorts["ledger"]["report"] =>
  (withdrawal, wallet) =>
    relayOperation("report Frontier withdrawal", async () => {
      const previous = await Effect.runPromise(
        ledgerPaymentRead(credentials.rpcUrl, credentials.contractAddress)(withdrawal),
      );
      if (previous?.paid) return;
      if (previous) {
        if (
          previous.seasonId !== withdrawal.seasonId ||
          BigInt(previous.wallet) !== BigInt(wallet) ||
          BigInt(previous.amount) !== BigInt(withdrawal.amount)
        )
          throw new RelayFailure({ operation: "ledger_report_mismatch" });
        return;
      }
      const amount = BigInt(withdrawal.amount);
      const { provider, account } = ledgerAccountOf(credentials);
      try {
        const transaction = await account.execute({
          contractAddress: credentials.contractAddress,
          entrypoint: "report_withdrawal",
          calldata: [
            withdrawal.chainId,
            String(withdrawal.seasonId),
            withdrawal.transactionHash,
            wallet,
            String(amount & (2n ** 128n - 1n)),
            String(amount >> 128n),
          ],
        });
        const receipt = await provider.waitForTransaction(transaction.transaction_hash, { errorStates: [] });
        if (receipt.isReverted()) throw paymentFailure(receipt.revert_reason);
      } catch (error) {
        if (error instanceof RelayFailure) throw error;
        throw paymentFailure(error instanceof Error ? error.message : "");
      }
      const reported = await Effect.runPromise(
        ledgerPaymentRead(credentials.rpcUrl, credentials.contractAddress)(withdrawal),
      );
      if (
        !reported ||
        reported.seasonId !== withdrawal.seasonId ||
        BigInt(reported.wallet) !== BigInt(wallet) ||
        BigInt(reported.amount) !== amount
      )
        throw new Error("withdrawal_report_not_recorded");
    });

/** The operator signs in the Worker; completion means the ledger transaction was confirmed. */
export const ledgerPaymentAdapter = (credentials: LedgerCredentials): RelayPorts["ledger"]["pay"] => {
  const { provider, account } = ledgerAccountOf(credentials);
  const pay = frontierPayment(async (entrypoint, calldata) => {
    try {
      const transaction = await account.execute({
        contractAddress: credentials.contractAddress,
        entrypoint,
        calldata: [...calldata],
      });
      const receipt = await provider.waitForTransaction(transaction.transaction_hash, { errorStates: [] });
      if (receipt.isReverted()) throw paymentFailure(receipt.revert_reason);
    } catch (error) {
      if (error instanceof RelayFailure) throw error;
      throw paymentFailure(error instanceof Error ? error.message : "");
    }
  });
  return (withdrawal, wallet) =>
    Effect.gen(function* () {
      if (!Number.isSafeInteger(withdrawal.confirmedAt) || withdrawal.confirmedAt < 0)
        return yield* Effect.fail(new RelayFailure({ operation: "withdrawal_clock_missing" }));
      const block = yield* relayOperation("read confirmed payout clock", () => provider.getBlock("latest"));
      if (
        !("status" in block) ||
        !["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(block.status ?? "") ||
        !Number.isSafeInteger(block.timestamp)
      )
        return yield* Effect.fail(new RelayFailure({ operation: "payout_clock_unconfirmed" }));
      if (block.timestamp < withdrawal.confirmedAt)
        return yield* Effect.fail(new RelayFailure({ operation: "ledger_clock_behind" }));
      yield* pay(withdrawal, wallet);
    });
};

/** Read current ERC721 ownership at a confirmed Starknet head for every labor request. */
export const realmsOwnershipAdapter = (rpcUrl: string, contractAddress: string): RelayPorts["realms"] => {
  const provider = rpcAt(rpcUrl);
  return {
    ownerOf: (realmId) =>
      relayOperation("read Realm owner", async () => {
        const id = BigInt(realmId);
        if (id < 0n || id >= 2n ** 256n) throw new Error("invalid_realm_id");
        const owner = await provider.callContract(
          { contractAddress, entrypoint: "owner_of", calldata: [String(id & (2n ** 128n - 1n)), String(id >> 128n)] },
          "latest",
        );
        if (owner.length !== 1) throw new Error("invalid_realm_owner");
        return owner[0]!;
      }),
  };
};

/** Pausing is idempotent at the port, including a retry after the pause transaction landed. */
export const ledgerPauserAdapter = (credentials: LedgerCredentials): (() => import("./ports").RelayEffect<void>) => {
  return () =>
    relayOperation("pause ledger payouts", async () => {
      const { provider, account } = ledgerAccountOf(credentials);
      const paused = await provider.callContract(
        { contractAddress: credentials.contractAddress, entrypoint: "is_paused", calldata: [] },
        "latest",
      );
      if (paused.length !== 1) throw new Error("invalid_pause_state");
      if (BigInt(paused[0]!) === 1n) return;
      if (BigInt(paused[0]!) !== 0n) throw new Error("invalid_pause_state");
      const transaction = await account.execute({
        contractAddress: credentials.contractAddress,
        entrypoint: "pause",
        calldata: [],
      });
      const receipt = await provider.waitForTransaction(transaction.transaction_hash);
      if (receipt.isReverted()) throw new Error("ledger_pause_reverted");
    });
};

const ledgerAccountOf = (credentials: LedgerCredentials) => {
  const provider = rpcAt(credentials.rpcUrl);
  const account = new Account({ provider, address: credentials.accountAddress, signer: credentials.privateKey });
  return { provider, account };
};

/** Only ruled terminal failures leave the retry queue; a day-boundary unlock refusal stays retryable. */
const paymentFailure = (reason = "") => {
  const operation = reason.includes("Ledger: season closed")
    ? "ledger_season_closed"
    : reason.includes("Ledger: invalid withdrawal")
      ? "ledger_invalid_withdrawal"
      : reason.includes("Ledger: unlock exceeded")
        ? "ledger_unlock_exceeded"
        : "pay Frontier claim";
  return new RelayFailure({ operation });
};
