import { Account, CallData, RpcProvider, type Call } from "starknet";
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

function isAlreadyWritten(error: unknown, subject: "game" | "preset"): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return new RegExp(`${subject} already (opened|registered)`, "i").test(message);
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

export function createLedgerOperatorAccount(target: LedgerTarget, context: string): Account {
  return createLedgerAccount(
    target,
    context,
    process.env.LEDGER_OPERATOR_ADDRESS,
    process.env.LEDGER_OPERATOR_PRIVATE_KEY,
  );
}

async function executeLedgerCall(
  account: Account,
  call: Call,
  alreadyWrittenSubject: "game" | "preset",
): Promise<LedgerTransactionResult | null> {
  try {
    const transaction = await account.execute(call);
    const receipt = await account.waitForTransaction(transaction.transaction_hash);
    if (!transactionSucceeded(receipt)) {
      throw new Error(`${call.entrypoint} failed for transaction ${transaction.transaction_hash}`);
    }
    return { transactionHash: transaction.transaction_hash, receipt };
  } catch (error) {
    if (isAlreadyWritten(error, alreadyWrittenSubject)) return null;
    throw error;
  }
}

export async function registerLedgerPreset(
  account: Account,
  target: LedgerTarget,
  presetId: number,
  preset: LedgerEconomicPreset,
): Promise<LedgerTransactionResult | null> {
  return executeLedgerCall(
    account,
    {
      contractAddress: target.address,
      entrypoint: "register_preset",
      calldata: buildRegisterLedgerPresetCalldata(presetId, preset),
    },
    "preset",
  );
}

export async function openLedgerGame(
  account: Account,
  target: LedgerTarget,
  gameId: number,
  presetId: number,
  start: number,
  end: number,
): Promise<LedgerTransactionResult | null> {
  return executeLedgerCall(
    account,
    {
      contractAddress: target.address,
      entrypoint: "open_game",
      calldata: CallData.compile([gameId, presetId, start, end]),
    },
    "game",
  );
}
