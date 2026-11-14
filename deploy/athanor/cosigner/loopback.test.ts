import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ec, hash } from "starknet";
import { cosigningHash, type PayoutTerms, type SettlementTerms } from "../../../packages/value-ledger/src/cosigning";
import { gamesAbi, gamesEventAbi, withdrawalEvent } from "../../../packages/value-ledger/test-support/abi";
import { createCosigner, handleCosignRequest, type CosignerConfig } from "../../../apps/value-relay/src/cosigner";
import { openCosignerWallets } from "./wallets";

const key = "0x12345";
const amount = String(17n * 10n ** 18n);
const payment: PayoutTerms = {
  kind: "pay",
  shard: "0x2",
  season: 7,
  claim: "0xabc",
  wallet: "0x123",
  amount,
  rank: 0,
  count: 0,
};
const settlement: SettlementTerms = {
  kind: "settle",
  shard: "0x2",
  season: 7,
  chest: amount,
  prize: "0",
  treasuryAmount: String(83n * 10n ** 18n),
};
const header = {
  block_number: 10,
  block_hash: "0xa",
  parent_hash: "0x9",
  timestamp: 1000,
  status: "ACCEPTED_ON_L2",
  transactions: [],
};

function snapshot(pool: number, models: string[]) {
  const rows: Record<string, Record<string, unknown>[]> = {
    GameRegistry: [{ preset_id: 6, start_main_at: 10, scheduled_end_at: 110, end_at: 110, seed: "0x99" }],
    ChestRules: [{ pool_bps: 7000, top_n: 10, claim_window_seconds: 604800 }],
    SliceRules: [{ day_unit_seconds: 5 }],
    LordsBudget: [{ pool: String(pool), pool_left: String(pool - 17) }],
    FrontierPrize: [{ pool: "0", issued: "0", count: 0 }],
    ResourceBalance: [],
    LordsWithdrawal: [{ claim_id: "0xabc", account: "0x456", amount: "17", prize_rank: 0, prize_count: 0 }],
  };
  return {
    game_id: "7",
    confirmed_block: 10,
    models: models.map((model) => ({
      model,
      rows: rows[model]!.map((value) => ({ key: "7", value: { game_id: 7, ...value } })),
    })),
  };
}

function ledgerCall(selector: string) {
  const answers: Record<string, string[]> = {
    cosigner: [ec.starkCurve.getStarkKey(key), "2"],
    is_paused: ["0"],
    get_payment: ["0", "7", "0", amount, "0", "0", "0", "1000"],
    get_frontier: ["1", "10", "110", String(100n * 10n ** 18n), "0", amount, "0", "0", "6", "0x99", "0", "0", "0", "0"],
    get_preset: [...Array<string>(16).fill("0"), "5", "604800", "10", "7000"],
  };
  const name = Object.keys(answers).find((name) => BigInt(hash.getSelectorFromName(name)) === BigInt(selector));
  if (!name) throw new Error(`unexpected_ledger_selector:${selector}`);
  return answers[name];
}
function rpcAnswer(ledger: boolean, method: string, params: { request?: { entry_point_selector: string } }) {
  switch (method) {
    case "starknet_specVersion":
      return "0.9.0";
    case "starknet_chainId":
      return ledger ? "0x1" : "0x2";
    case "starknet_getBlockWithTxHashes":
      return header;
    case "starknet_getClassHashAt":
      return "0x9137";
    case "starknet_getClass":
      return { abi: [...gamesAbi, ...gamesEventAbi] };
    case "starknet_getTransactionReceipt":
      return {
        transaction_hash: "0xabc",
        block_number: 10,
        block_hash: "0xa",
        execution_status: "SUCCEEDED",
        finality_status: "ACCEPTED_ON_L2",
        events: [{ from_address: "0x20", ...withdrawalEvent(7, "0xabc", "0x456", 17) }],
      };
    case "starknet_call":
      if (ledger) return ledgerCall(params.request!.entry_point_selector);
      if (BigInt(params.request!.entry_point_selector) === BigInt(hash.getSelectorFromName("current_release")))
        return ["0"];
  }
  throw new Error(`unexpected_rpc:${method}`);
}

for (const hostname of ["127.0.0.1", "::1"]) {
  test(`co-signs payment and settlement through actual HTTP RPC and Herald on ${hostname}`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "cosigner-loopback-"));
    const wallets = openCosignerWallets(join(directory, "wallets.sqlite"), () => 1000);
    const requests: string[] = [];
    let pool = 100,
      redirect = 0,
      targetReads = 0,
      wallet = "0x123";
    let config: CosignerConfig;
    let signer: ReturnType<typeof createCosigner>;
    const server = Bun.serve({
      hostname,
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);
        requests.push(url.pathname);
        if (["/sign", "/health"].includes(url.pathname)) return handleCosignRequest(request, config, signer);
        if (url.pathname === "/api/operator/payout-identity") {
          expect(BigInt(url.searchParams.get("account")!)).toBe(0x456n);
          expect(request.headers.get("authorization")).toBe("Bearer identity-token");
          return Response.json({ identity: { realmsId: "0x1", wallet } });
        }
        if (url.pathname === "/redirect-target") {
          targetReads++;
          return Response.json({});
        }
        if (url.pathname === "/games/7/snapshot") {
          if (redirect)
            return new Response(null, {
              status: redirect,
              headers: { location: new URL("/redirect-target", url).href },
            });
          return Response.json(snapshot(pool, url.searchParams.get("models")!.split(",")));
        }
        if (["/l2", "/rpc"].includes(url.pathname)) {
          const { id, method, params } = await request.json();
          return Response.json({ jsonrpc: "2.0", id, result: rpcAnswer(url.pathname === "/l2", method, params) });
        }
        return new Response(null, { status: 404 });
      },
    });
    const origin = `http://${hostname.includes(":") ? `[${hostname}]` : hostname}:${server.port}`;
    config = {
      l2RpcUrl: `${origin}/l2`,
      l2ChainId: "0x1",
      ledgerAddress: "0x10",
      identityUrl: origin,
      identityToken: "identity-token",
      requestToken: "request-token",
      shards: [{ chainId: "0x2", gamesAddress: "0x20", firstRelease: 1, rpcUrl: `${origin}/rpc`, heraldUrl: origin }],
    };
    const send = (terms: PayoutTerms | SettlementTerms) =>
      fetch(`${origin}/sign`, {
        method: "POST",
        headers: { authorization: "Bearer request-token" },
        body: JSON.stringify(terms),
      });
    try {
      signer = createCosigner(config, key, wallets);
      for (const terms of [payment, settlement]) {
        requests.length = 0;
        const response = await send(terms);
        expect(response.status).toBe(200);
        const signature = await response.json();
        expect(
          ec.starkCurve.verify(
            new ec.starkCurve.Signature(BigInt(signature.r), BigInt(signature.s)),
            cosigningHash({ chainId: "0x1", ledger: "0x10", epoch: 2 }, terms),
            ec.starkCurve.getPublicKey(key),
          ),
        ).toBe(true);
        expect(requests).toContain("/games/7/snapshot");
        expect(requests).toContain("/rpc");
        expect(requests).toContain("/l2");
        for (redirect of [301, 302, 303, 307, 308]) {
          const refused = await send(terms);
          expect(refused.status).toBe(503);
          expect(await refused.json()).toEqual({ error: "cosigning_refused" });
        }
        redirect = 0;
        pool = 101;
        expect((await send(terms)).status).toBe(503);
        pool = 100;
      }
      expect(targetReads).toBe(0);
      const wrongRemainder = await send({ ...settlement, treasuryAmount: "1" });
      expect(wrongRemainder.status).toBe(503);
      expect(await wrongRemainder.json()).toEqual({ error: "cosigning_refused" });
      const health = async () => {
        const response = await fetch(`${origin}/health`);
        expect(response.headers.get("cache-control")).toBe("no-store");
        return response.json();
      };
      expect(await health()).toEqual({
        service: "payout-cosigner",
        publicKey: ec.starkCurve.getStarkKey(key),
        pendingWalletChanges: { count: 0, oldestSince: null },
      });
      wallet = "0x999";
      expect((await send({ ...payment, wallet })).status).toBe(503);
      expect((await health()).pendingWalletChanges).toEqual({ count: 1, oldestSince: 1000 });
      wallet = "0x123";
      expect((await send(payment)).status).toBe(200);
      expect((await health()).pendingWalletChanges).toEqual({ count: 0, oldestSince: null });
    } finally {
      await server.stop(true);
      wallets.close();
      rmSync(directory, { recursive: true });
    }
  });
}
