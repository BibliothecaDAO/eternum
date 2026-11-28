import { describe, expect, it } from "vitest";
import { solanaPaymentRail } from "@realms-world/chain";

import {
  normalizeSolanaSignature,
  readSolanaRecentBlockhash,
  readSolanaUsdcTransfer,
  verifySolanaUsdcTransaction,
  type SolanaTransactionResult,
} from "./solana-usdc";

const RAIL = solanaPaymentRail("production");
const PAYER = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const SIGNATURE = "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";
const QUOTE_ID = "quote-sol-1";

const buildSolanaTx = (overrides: Partial<SolanaTransactionResult> = {}): SolanaTransactionResult => ({
  blockTime: 1_234,
  meta: {
    err: null,
    preTokenBalances: [
      { accountIndex: 1, mint: RAIL.usdc, owner: PAYER, uiTokenAmount: { amount: "20000000" } },
      { accountIndex: 2, mint: RAIL.usdc, owner: RAIL.treasury, uiTokenAmount: { amount: "1000000" } },
    ],
    postTokenBalances: [
      { accountIndex: 1, mint: RAIL.usdc, owner: PAYER, uiTokenAmount: { amount: "10000000" } },
      { accountIndex: 2, mint: RAIL.usdc, owner: RAIL.treasury, uiTokenAmount: { amount: "11000000" } },
    ],
  },
  transaction: {
    message: {
      accountKeys: [{ pubkey: PAYER, signer: true }],
      instructions: [
        {
          program: "spl-memo",
          programId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
          parsed: QUOTE_ID,
        },
      ],
    },
  },
  ...overrides,
});

describe("Solana mainnet USDC verification", () => {
  it("validates base58 Solana signatures", () => {
    expect(normalizeSolanaSignature(SIGNATURE)).toBe(SIGNATURE);
    expect(normalizeSolanaSignature("0x1234")).toBeNull();
    expect(normalizeSolanaSignature("short")).toBeNull();
  });

  it("confirms finalized SPL USDC transfer to treasury owner with exact quoteId memo", () => {
    expect(
      verifySolanaUsdcTransaction(buildSolanaTx(), {
        usdc: RAIL.usdc,
        treasury: RAIL.treasury,
        quoteId: QUOTE_ID,
      }),
    ).toEqual({
      status: "confirmed",
      payer: PAYER,
      paidUnits: 10_000_000n,
      timestamp: 1_234,
    });
  });

  it("refuses transactions with missing memo, wrong memo, wrong mint, or execution error", () => {
    expect(
      verifySolanaUsdcTransaction(buildSolanaTx(), {
        usdc: RAIL.usdc,
        treasury: RAIL.treasury,
        quoteId: "other-quote",
      }),
    ).toEqual({ status: "reverted" });

    expect(
      verifySolanaUsdcTransaction(
        buildSolanaTx({
          meta: {
            err: { InstructionError: [0, "Custom"] },
            preTokenBalances: [],
            postTokenBalances: [],
          },
        }),
        { usdc: RAIL.usdc, treasury: RAIL.treasury, quoteId: QUOTE_ID },
      ),
    ).toEqual({ status: "reverted" });

    expect(
      verifySolanaUsdcTransaction(
        buildSolanaTx({
          meta: {
            err: null,
            preTokenBalances: [],
            postTokenBalances: [
              {
                accountIndex: 2,
                mint: "FakeMint11111111111111111111111111111111111",
                owner: RAIL.treasury,
                uiTokenAmount: { amount: "10000000" },
              },
            ],
          },
        }),
        { usdc: RAIL.usdc, treasury: RAIL.treasury, quoteId: QUOTE_ID },
      ),
    ).toEqual({ status: "reverted" });
  });

  it("queries finalized commitment with redirect manual and refuses redirects and non-2xx responses", async () => {
    const finalizedFetch: typeof fetch = async (_input, init) => {
      expect(init?.redirect).toBe("manual");
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };
      expect(body.method).toBe("getTransaction");
      expect(body.params[1]).toMatchObject({ encoding: "jsonParsed", commitment: "finalized" });
      return Response.json({ jsonrpc: "2.0", id: 1, result: null });
    };
    expect(
      await readSolanaUsdcTransfer({
        rpcUrl: "https://sol.example",
        usdc: RAIL.usdc,
        treasury: RAIL.treasury,
        quoteId: QUOTE_ID,
        signature: SIGNATURE,
        fetchImpl: finalizedFetch,
      }),
    ).toEqual({ status: "pending" });

    const redirectFetch: typeof fetch = async () =>
      new Response(null, { status: 307, headers: { location: "https://evil.example" } });
    await expect(
      readSolanaUsdcTransfer({
        rpcUrl: "https://sol.example",
        usdc: RAIL.usdc,
        treasury: RAIL.treasury,
        quoteId: QUOTE_ID,
        signature: SIGNATURE,
        fetchImpl: redirectFetch,
      }),
    ).rejects.toThrow("solana_rpc_redirect_refused");

    const failingFetch: typeof fetch = async () => new Response("bad", { status: 503 });
    await expect(
      readSolanaUsdcTransfer({
        rpcUrl: "https://sol.example",
        usdc: RAIL.usdc,
        treasury: RAIL.treasury,
        quoteId: QUOTE_ID,
        signature: SIGNATURE,
        fetchImpl: failingFetch,
      }),
    ).rejects.toThrow("solana_rpc_http_503");

    const blockhash = "4vJ9JU1bJJE96FWSJKvHsmmFADCg4gpZQff4P3bkLKi";
    const blockhashFetch: typeof fetch = async (_input, init) => {
      expect(init?.redirect).toBe("manual");
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] };
      expect(body.method).toBe("getLatestBlockhash");
      expect(body.params).toEqual([{ commitment: "finalized" }]);
      return Response.json({ jsonrpc: "2.0", id: 1, result: { value: { blockhash } } });
    };
    await expect(readSolanaRecentBlockhash("https://sol.example", blockhashFetch)).resolves.toBe(blockhash);
    await expect(readSolanaRecentBlockhash("https://sol.example", redirectFetch)).rejects.toThrow(
      "solana_rpc_redirect_refused",
    );
  });
});
