import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Account, CallData, uint256, validateAndParseAddress, type Call, type RpcProvider } from "starknet";
import { assertChainId } from "../../../packages/chain/chain-guard.js";
import mainnetAddresses from "../../../contracts/common/addresses/mainnet.json";
import { mapWithConcurrency } from "./account-factory";

export interface LedgerBalanceBaseline {
  owner: string;
  preFundLordsBalance: bigint;
  strkBalance: bigint;
}

export interface LedgerSweepAccount {
  account: Account;
  owner: string;
  preFundLordsBalance: bigint;
}

export interface LedgerSweepManifest {
  accounts: Array<{ owner: string; preFundLordsBalanceBaseUnits: string; strkBalanceBaseUnits: string }>;
  chainId: string;
  createdAt: string;
  estimatedRegisterFeeFri: string;
  gameId: number;
  ledgerAddress: string;
  lordsAddress: string;
  requiredStrkFloorFri: string;
  schemaVersion: 2;
  treasuryAddress: string;
}

export interface LedgerSweepEvidence {
  amount: bigint;
  transactionHashes: string[];
}

export interface LedgerRunConservation {
  dust: bigint;
  poolBeforeFinalization: bigint;
  protocolCut: bigint;
  swept: bigint;
}

interface TokenBalanceProvider {
  callContract(
    call: { calldata: string[]; contractAddress: string; entrypoint: string },
    blockIdentifier: "latest",
  ): Promise<string[]>;
}

const MAINNET_STRK_ADDRESS = validateAndParseAddress(mainnetAddresses.strk);
const MAINNET_RECEIPT_POLL_MS = 1_000;
const REGISTER_AND_SWEEP_FEE_MULTIPLIER_NUMERATOR = 5n;
const REGISTER_AND_SWEEP_FEE_MULTIPLIER_DENOMINATOR = 2n;

export async function estimateLedgerStrkFeeFloor(
  account: Pick<Account, "estimateInvokeFee">,
  registrationCalls: Call[],
): Promise<{ estimatedRegisterFee: bigint; requiredStrkFloor: bigint }> {
  const estimate = await account.estimateInvokeFee(registrationCalls, { version: 3 as const, tip: 0 });
  if (estimate.overall_fee <= 0n) throw new Error("Ledger registration fee estimate must be positive");
  return {
    estimatedRegisterFee: estimate.overall_fee,
    requiredStrkFloor: divideRoundUp(
      estimate.overall_fee * REGISTER_AND_SWEEP_FEE_MULTIPLIER_NUMERATOR,
      REGISTER_AND_SWEEP_FEE_MULTIPLIER_DENOMINATOR,
    ),
  };
}

export async function readLedgerBalanceBaselines(
  provider: TokenBalanceProvider,
  lordsAddress: string,
  owners: readonly string[],
  requiredStrkFloor: bigint,
  concurrency: number,
): Promise<LedgerBalanceBaseline[]> {
  return mapWithConcurrency(owners, concurrency, async (owner) => {
    const [preFundLordsBalance, strkBalance] = await Promise.all([
      readTokenBalance(provider, lordsAddress, owner),
      readTokenBalance(provider, MAINNET_STRK_ADDRESS, owner),
    ]);
    if (strkBalance < requiredStrkFloor) {
      throw new Error(
        `Owner ${owner} needs at least ${requiredStrkFloor} STRK fri for registration and sweep gas; balance is ${strkBalance}`,
      );
    }
    return { owner, preFundLordsBalance, strkBalance };
  });
}

export async function writeLedgerSweepManifest(
  outputPath: string,
  input: Omit<LedgerSweepManifest, "accounts" | "createdAt" | "schemaVersion"> & {
    accounts: readonly LedgerBalanceBaseline[];
  },
): Promise<LedgerSweepManifest> {
  const manifest: LedgerSweepManifest = {
    schemaVersion: 2,
    createdAt: new Date().toISOString(),
    accounts: input.accounts.map(({ owner, preFundLordsBalance, strkBalance }) => ({
      owner,
      preFundLordsBalanceBaseUnits: preFundLordsBalance.toString(),
      strkBalanceBaseUnits: strkBalance.toString(),
    })),
    chainId: input.chainId,
    gameId: input.gameId,
    estimatedRegisterFeeFri: input.estimatedRegisterFeeFri,
    ledgerAddress: input.ledgerAddress,
    lordsAddress: input.lordsAddress,
    requiredStrkFloorFri: input.requiredStrkFloorFri,
    treasuryAddress: input.treasuryAddress,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" });
  return manifest;
}

export async function readLedgerSweepManifest(filePath: string): Promise<LedgerSweepManifest> {
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Ledger sweep manifest must be a JSON object");
  }
  const record = parsed as Record<string, unknown>;
  if (record.schemaVersion !== 2) throw new Error("Ledger sweep manifest schemaVersion must be 2");
  if (typeof record.createdAt !== "string") throw new Error("Ledger sweep manifest createdAt must be a string");
  const accounts = parseSweepManifestAccounts(record.accounts);
  const chainId = parseNonZeroFelt(record.chainId, "chainId");
  assertChainId(chainId, "mainnet", "Ledger sweep manifest");
  return {
    accounts,
    chainId,
    createdAt: record.createdAt,
    estimatedRegisterFeeFri: parseUnsignedInteger(record.estimatedRegisterFeeFri, "estimatedRegisterFeeFri"),
    gameId: parsePositiveInteger(record.gameId, "gameId"),
    ledgerAddress: parseNonZeroFelt(record.ledgerAddress, "ledgerAddress"),
    lordsAddress: parseNonZeroFelt(record.lordsAddress, "lordsAddress"),
    requiredStrkFloorFri: parseUnsignedInteger(record.requiredStrkFloorFri, "requiredStrkFloorFri"),
    schemaVersion: 2,
    treasuryAddress: parseNonZeroFelt(record.treasuryAddress, "treasuryAddress"),
  };
}

export async function sweepLedgerBalances(
  provider: RpcProvider,
  accounts: readonly LedgerSweepAccount[],
  lordsAddress: string,
  concurrency: number,
  treasuryAddress: string,
): Promise<LedgerSweepEvidence> {
  const plan = await buildLedgerSweepPlan(provider, lordsAddress, accounts, concurrency);
  const transactionHashes = await mapWithConcurrency(
    plan.entries.filter(({ amount }) => amount > 0n),
    concurrency,
    ({ account, amount, owner }) =>
      executeMainnetAndWait(
        account,
        {
          contractAddress: lordsAddress,
          entrypoint: "transfer",
          calldata: CallData.compile([treasuryAddress, uint256.bnToUint256(amount)]),
        },
        `return ledger balance from ${owner}`,
      ),
  );
  return { amount: plan.amount, transactionHashes };
}

export async function buildLedgerSweepPlan(
  provider: TokenBalanceProvider,
  lordsAddress: string,
  accounts: readonly LedgerSweepAccount[],
  concurrency: number,
): Promise<{ amount: bigint; entries: Array<LedgerSweepAccount & { amount: bigint }> }> {
  const entries = await mapWithConcurrency(accounts, concurrency, async (account) => {
    const balance = await readTokenBalance(provider, lordsAddress, account.owner);
    if (balance < account.preFundLordsBalance) {
      throw new Error(
        `Owner ${account.owner} LORDS balance fell below its pre-fund baseline: ${balance} < ${account.preFundLordsBalance}`,
      );
    }
    return { ...account, amount: balance - account.preFundLordsBalance };
  });
  return { amount: entries.reduce((total, entry) => total + entry.amount, 0n), entries };
}

export function assertLedgerRunConservation(input: LedgerRunConservation): bigint {
  const returned = input.protocolCut + input.dust + input.swept;
  if (returned !== input.poolBeforeFinalization) {
    throw new Error(
      `Ledger harness conservation failed: pre-finalize pool ${input.poolBeforeFinalization}, accounted ${returned}`,
    );
  }
  return returned;
}

export async function recordLedgerSweepAndAssertConservation(
  manifestPath: string,
  evidence: LedgerSweepEvidence,
  conservation: LedgerRunConservation,
): Promise<{ returned: bigint; sweepReceiptPath: string }> {
  const sweepReceiptPath = await writeLedgerSweepReceipt(manifestPath, evidence);
  return {
    returned: assertLedgerRunConservation(conservation),
    sweepReceiptPath,
  };
}

export async function writeLedgerSweepReceipt(
  manifestPath: string,
  evidence: LedgerSweepEvidence,
): Promise<string> {
  const createdAt = new Date().toISOString();
  const receiptPath = `${manifestPath}.receipt-${createdAt.replace(/[-:.]/g, "")}.json`;
  await writeFile(
    receiptPath,
    `${JSON.stringify(
      {
        amountBaseUnits: evidence.amount.toString(),
        createdAt,
        sourceManifest: manifestPath,
        transactionHashes: evidence.transactionHashes,
      },
      null,
      2,
    )}\n`,
    { flag: "wx" },
  );
  return receiptPath;
}

export async function executeMainnetAndWait(account: Account, calls: Call | Call[], label: string): Promise<string> {
  const transaction = await account.execute(calls, { version: 3 as const, tip: 0 });
  const receipt = await account.waitForTransaction(transaction.transaction_hash, {
    retryInterval: MAINNET_RECEIPT_POLL_MS,
  });
  const status = receipt as { execution_status?: string; isSuccess?: () => boolean };
  const succeeded = typeof status.isSuccess === "function" ? status.isSuccess() : status.execution_status === "SUCCEEDED";
  if (!succeeded) throw new Error(`${label} failed for transaction ${transaction.transaction_hash}`);
  return transaction.transaction_hash;
}

export async function readTokenBalance(
  provider: TokenBalanceProvider,
  token: string,
  owner: string,
): Promise<bigint> {
  const result = await provider.callContract(
    { contractAddress: token, entrypoint: "balance_of", calldata: [owner] },
    "latest",
  );
  return uint256.uint256ToBN({ low: result[0] ?? "0", high: result[1] ?? "0" });
}

function parseSweepManifestAccounts(value: unknown): LedgerSweepManifest["accounts"] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Ledger sweep manifest accounts must be a non-empty array");
  }
  const accounts = value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Ledger sweep manifest account ${index} must be an object`);
    }
    const record = entry as Record<string, unknown>;
    return {
      owner: parseNonZeroFelt(record.owner, `accounts[${index}].owner`),
      preFundLordsBalanceBaseUnits: parseUnsignedInteger(
        record.preFundLordsBalanceBaseUnits,
        `accounts[${index}].preFundLordsBalanceBaseUnits`,
      ),
      strkBalanceBaseUnits: parseUnsignedInteger(
        record.strkBalanceBaseUnits,
        `accounts[${index}].strkBalanceBaseUnits`,
      ),
    };
  });
  if (new Set(accounts.map(({ owner }) => BigInt(owner).toString())).size !== accounts.length) {
    throw new Error("Ledger sweep manifest contains duplicate owners");
  }
  return accounts;
}

function parseNonZeroFelt(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`Ledger sweep manifest ${label} must be a felt`);
  try {
    if (BigInt(value) === 0n) throw new Error("zero");
    return validateAndParseAddress(value);
  } catch {
    throw new Error(`Ledger sweep manifest ${label} must be a non-zero felt`);
  }
}

function parseUnsignedInteger(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`Ledger sweep manifest ${label} must be an integer string`);
  try {
    if (BigInt(value) < 0n) throw new Error("negative");
    return BigInt(value).toString();
  } catch {
    throw new Error(`Ledger sweep manifest ${label} must be an unsigned integer string`);
  }
}

function parsePositiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Ledger sweep manifest ${label} must be a positive integer`);
  }
  return value;
}

function divideRoundUp(value: bigint, divisor: bigint): bigint {
  return (value + divisor - 1n) / divisor;
}
