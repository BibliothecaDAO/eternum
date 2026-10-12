import { disposeWorker } from "../../../packages/value-ledger/test-support/workerd";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, expect, it } from "vitest";
import schema from "../../../contracts/l3/world-native/schema/schema.json";

const bundle = mkdtempSync(join(tmpdir(), "relay-bundle-"));
beforeAll(() => {
  execFileSync("pnpm", ["exec", "wrangler", "deploy", "--dry-run", "--env", "staging", "--outdir", bundle], {
    cwd: new URL("..", import.meta.url).pathname,
    stdio: "pipe",
  });
}, 180_000);
afterAll(() => rmSync(bundle, { recursive: true, force: true }));

it.each([302, 200])(
  "runs the relay join through workerd with approval HTTP %s",
  async (status) => {
    const chain = "0x534e5f574f524b4552";
    let deployed = false,
      approvals = 0,
      redirects = 0,
      receipts = 0;

    const manifest = {
      version: 1,
      chainId: chain,
      l2GasBound: "0x47868c00",
      vrfPublicKey: { x: "0x1", y: "0x2" },
      releaseSchemas: { "1": schema.identity },
      rpcUrl: "https://shard.test/rpc",
      accountClassHash: "0x2",
      guardianPublicKey: "0x9",
      contracts: { games: "0x77" },
    };
    const mf = new Miniflare({
      workers: [
        {
          name: "relay",
          modulesRoot: bundle,
          modules: [{ type: "ESModule", path: bundle + "/worker.js" }],
          compatibilityDate: "2026-07-30",
          compatibilityFlags: ["nodejs_compat"],
          durableObjects: { RELAY: { className: "ValueRelay", useSQLite: true } },
          serviceBindings: {
            IDENTITY: { name: "identity", entrypoint: "ValueIdentity" },
            ROSTER_MONITOR: { name: "identity", entrypoint: "RosterMonitor" },
            IDENTITY_HTTP: async (request: Request) => {
              approvals++;
              expect(request.headers.get("authorization")).toBe("Bearer fixture-operator");
              expect(new URL(request.url).pathname).toBe("/api/devices/bots");
              if (status === 302)
                return new Response(null, { status: 302, headers: { location: "https://redirect.test/approval" } });
              return Response.json({ signature: ["0x3", "0x4"] });
            },
          },
          bindings: {
            ENVIRONMENT: "staging",
            BASE_URL: "https://play.dev-realms.party",
            L2_RPC_URL: "https://l2.test/rpc",
            OPERATOR_TOKEN: "fixture-operator",
            SHARD_LEDGER_OPERATOR_PRIVATE_KEY: "0x1",
            LEDGER_OPERATOR_ADDRESS: "0x5",
            LEDGER_OPERATOR_PRIVATE_KEY: "0x2",
          },
          outboundService: async (request: Request) => {
            const url = new URL(request.url);
            if (url.hostname === "redirect.test") {
              redirects++;
              return Response.json({ signature: ["0x3", "0x4"] });
            }
            if (url.pathname === "/manifest") return Response.json(manifest);
            const { id, method } = (await request.json()) as { id: number; method: string };
            if (url.hostname !== "shard.test")
              return Response.json({ id, jsonrpc: "2.0", error: { code: -32601, message: "L2 unavailable" } });
            if ((method === "starknet_getClassHashAt" && !deployed) || method === "starknet_getNonce")
              return Response.json({ id, jsonrpc: "2.0", error: { code: 20, message: "Contract not found" } });
            let result;
            if (method === "starknet_getClassHashAt") result = "0x2";
            if (method === "starknet_chainId") result = chain;
            if (method === "starknet_estimateFee")
              result = [
                {
                  l1_gas_consumed: "0x0",
                  l1_gas_price: "0x0",
                  l1_data_gas_consumed: "0x0",
                  l1_data_gas_price: "0x0",
                  l2_gas_consumed: "0x64",
                  l2_gas_price: "0x1",
                  overall_fee: "0x64",
                  unit: "FRI",
                },
              ];
            if (method === "starknet_addDeployAccountTransaction") {
              deployed = true;
              result = { transaction_hash: "0x123", contract_address: "0x456" };
            }
            if (method === "starknet_getTransactionStatus")
              result = { finality_status: "ACCEPTED_ON_L2", execution_status: "SUCCEEDED" };
            if (method === "starknet_getTransactionReceipt") {
              receipts++;
              result = {
                transaction_hash: "0x123",
                type: "DEPLOY_ACCOUNT",
                finality_status: "ACCEPTED_ON_L2",
                execution_status: "SUCCEEDED",
                actual_fee: { amount: "0x0", unit: "FRI" },
                events: [],
                messages_sent: [],
                execution_resources: {},
                contract_address: "0x456",
              };
            }
            return Response.json({
              id,
              jsonrpc: "2.0",
              ...(result === undefined ? { error: { code: -32601, message: "Unsupported method" } } : { result }),
            });
          },
        },
        {
          name: "identity",
          modules: true,
          compatibilityDate: "2026-07-30",
          script: `import {WorkerEntrypoint} from 'cloudflare:workers';
export class ValueIdentity extends WorkerEntrypoint { shards(){return [{chainId:'${chain}',url:'https://shard.test',status:'active'}]} l2ChainId(){return '0x534e5f4d41494e'} }
export class RosterMonitor extends WorkerEntrypoint { verifyRoster(){return 0} }
export default {fetch(){return new Response(null,{status:404})}};`,
        },
      ],
    });
    try {
      await (await mf.getWorker("relay")).scheduled({ cron: "* * * * *" });
      let health: { shards?: { chainId: string; value?: { reason?: string } }[] } = {};
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        health = (await (
          await mf.dispatchFetch("https://play.dev-realms.party/api/value/health")
        ).json()) as typeof health;
        if (status === 200 ? receipts > 0 : health.shards?.[0]?.value?.reason === "operator_redirect_refused") break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(approvals).toBeGreaterThan(0);
      expect(redirects).toBe(0);
      expect(deployed).toBe(status === 200);
      if (status === 200) expect(receipts).toBeGreaterThan(0);
      else expect(health.shards).toMatchObject([{ chainId: chain, value: { reason: "operator_redirect_refused" } }]);
    } finally {
      await disposeWorker(mf);
    }
  },
  60_000,
);
