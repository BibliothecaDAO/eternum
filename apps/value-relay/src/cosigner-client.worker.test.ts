import { readFileSync } from "node:fs";
import ts from "typescript";
import { Miniflare } from "miniflare";
import { expect, it } from "vitest";
import { disposeWorker } from "../../../packages/value-ledger/test-support/workerd";

const client = ts.transpileModule(readFileSync(new URL("./cosigner-client.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const payment = {
  chainId: "0x1",
  seasonId: 7,
  transactionHash: "0xabc",
  realmsId: "0x2",
  confirmedAt: 1,
  amount: "6000000000000000000000",
  prizeRank: 1,
  prizeCount: 3,
};
const settlement = { chainId: "0x1", gameId: 7, chestWithdrawn: "42", prizeWithdrawn: "99" };

it.each(["pay", "settle"] as const)(
  "delivers exact %s terms through workerd and never follows a redirect",
  async (kind) => {
    const requests: { url: string; auth: string | null; body: unknown }[] = [];
    let status = 200;
    const worker = new Miniflare({
      modules: true,
      compatibilityDate: "2026-07-30",
      script:
        client +
        `
    export default { async fetch(request) {
      try {
        const { kind, terms } = await request.json();
        const client = cosignerClient("https://signer.test", "request-token");
        return Response.json(await (kind === "pay" ? client.pay(terms, "0x123") : client.settle(terms)));
      } catch (error) { return Response.json({ error: error.message }, { status: 503 }); }
    } };`,
      outboundService: async (request: Request) => {
        requests.push({ url: request.url, auth: request.headers.get("authorization"), body: await request.json() });
        return status === 200
          ? Response.json({ r: "0x12", s: "0x34" })
          : new Response(null, {
              status,
              headers: { location: "https://attacker.test/collect" },
            });
      },
    });
    const send = () =>
      worker.dispatchFetch("https://relay.test", {
        method: "POST",
        body: JSON.stringify({ kind, terms: kind === "pay" ? payment : settlement }),
      });
    try {
      const good = await send();
      expect(good.status).toBe(200);
      expect(await good.json()).toEqual({ r: "0x12", s: "0x34" });
      const body =
        kind === "pay"
          ? {
              kind,
              shard: "0x1",
              season: 7,
              claim: "0xabc",
              wallet: "0x123",
              amount: payment.amount,
              rank: 1,
              count: 3,
            }
          : { kind, shard: "0x1", season: 7, chest: "42", prize: "99" };
      expect(requests).toEqual([{ url: "https://signer.test/sign", auth: "Bearer request-token", body }]);
      for (status of [301, 302, 303, 307, 308]) {
        const refused = await send();
        expect(refused.status).toBe(503);
        expect(await refused.json()).toEqual({ error: "cosigner_unavailable" });
      }
      expect(requests).toHaveLength(6);
      expect(requests.every((request) => request.url === "https://signer.test/sign")).toBe(true);
    } finally {
      await disposeWorker(worker);
    }
  },
);
