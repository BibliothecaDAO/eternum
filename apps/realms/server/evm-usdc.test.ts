import { describe, expect, it, vi } from "vitest";
import { EVM_PAYMENT_CHAIN_ID, evmPaymentRail } from "@realms-world/chain";

import {
  decodeEvmUsdcTransfers,
  EVM_MIN_CONFIRMATIONS,
  evmQuoteCalldataSuffix,
  hasMatchingEvmQuoteSuffix,
  normalizeEvmTxHash,
  readEvmUsdcTransfer,
} from "./evm-usdc";

const RAIL = evmPaymentRail("production");
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const PAYER = "0x1111111111111111111111111111111111111111";
const TX_HASH = `0x${"ab".repeat(32)}`;
const QUOTE_ID = "11111111-2222-4333-8444-555555555555";
const OTHER_QUOTE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const topicAddress = (address: string) => `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
const hexAmount = (units: bigint) => `0x${units.toString(16).padStart(64, "0")}`;
const transferCalldata = (recipient: string, units: bigint, quoteId?: string) =>
  `0xa9059cbb${recipient.slice(2).toLowerCase().padStart(64, "0")}${units.toString(16).padStart(64, "0")}${
    quoteId ? evmQuoteCalldataSuffix(quoteId) : ""
  }`;

describe("EVM mainnet USDC verification", () => {
  it("normalizes 32-byte hex transaction hashes and rejects invalid ones", () => {
    expect(normalizeEvmTxHash(`0x${"AB".repeat(32)}`)).toBe(TX_HASH);
    expect(normalizeEvmTxHash("0x1234")).toBeNull();
    expect(normalizeEvmTxHash("not-a-hash")).toBeNull();
  });

  it("decodes Circle USDC Transfer logs to the configured Ethereum mainnet treasury only", () => {
    const logs = [
      {
        address: RAIL.usdc,
        topics: [TRANSFER_TOPIC, topicAddress(PAYER), topicAddress(RAIL.treasury)],
        data: hexAmount(10_000_000n),
      },
      {
        address: "0x0000000000000000000000000000000000000001",
        topics: [TRANSFER_TOPIC, topicAddress(PAYER), topicAddress(RAIL.treasury)],
        data: hexAmount(99_000_000n),
      },
      {
        address: RAIL.usdc,
        topics: [TRANSFER_TOPIC, topicAddress(PAYER), topicAddress("0x2222222222222222222222222222222222222222")],
        data: hexAmount(50_000_000n),
      },
    ];
    expect(decodeEvmUsdcTransfers(logs, RAIL)).toEqual({ payer: PAYER, paidUnits: 10_000_000n });
  });

  it("strictly refuses Base (8453), Arbitrum (42161), and any chainId other than Ethereum mainnet (1)", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    for (const chainId of [8453, 42161, 10, 11155111]) {
      await expect(
        readEvmUsdcTransfer({
          rpcUrl: "https://eth.example",
          chainId,
          usdc: RAIL.usdc,
          treasury: RAIL.treasury,
          quoteId: QUOTE_ID,
          txHash: TX_HASH,
          fetchImpl: fetchMock,
        }),
      ).rejects.toThrow(`Unsupported EVM payment chainId ${chainId}`);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses an RPC that reports a non-mainnet chainId, redirects, or non-2xx HTTP responses", async () => {
    const baseRpc: typeof fetch = async () => Response.json({ jsonrpc: "2.0", id: 1, result: "0x2105" });
    await expect(
      readEvmUsdcTransfer({
        rpcUrl: "https://eth.example",
        chainId: EVM_PAYMENT_CHAIN_ID,
        usdc: RAIL.usdc,
        treasury: RAIL.treasury,
        quoteId: QUOTE_ID,
        txHash: TX_HASH,
        fetchImpl: baseRpc,
      }),
    ).rejects.toThrow("evm_rpc_chain_mismatch");

    const redirectRpc: typeof fetch = async (_input, init) => {
      expect(init?.redirect).toBe("manual");
      return new Response(null, { status: 302, headers: { location: "https://evil.example" } });
    };
    await expect(
      readEvmUsdcTransfer({
        rpcUrl: "https://eth.example",
        chainId: EVM_PAYMENT_CHAIN_ID,
        usdc: RAIL.usdc,
        treasury: RAIL.treasury,
        quoteId: QUOTE_ID,
        txHash: TX_HASH,
        fetchImpl: redirectRpc,
      }),
    ).rejects.toThrow("evm_rpc_redirect_refused");

    const failingRpc: typeof fetch = async () => new Response("error", { status: 502 });
    await expect(
      readEvmUsdcTransfer({
        rpcUrl: "https://eth.example",
        chainId: EVM_PAYMENT_CHAIN_ID,
        usdc: RAIL.usdc,
        treasury: RAIL.treasury,
        quoteId: QUOTE_ID,
        txHash: TX_HASH,
        fetchImpl: failingRpc,
      }),
    ).rejects.toThrow("evm_rpc_http_502");
  });

  it("binds every EVM USDC transfer to the quote calldata suffix, refusing unquoted or another player's transfers", async () => {
    expect(hasMatchingEvmQuoteSuffix(transferCalldata(RAIL.treasury, 5_000_000n, QUOTE_ID), QUOTE_ID)).toBe(true);
    expect(hasMatchingEvmQuoteSuffix(transferCalldata(RAIL.treasury, 5_000_000n), QUOTE_ID)).toBe(false);
    expect(hasMatchingEvmQuoteSuffix(transferCalldata(RAIL.treasury, 5_000_000n, OTHER_QUOTE_ID), QUOTE_ID)).toBe(
      false,
    );

    const makeRpc =
      (
        latestBlock: number,
        status = "0x1",
        txInput = transferCalldata(RAIL.treasury, 5_000_000n, QUOTE_ID),
      ): typeof fetch =>
      async (_input, init) => {
        expect(init?.redirect).toBe("manual");
        const { method } = JSON.parse(String(init?.body)) as { method: string };
        if (method === "eth_chainId") return Response.json({ jsonrpc: "2.0", id: 1, result: "0x1" });
        if (method === "eth_getTransactionReceipt") {
          return Response.json({
            jsonrpc: "2.0",
            id: 1,
            result: {
              status,
              blockNumber: "0x64",
              logs: [
                {
                  address: RAIL.usdc,
                  topics: [TRANSFER_TOPIC, topicAddress(PAYER), topicAddress(RAIL.treasury)],
                  data: hexAmount(5_000_000n),
                },
              ],
            },
          });
        }
        if (method === "eth_blockNumber") {
          return Response.json({ jsonrpc: "2.0", id: 1, result: `0x${latestBlock.toString(16)}` });
        }
        if (method === "eth_getTransactionByHash") {
          return Response.json({ jsonrpc: "2.0", id: 1, result: { input: txInput } });
        }
        if (method === "eth_getBlockByNumber") {
          return Response.json({ jsonrpc: "2.0", id: 1, result: { timestamp: "0x3e8" } });
        }
        throw new Error(`unexpected ${method}`);
      };

    expect(
      await readEvmUsdcTransfer({
        rpcUrl: "https://eth.example",
        chainId: EVM_PAYMENT_CHAIN_ID,
        usdc: RAIL.usdc,
        treasury: RAIL.treasury,
        quoteId: QUOTE_ID,
        txHash: TX_HASH,
        fetchImpl: makeRpc(100 + EVM_MIN_CONFIRMATIONS - 2),
      }),
    ).toEqual({ status: "pending" });

    expect(
      await readEvmUsdcTransfer({
        rpcUrl: "https://eth.example",
        chainId: EVM_PAYMENT_CHAIN_ID,
        usdc: RAIL.usdc,
        treasury: RAIL.treasury,
        quoteId: QUOTE_ID,
        txHash: TX_HASH,
        fetchImpl: makeRpc(100 + EVM_MIN_CONFIRMATIONS, "0x0"),
      }),
    ).toEqual({ status: "reverted" });

    expect(
      await readEvmUsdcTransfer({
        rpcUrl: "https://eth.example",
        chainId: EVM_PAYMENT_CHAIN_ID,
        usdc: RAIL.usdc,
        treasury: RAIL.treasury,
        quoteId: QUOTE_ID,
        txHash: TX_HASH,
        fetchImpl: makeRpc(100 + EVM_MIN_CONFIRMATIONS, "0x1", transferCalldata(RAIL.treasury, 5_000_000n)),
      }),
    ).toEqual({ status: "reverted" });

    expect(
      await readEvmUsdcTransfer({
        rpcUrl: "https://eth.example",
        chainId: EVM_PAYMENT_CHAIN_ID,
        usdc: RAIL.usdc,
        treasury: RAIL.treasury,
        quoteId: QUOTE_ID,
        txHash: TX_HASH,
        fetchImpl: makeRpc(
          100 + EVM_MIN_CONFIRMATIONS,
          "0x1",
          transferCalldata(RAIL.treasury, 5_000_000n, OTHER_QUOTE_ID),
        ),
      }),
    ).toEqual({ status: "reverted" });

    expect(
      await readEvmUsdcTransfer({
        rpcUrl: "https://eth.example",
        chainId: EVM_PAYMENT_CHAIN_ID,
        usdc: RAIL.usdc,
        treasury: RAIL.treasury,
        quoteId: QUOTE_ID,
        txHash: TX_HASH,
        fetchImpl: makeRpc(100 + EVM_MIN_CONFIRMATIONS - 1),
      }),
    ).toEqual({ status: "confirmed", payer: PAYER, paidUnits: 5_000_000n, timestamp: 1_000 });
  });
});
