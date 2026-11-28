const SOLANA_MEMO_PROGRAMS = new Set([
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo",
]);

export interface SolanaTokenBalance {
  accountIndex: number;
  mint: string;
  owner?: string;
  uiTokenAmount?: { amount?: string };
}

export interface SolanaInstruction {
  program?: string;
  programId?: string;
  parsed?: unknown;
}

export interface SolanaTransactionResult {
  blockTime?: number | null;
  meta?: {
    err?: unknown;
    preTokenBalances?: readonly SolanaTokenBalance[];
    postTokenBalances?: readonly SolanaTokenBalance[];
    innerInstructions?: readonly { instructions?: readonly SolanaInstruction[] }[];
  } | null;
  transaction?: {
    message?: {
      accountKeys?: readonly (string | { pubkey: string; signer?: boolean })[];
      instructions?: readonly SolanaInstruction[];
    };
  };
}

export type SolanaTransferVerification =
  | { status: "pending" }
  | { status: "reverted" }
  | { status: "confirmed"; payer: string; paidUnits: bigint; timestamp: number };

export const normalizeSolanaSignature = (value: unknown): string | null =>
  typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(value) ? value : null;

export function verifySolanaUsdcTransaction(
  tx: SolanaTransactionResult,
  expected: { usdc: string; treasury: string; quoteId: string },
): SolanaTransferVerification {
  if (!tx.meta) return { status: "pending" };
  if (tx.meta.err !== null && tx.meta.err !== undefined) return { status: "reverted" };
  if (!hasMatchingMemo(tx, expected.quoteId)) return { status: "reverted" };
  const { received, payer } = computeUsdcDelta(
    tx.meta.preTokenBalances ?? [],
    tx.meta.postTokenBalances ?? [],
    expected.usdc,
    expected.treasury,
  );
  if (received <= 0n) return { status: "reverted" };
  const resolvedPayer = payer ?? firstSigner(tx.transaction?.message?.accountKeys ?? []);
  if (!resolvedPayer) return { status: "reverted" };
  if (typeof tx.blockTime !== "number" || !Number.isSafeInteger(tx.blockTime)) {
    throw new Error("solana_rpc_block_time_missing");
  }
  return { status: "confirmed", payer: resolvedPayer, paidUnits: received, timestamp: tx.blockTime };
}

export async function readSolanaRecentBlockhash(rpcUrl: string, fetchImpl?: typeof fetch): Promise<string> {
  const result = await solanaRpcCall<{ value?: { blockhash?: unknown } }>(
    rpcUrl,
    "getLatestBlockhash",
    [{ commitment: "finalized" }],
    fetchImpl,
  );
  const blockhash = result?.value?.blockhash;
  if (typeof blockhash !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(blockhash)) {
    throw new Error("solana_rpc_blockhash_missing");
  }
  return blockhash;
}

export async function readSolanaUsdcTransfer(options: {
  rpcUrl: string;
  usdc: string;
  treasury: string;
  quoteId: string;
  signature: string;
  fetchImpl?: typeof fetch;
}): Promise<SolanaTransferVerification> {
  const tx = await solanaRpcCall<SolanaTransactionResult | null>(
    options.rpcUrl,
    "getTransaction",
    [options.signature, { encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 0 }],
    options.fetchImpl,
  );
  if (!tx) return { status: "pending" };
  return verifySolanaUsdcTransaction(tx, {
    usdc: options.usdc,
    treasury: options.treasury,
    quoteId: options.quoteId,
  });
}

async function solanaRpcCall<T>(
  rpcUrl: string,
  method: string,
  params: readonly unknown[],
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const response = await fetchImpl(rpcUrl, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (response.status >= 300 && response.status < 400) throw new Error("solana_rpc_redirect_refused");
  if (!response.ok) throw new Error(`solana_rpc_http_${response.status}`);
  const body = (await response.json()) as { result?: T; error?: { code?: number; message?: string } };
  if (body.error) throw new Error(`solana_rpc_error_${body.error.code ?? "unknown"}`);
  if (body.result === undefined) throw new Error("solana_rpc_empty_result");
  return body.result;
}

function hasMatchingMemo(tx: SolanaTransactionResult, quoteId: string): boolean {
  const all: SolanaInstruction[] = [
    ...(tx.transaction?.message?.instructions ?? []),
    ...(tx.meta?.innerInstructions ?? []).flatMap((group) => group.instructions ?? []),
  ];
  for (const instruction of all) {
    const isMemo =
      instruction.program === "spl-memo" ||
      (typeof instruction.programId === "string" && SOLANA_MEMO_PROGRAMS.has(instruction.programId));
    if (!isMemo) continue;
    if (typeof instruction.parsed === "string" && instruction.parsed.trim() === quoteId) return true;
  }
  return false;
}

function computeUsdcDelta(
  pre: readonly SolanaTokenBalance[],
  post: readonly SolanaTokenBalance[],
  usdcMint: string,
  treasuryOwner: string,
): { received: bigint; payer: string | null } {
  const preByIndex = new Map<number, { owner: string | undefined; amount: bigint }>();
  for (const entry of pre) {
    if (entry.mint !== usdcMint) continue;
    preByIndex.set(entry.accountIndex, { owner: entry.owner, amount: parseAmount(entry.uiTokenAmount?.amount) });
  }
  const postByIndex = new Map<number, { owner: string | undefined; amount: bigint }>();
  for (const entry of post) {
    if (entry.mint !== usdcMint) continue;
    postByIndex.set(entry.accountIndex, { owner: entry.owner, amount: parseAmount(entry.uiTokenAmount?.amount) });
  }
  const indices = new Set([...preByIndex.keys(), ...postByIndex.keys()]);
  let received = 0n;
  let payer: string | null = null;
  for (const index of indices) {
    const before = preByIndex.get(index);
    const after = postByIndex.get(index);
    const owner = after?.owner ?? before?.owner;
    const delta = (after?.amount ?? 0n) - (before?.amount ?? 0n);
    if (owner === treasuryOwner && delta > 0n) received += delta;
    if (owner && owner !== treasuryOwner && delta < 0n && !payer) payer = owner;
  }
  return { received, payer };
}

const parseAmount = (value: string | undefined): bigint => (value && /^\d+$/.test(value) ? BigInt(value) : 0n);

const firstSigner = (keys: readonly (string | { pubkey: string; signer?: boolean })[]): string | null => {
  for (const key of keys) {
    if (typeof key === "string") return key;
    if (key.signer) return key.pubkey;
  }
  const first = keys[0];
  return typeof first === "string" ? first : (first?.pubkey ?? null);
};
