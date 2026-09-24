import { Account, RpcProvider, type Call } from "starknet";
import { resolveAccountCredentials } from "../shared/credentials";
import type { LedgerEconomicPreset } from "./economics";
import { buildRegisterLedgerPresetCalldata } from "./economics";

export interface LedgerTarget {
  address: string;
  rpcUrl: string;
}

export interface LedgerTransactionResult {
  transactionHash: string;
  receipt: unknown;
}

function transactionSucceeded(receipt: unknown): boolean {
  const helper = receipt as { isSuccess?: () => boolean; execution_status?: string };
  if (typeof helper.isSuccess === "function") return helper.isSuccess();
  return !helper.execution_status || helper.execution_status === "SUCCEEDED";
}

function isAlreadyRegistered(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /preset already registered/i.test(message);
}

function createLedgerAccount(
  target: LedgerTarget,
  context: string,
  accountAddress: string | undefined,
  privateKey: string | undefined,
): Account {
  const credentials = resolveAccountCredentials({
    accountAddress,
    privateKey,
    context,
  });
  return new Account({
    provider: new RpcProvider({ nodeUrl: target.rpcUrl }),
    address: credentials.accountAddress,
    signer: credentials.privateKey,
  });
}

export function createLedgerAdminAccount(target: LedgerTarget, context: string): Account {
  return createLedgerAccount(target, context, process.env.LEDGER_ADMIN_ADDRESS, process.env.LEDGER_ADMIN_PRIVATE_KEY);
}

// Include the revert reason so callers' idempotency matchers (e.g. ledger preset already registered) can read it.
function receiptRevertReason(receipt: unknown): string | undefined {
  const reason = (receipt as { revert_reason?: unknown }).revert_reason;
  return typeof reason === "string" && reason.length > 0 ? reason : undefined;
}

async function executeAndWait(account: Account, calls: Call, label: string): Promise<LedgerTransactionResult> {
  const transaction = await account.execute(calls);
  const receipt = await account.waitForTransaction(transaction.transaction_hash);
  if (!transactionSucceeded(receipt)) {
    const reason = receiptRevertReason(receipt);
    throw new Error(`${label} failed for transaction ${transaction.transaction_hash}${reason ? `: ${reason}` : ""}`);
  }
  return { transactionHash: transaction.transaction_hash, receipt };
}

async function executeLedgerCall(account: Account, call: Call): Promise<LedgerTransactionResult | null> {
  try {
    return await executeAndWait(account, call, call.entrypoint);
  } catch (error) {
    if (isAlreadyRegistered(error)) return null;
    throw error;
  }
}

export async function registerLedgerPreset(
  account: Account,
  target: LedgerTarget,
  presetId: number,
  preset: LedgerEconomicPreset,
): Promise<LedgerTransactionResult | null> {
  return executeLedgerCall(account, {
    contractAddress: target.address,
    entrypoint: "register_preset",
    calldata: buildRegisterLedgerPresetCalldata(presetId, preset),
  });
}
