import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Account, CallData, constants, uint256, validateAndParseAddress, type Call, type RpcProvider } from "starknet";
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
  gameId: number;
  ledgerAddress: string;
  lordsAddress: string;
  schemaVersion: 1;
  treasuryAddress: string;
}

export interface LedgerSweepEvidence {
  amount: bigint;
  transactionHashes: string[];
}

interface TokenBalanceProvider {
  callContract(
    call: { calldata: string[]; contractAddress: string; entrypoint: string },
    blockIdentifier: "latest",
  ): Promise<string[]>;
}

const MAINNET_STRK_ADDRESS = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const MAINNET_RECEIPT_POLL_MS = 1_000;

export async function readLedgerBalanceBaselines(
  provider: TokenBalanceProvider,
  lordsAddress: string,
  owners: readonly string[],
  concurrency: number,
): Promise<LedgerBalanceBaseline[]> {
  return mapWithConcurrency(owners, concurrency, async (owner) => {
    const [preFundLordsBalance, strkBalance] = await Promise.all([
      readTokenBalance(provider, lordsAddress, owner),
      readTokenBalance(provider, MAINNET_STRK_ADDRESS, owner),
    ]);
    if (strkBalance === 0n) {
      throw new Error(`Owner ${owner} has no STRK for mainnet registration and sweep gas`);
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
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    accounts: input.accounts.map(({ owner, preFundLordsBalance, strkBalance }) => ({
      owner,
      preFundLordsBalanceBaseUnits: preFundLordsBalance.toString(),
      strkBalanceBaseUnits: strkBalance.toString(),
    })),
    chainId: input.chainId,
    gameId: input.gameId,
    ledgerAddress: input.ledgerAddress,
    lordsAddress: input.lordsAddress,
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
  if (record.schemaVersion !== 1) throw new Error("Ledger sweep manifest schemaVersion must be 1");
  if (typeof record.createdAt !== "string") throw new Error("Ledger sweep manifest createdAt must be a string");
  const accounts = parseSweepManifestAccounts(record.accounts);
  const chainId = parseNonZeroFelt(record.chainId, "chainId");
  if (BigInt(chainId) !== BigInt(constants.StarknetChainId.SN_MAIN)) {
    throw new Error(`Ledger sweep manifest is not for Starknet mainnet: ${chainId}`);
  }
  return {
    accounts,
    chainId,
    createdAt: record.createdAt,
    gameId: parsePositiveInteger(record.gameId, "gameId"),
    ledgerAddress: parseNonZeroFelt(record.ledgerAddress, "ledgerAddress"),
    lordsAddress: parseNonZeroFelt(record.lordsAddress, "lordsAddress"),
    schemaVersion: 1,
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

export function assertLedgerRunConservation(input: {
  dust: bigint;
  funded: bigint;
  protocolCut: bigint;
  swept: bigint;
}): bigint {
  const returned = input.protocolCut + input.dust + input.swept;
  if (returned !== input.funded) {
    throw new Error(`Ledger harness conservation failed: funded ${input.funded}, returned ${returned}`);
  }
  return returned;
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
