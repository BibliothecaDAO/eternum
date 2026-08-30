import { Account, CallData, RpcProvider, uint256, type Call } from "starknet";
import { resolveAccountCredentials } from "../shared/credentials";
import type { LedgerEconomicPreset } from "./economics";
import { buildRegisterLedgerPresetCalldata, resolveLedgerFundingAmount } from "./economics";

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

export function createLedgerTreasuryAccount(target: LedgerTarget, context: string): Account {
  return createLedgerAccount(
    target,
    context,
    process.env.LEDGER_TREASURY_ADDRESS,
    process.env.LEDGER_TREASURY_PRIVATE_KEY,
  );
}

async function executeAndWait(account: Account, calls: Call | Call[], label: string): Promise<LedgerTransactionResult> {
  const transaction = await account.execute(calls);
  const receipt = await account.waitForTransaction(transaction.transaction_hash);
  if (!transactionSucceeded(receipt)) {
    throw new Error(`${label} failed for transaction ${transaction.transaction_hash}`);
  }
  return { transactionHash: transaction.transaction_hash, receipt };
}

async function executeLedgerCall(
  account: Account,
  call: Call,
  alreadyWrittenSubject: "game" | "preset",
): Promise<LedgerTransactionResult | null> {
  try {
    return await executeAndWait(account, call, call.entrypoint);
  } catch (error) {
    if (isAlreadyWritten(error, alreadyWrittenSubject)) return null;
    throw error;
  }
}

async function readLedgerGamePool(target: LedgerTarget, gameId: number): Promise<bigint> {
  const result = await new RpcProvider({ nodeUrl: target.rpcUrl }).callContract(
    {
      contractAddress: target.address,
      entrypoint: "get_game",
      calldata: CallData.compile([gameId]),
    },
    "latest",
  );
  if (BigInt(result[0] ?? 0) === 0n) {
    throw new Error(`Ledger game ${gameId} does not exist`);
  }
  return uint256.uint256ToBN({ low: result[4] ?? "0", high: result[5] ?? "0" });
}

export async function fundLedgerGameToTargetPool(
  account: Account,
  target: LedgerTarget,
  lordsAddress: string,
  gameId: number,
  targetPool: bigint,
): Promise<LedgerTransactionResult | null> {
  const amount = resolveLedgerFundingAmount(await readLedgerGamePool(target, gameId), targetPool);
  if (amount === 0n) return null;

  return executeAndWait(
    account,
    [
      {
        contractAddress: lordsAddress,
        entrypoint: "approve",
        calldata: CallData.compile([target.address, uint256.bnToUint256(amount)]),
      },
      {
        contractAddress: target.address,
        entrypoint: "fund",
        calldata: CallData.compile([gameId, uint256.bnToUint256(amount)]),
      },
    ],
    `fund ledger game ${gameId}`,
  );
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
