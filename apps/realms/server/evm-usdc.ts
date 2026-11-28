import { assertAllowedEvmPaymentChain, EVM_PAYMENT_CHAIN_ID } from "@realms-world/chain";

const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const EVM_MIN_CONFIRMATIONS = 12;

export interface EvmLog {
  address: string;
  topics: readonly string[];
  data: string;
}

export interface EvmReceipt {
  status?: string;
  blockNumber?: string;
  logs?: readonly EvmLog[];
}

export type EvmTransferVerification =
  | { status: "pending" }
  | { status: "reverted" }
  | { status: "confirmed"; payer: string; paidUnits: bigint; timestamp: number };

export const normalizeEvmTxHash = (value: unknown): string | null =>
  typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value) ? value.toLowerCase() : null;

export const evmQuoteCalldataSuffix = (quoteId: string): string => {
  const hex = quoteId.replaceAll("-", "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    throw new Error("evm_quote_id_invalid");
  }
  return hex;
};

export function hasMatchingEvmQuoteSuffix(input: string | undefined, quoteId: string): boolean {
  if (typeof input !== "string" || !/^0x[0-9a-fA-F]+$/.test(input)) return false;
  const suffix = evmQuoteCalldataSuffix(quoteId);
  return input.length >= 10 + 128 + suffix.length && input.toLowerCase().endsWith(suffix);
}

export function decodeEvmUsdcTransfers(
  logs: readonly EvmLog[],
  expected: { usdc: string; treasury: string },
): { payer: string; paidUnits: bigint } | null {
  const usdc = expected.usdc.toLowerCase();
  const treasury = expected.treasury.toLowerCase();
  let paidUnits = 0n;
  let payer: string | null = null;
  for (const log of logs) {
    if (log.address.toLowerCase() !== usdc) continue;
    if (log.topics.length < 3 || log.topics[0]!.toLowerCase() !== ERC20_TRANSFER_TOPIC) continue;
    const from = decodeTopicAddress(log.topics[1]!);
    const to = decodeTopicAddress(log.topics[2]!);
    if (!from || !to || to !== treasury) continue;
    const amount = parseHexBigInt(log.data);
    if (amount === null || amount <= 0n) continue;
    paidUnits += amount;
    if (!payer) payer = from;
  }
  return payer && paidUnits > 0n ? { payer, paidUnits } : null;
}

export async function readEvmUsdcTransfer(options: {
  rpcUrl: string;
  chainId: number;
  usdc: string;
  treasury: string;
  quoteId: string;
  txHash: string;
  fetchImpl?: typeof fetch;
}): Promise<EvmTransferVerification> {
  assertAllowedEvmPaymentChain(options.chainId);
  const rpcChainHex = await evmRpcCall<string>(options.rpcUrl, "eth_chainId", [], options.fetchImpl);
  if (parseHexNumber(rpcChainHex) !== EVM_PAYMENT_CHAIN_ID) {
    throw new Error(`evm_rpc_chain_mismatch: expected ${EVM_PAYMENT_CHAIN_ID}`);
  }
  const receipt = await evmRpcCall<EvmReceipt | null>(
    options.rpcUrl,
    "eth_getTransactionReceipt",
    [options.txHash],
    options.fetchImpl,
  );
  if (!receipt || !receipt.blockNumber) return { status: "pending" };
  if (receipt.status === "0x0") return { status: "reverted" };
  if (receipt.status !== "0x1") return { status: "pending" };
  const receiptBlock = parseHexNumber(receipt.blockNumber);
  const latestHex = await evmRpcCall<string>(options.rpcUrl, "eth_blockNumber", [], options.fetchImpl);
  const latestBlock = parseHexNumber(latestHex);
  if (receiptBlock === null || latestBlock === null) throw new Error("evm_rpc_invalid_block_number");
  if (latestBlock - receiptBlock + 1 < EVM_MIN_CONFIRMATIONS) return { status: "pending" };
  const tx = await evmRpcCall<{ input?: string } | null>(
    options.rpcUrl,
    "eth_getTransactionByHash",
    [options.txHash],
    options.fetchImpl,
  );
  if (!tx || !hasMatchingEvmQuoteSuffix(tx.input, options.quoteId)) return { status: "reverted" };
  const transfer = decodeEvmUsdcTransfers(receipt.logs ?? [], {
    usdc: options.usdc,
    treasury: options.treasury,
  });
  if (!transfer) return { status: "reverted" };
  const block = await evmRpcCall<{ timestamp?: string } | null>(
    options.rpcUrl,
    "eth_getBlockByNumber",
    [receipt.blockNumber, false],
    options.fetchImpl,
  );
  const timestamp = parseHexNumber(block?.timestamp);
  if (timestamp === null) throw new Error("evm_rpc_block_missing");
  return { status: "confirmed", payer: transfer.payer, paidUnits: transfer.paidUnits, timestamp };
}

async function evmRpcCall<T>(
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
  if (response.status >= 300 && response.status < 400) throw new Error("evm_rpc_redirect_refused");
  if (!response.ok) throw new Error(`evm_rpc_http_${response.status}`);
  const body = (await response.json()) as { result?: T; error?: { code?: number; message?: string } };
  if (body.error) throw new Error(`evm_rpc_error_${body.error.code ?? "unknown"}`);
  if (body.result === undefined) throw new Error("evm_rpc_empty_result");
  return body.result;
}

const decodeTopicAddress = (topic: string): string | null =>
  /^0x[0-9a-fA-F]{64}$/.test(topic) ? `0x${topic.slice(26).toLowerCase()}` : null;

const parseHexNumber = (value: unknown): number | null => {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 16);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const parseHexBigInt = (value: unknown): bigint | null => {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) return null;
  return BigInt(value);
};
