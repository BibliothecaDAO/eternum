import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as processTools from "./process";
import { clientEnvironment, deployClient, deployWorkers, workersReady } from "./publish";
import { Platform, workers, workerSecrets, type Secrets } from "./platform";
import { PrivateStore } from "./private-store";
import { environments, type Inputs } from "./settings";

const revision = "a".repeat(40);
const input = {
  rpc: "https://starknet-mainnet.g.alchemy.com/v2/throwaway",
  cloudflareToken: "test-cloudflare",
  resend: "test-resend",
} as Inputs;
const temporary: string[] = [];
const originalFetch = globalThis.fetch;
afterEach(() => {
  mock.restore();
  globalThis.fetch = originalFetch;
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});
function platform(environment: keyof typeof environments = "dev", apply = true) {
  const base = mkdtempSync(join(tmpdir(), "publish-test-"));
  temporary.push(base);
  mkdirSync(join(base, "repository"));
  const store = new PrivateStore(join(base, "private"), join(base, "repository"), apply);
  const value = new Platform(environments[environment], input, store, apply);
  value.accountId = async () => "test-account";
  return value;
}
function commands() {
  const calls: processTools.Command[] = [];
  spyOn(processTools, "command").mockImplementation(async (spec) => {
    calls.push(spec);
    if (spec.argv[0] === "git" && spec.argv[1] === "rev-parse") return revision;
    return "";
  });
  return calls;
}
test.each(["dev", "production"] as const)(
  "%s client publishes locally after every build check",
  async (environment) => {
    const value = platform(environment);
    const calls = commands();
    value.clientRevision = async () => undefined;
    await deployClient(value, revision);
    const build = calls.find((call) => call.argv.join(" ") === "pnpm --dir apps/game build")!;
    expect(build.env).toEqual(clientEnvironment(value, revision));
    const publishIndex = calls.findIndex((call) => call.argv.includes("wrangler@3"));
    expect(publishIndex).toBeGreaterThan(0);
    const before = calls
      .slice(0, publishIndex)
      .map((call) => call.argv.join(" "))
      .join("\n");
    expect(before).toContain("verify:assets");
    expect(before).toContain("src/utils/chunk-load-recovery.test.ts src/pwa");
    expect(before).toContain("verify-pwa-build.mjs");
    expect(before).toContain("ensure-pwa-cache-rule.mjs");
    expect(calls[publishIndex]!.argv).toContain(value.target.pages);
    expect(calls[publishIndex]!.env!.CLOUDFLARE_API_TOKEN).toBe(input.cloudflareToken);
    expect(calls.at(-1)!.input).toContain("verifyClientDeployment");
    expect(calls.some((call) => call.argv[0] === "gh")).toBe(false);
    expect(JSON.stringify(calls.map((call) => call.argv))).not.toContain(input.cloudflareToken);
  },
);
test("client upload is skipped when the published revision already exists, but its assets are checked", async () => {
  const value = platform();
  const calls = commands();
  value.clientRevision = async () => revision;
  await deployClient(value, revision);
  expect(calls.some((call) => call.argv.includes("wrangler@3"))).toBe(false);
  expect(calls.at(-1)!.input).toContain("verifyClientDeployment");
});
test("wrong client chain/RPC stops before a build or upload", async () => {
  const value = platform();
  value.inputs.rpc = "https://starknet-sepolia.g.alchemy.com/v2/throwaway";
  const calls = commands();
  try {
    await expect(deployClient(value, revision)).rejects.toThrow("chain and Alchemy");
    expect(calls).toEqual([]);
  } finally {
    value.inputs.rpc = "https://starknet-mainnet.g.alchemy.com/v2/throwaway";
  }
});
test("all six Workers deploy locally, migrations precede code, and public versions must match", async () => {
  const value = platform();
  const calls = commands();
  const deployed = new Set<string>();
  const actions: string[] = [];
  value.deployedVersion = async (worker) => (deployed.has(worker.id) ? { id: worker.id, revision } : undefined);
  value.wrangler = async (worker, args) => {
    actions.push(`${worker.id}:${args.join(" ")}`);
    if (args[0] === "deploy") deployed.add(worker.id);
    return "";
  };
  globalThis.fetch = mock(async (url) =>
    Response.json({ environment: "staging", version: String(url).endsWith("/api/health") ? "identity" : "launch" }),
  ) as unknown as typeof fetch;
  await deployWorkers(value, revision);
  expect(deployed.size).toBe(6);
  for (const name of ["identity", "launch"])
    expect(actions.indexOf(`${name}:d1 migrations apply DB --remote`)).toBeLessThan(
      actions.indexOf(`${name}:deploy --tag ${revision}`),
    );
  expect(await workersReady(value, revision)).toBe(true);
  const count = actions.length;
  await deployWorkers(value, revision);
  expect(actions).toHaveLength(count);
  globalThis.fetch = mock(async () =>
    Response.json({ environment: "production", version: "old" }),
  ) as unknown as typeof fetch;
  expect(await workersReady(value, revision)).toBe(false);
  expect(calls.some((call) => call.argv[0] === "gh")).toBe(false);
});
test("Worker secrets go only to their own Worker through stdin", async () => {
  const value = platform();
  const keys = { deployer: "0x123", relay: "0x124", monitor: "0x125", launcher: "0x126", shardRelay: "0x127" };
  const secrets = {
    operator: "test-operator",
    auth: "test-auth",
    vapidPublic: "test-public",
    vapidPrivate: "test-private",
    guardian: "0x128",
  } as Secrets;
  value.secretNames = async () => [];
  value.wrangler = async (worker, args, body) => {
    expect(args).toEqual(["secret", "bulk"]);
    expect(JSON.parse(body!)).toEqual(workerSecrets(worker, input, secrets, keys));
    return "";
  };
  for (const worker of workers) await value.installSecrets(worker, workerSecrets(worker, input, secrets, keys));
});
test("dry publish refuses every write before commands or transports", async () => {
  const value = platform("dev", false);
  const calls = commands();
  await expect(deployClient(value, revision)).rejects.toThrow("Dry run");
  await expect(deployWorkers(value, revision)).rejects.toThrow("Dry run");
  expect(calls).toEqual([]);
});
