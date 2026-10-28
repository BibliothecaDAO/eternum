import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as processTools from "./process";
import {
  advanceFrontierRelease,
  clientEnvironment,
  deployClient,
  deployDocs,
  deployWorkers,
  publishCloudflare,
} from "./publish";
import { NATIVE_RELEASE_ID } from "../release/native-release";
import { Platform, workers, workerSecrets, type Secrets } from "./platform";
import { PrivateStore } from "./private-store";
import { environments, type Inputs } from "./settings";

const revision = "a".repeat(40);
const input = {
  rpc: "https://starknet-mainnet.g.alchemy.com/v2/throwaway",
  cloudflareToken: "test-cloudflare",
  resend: "test-resend",
  discordClientId: "test-discord-id",
  discordClientSecret: "test-discord-secret",
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
    await deployClient(value, revision);
    const build = calls.find((call) => call.argv.join(" ") === "pnpm --dir apps/game build")!;
    expect(build.env).toEqual(clientEnvironment(value, revision));
    const publishIndex = calls.findIndex((call) => call.argv.includes("wrangler"));
    expect(publishIndex).toBeGreaterThan(0);
    const before = calls
      .slice(0, publishIndex)
      .map((call) => call.argv.join(" "))
      .join("\n");
    expect(before).toContain("verify:assets");
    expect(before).toContain("src/utils/chunk-load-recovery.test.ts src/pwa");
    expect(before).toContain("verify-pwa-build.mjs");
    expect(before).toContain("ensure-pwa-cache-rule.mjs");
    expect(calls[publishIndex]!.argv).toEqual([
      "pnpm",
      "--dir",
      "apps/game",
      "exec",
      "wrangler",
      "pages",
      "deploy",
      "dist",
      "--project-name",
      value.target.pages,
      "--branch",
      "main",
      "--commit-hash",
      revision,
    ]);
    expect(calls[publishIndex]!.env!.CLOUDFLARE_API_TOKEN).toBe(input.cloudflareToken);
    expect(calls.at(-1)!.argv).toContain("apps/game/scripts/verify-client-deployment.mjs");
    expect(calls.at(-1)!.argv.at(-1)).toContain("client-deployment-check.json");
    expect(calls.some((call) => call.argv[0] === "gh")).toBe(false);
    expect(JSON.stringify(calls.map((call) => call.argv))).not.toContain(input.cloudflareToken);
  },
);
test("a rerun at a commit whose client is live uploads its own build again, then checks that one", async () => {
  const value = platform();
  const calls = commands();
  await deployClient(value, revision);
  const upload = calls.findIndex((call) => call.argv.includes("wrangler"));
  expect(upload).toBeGreaterThan(0);
  expect(calls.slice(upload + 1).map((call) => call.argv[1])).toEqual([
    "apps/game/scripts/verify-client-deployment.mjs",
  ]);
});
test("wrong client chain/RPC stops before a build or upload", async () => {
  const value = platform();
  value.inputs.rpc = "https://starknet-sepolia.g.alchemy.com/v2/throwaway";
  const calls = commands();
  try {
    await expect(deployClient(value, revision)).rejects.toThrow("chain and L2 RPC");
    expect(calls).toEqual([]);
  } finally {
    value.inputs.rpc = "https://starknet-mainnet.g.alchemy.com/v2/throwaway";
  }
});
test("every Worker deploys locally, migrations precede code, and public versions must match", async () => {
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
  expect([...deployed]).toEqual(workers.map((worker) => worker.id));
  for (const name of ["identity", "launch", "admin"])
    expect(actions.indexOf(`${name}:d1 migrations apply DB --remote`)).toBeLessThan(
      actions.indexOf(`${name}:deploy --tag ${revision}`),
    );
  const count = actions.length;
  await deployWorkers(value, revision);
  expect(actions).toHaveLength(count);
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
  const access = { teamDomain: "t.cloudflareaccess.com", audience: "aud", operators: ["o@x.io"], writers: [] };
  value.secretNames = async () => [];
  value.wrangler = async (worker, args, body) => {
    expect(args).toEqual(["secret", "bulk"]);
    expect(JSON.parse(body!)).toEqual(workerSecrets(worker, input, secrets, keys, access));
    return "";
  };
  for (const worker of workers) await value.installSecrets(worker, workerSecrets(worker, input, secrets, keys, access));
});
test.each(["dev", "production"] as const)(
  "%s docs build as validation builds them, publish to their own project, then prove their origin serves them",
  async (environment) => {
    const value = platform(environment);
    const calls = commands();
    await deployDocs(value, revision);
    const check = join(value.store.directory, "docs-deployment-check.json");
    expect(calls.map((call) => call.argv)).toEqual([
      ["pnpm", "run", "build:docs"],
      [
        ...["pnpm", "--dir", "apps/game", "exec", "wrangler", "pages", "deploy", "../game-docs/dist"],
        ...["--project-name", value.target.docs.pages, "--branch", "main", "--commit-hash", revision],
      ],
      [
        "node",
        "apps/game-docs/scripts/verify-docs-deployment.mjs",
        "apps/game-docs/dist",
        value.target.docs.origin,
        check,
      ],
    ]);
    expect(calls[1]!.env!.CLOUDFLARE_API_TOKEN).toBe(input.cloudflareToken);
    expect(value.target.docs.origin).toBe(
      environment === "dev" ? "https://docs.dev-realms.party" : "https://docs.realms.party",
    );
  },
);
test("a rerun at a commit whose docs are live uploads its own build again, then proves that one", async () => {
  const value = platform();
  const calls = commands();
  await deployDocs(value, revision);
  expect(calls.map((call) => call.argv.slice(0, 2).join(" "))).toEqual([
    "pnpm run",
    "pnpm --dir",
    "node apps/game-docs/scripts/verify-docs-deployment.mjs",
  ]);
  expect(calls[1]!.argv).toContain("../game-docs/dist");
});
test("dry publish refuses every write before commands or transports", async () => {
  const value = platform("dev", false);
  const calls = commands();
  await expect(deployClient(value, revision)).rejects.toThrow("Dry run");
  await expect(deployDocs(value, revision)).rejects.toThrow("Dry run");
  await expect(deployWorkers(value, revision)).rejects.toThrow("Dry run");
  await expect(advanceFrontierRelease(value, revision)).rejects.toThrow("Dry run");
  expect(calls).toEqual([]);
});

/** The release the checkout's run read from the box's build, recorded for `commit`. */
const IDENTITY = {
  releaseId: NATIVE_RELEASE_ID,
  schema: "2fbdecd09f961d7b387524eef591d8a0185c2dea59c7c334560c9789a444149e",
  logic: { season: "0x55e0", troops: "0x77a2" },
  migration: "0x0",
};
const recordIdentity = (value: Platform, commit = revision) =>
  value.store.write("release-identity.json", { commit, release: IDENTITY });

/** The launch Worker's release route as the deploy reaches it: `answer` for the release call, Worker versions else. */
function releaseRoute(value: Platform, answer: () => Response) {
  value.store.write("secrets.json", { operator: "operator-test" } as Secrets);
  recordIdentity(value);
  const requests: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = mock(async (url: string | URL, init?: RequestInit) => {
    if (String(url).endsWith("/api/factory/release")) {
      requests.push({ url: String(url), init });
      return answer();
    }
    return Response.json({
      environment: value.target.worker,
      version: String(url).endsWith("/api/health") ? "identity" : "launch",
    });
  }) as unknown as typeof fetch;
  return requests;
}
const REPORT = {
  shards: [
    {
      chainId: "0x1",
      releaseId: NATIVE_RELEASE_ID,
      games: [{ gameId: 1, from: 1, to: NATIVE_RELEASE_ID, transactions: ["0xa"] }],
    },
  ],
};

test.each(["dev", "production"] as const)(
  "%s asks the launch Worker, as the operator, to advance its Frontier games to the box's build of this release",
  async (environment) => {
    const value = platform(environment);
    const requests = releaseRoute(value, () => Response.json(REPORT));
    spyOn(console, "log").mockImplementation(() => {});
    await advanceFrontierRelease(value, revision);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe(`${value.target.origin}/api/factory/release`);
    expect(requests[0]!.init!.method).toBe("POST");
    expect(new Headers(requests[0]!.init!.headers).get("authorization")).toBe("Bearer operator-test");
    expect(JSON.parse(String(requests[0]!.init!.body))).toEqual({ release: IDENTITY });
    expect(value.store.read<typeof REPORT>("release-advance.json")).toEqual(REPORT);
  },
);

test.each([
  ["release_not_registered", "the shard has not registered it yet; run the box half (pnpm run deploy) first"],
  [
    "release_contents_differ",
    "the shard registered other contents under this release number; run the box half at this commit, or bump the release",
  ],
  ["release_unpublished", "Herald does not publish it with this commit's schema; rerun the box half"],
  ["release_unverified", "the box half has never built this release; run it (pnpm run deploy) first"],
])("a release the launch Worker refuses (%s) stops the deploy before the client is built", async (code, reason) => {
  const value = platform();
  const calls = commands();
  value.deployedVersion = async (worker) => ({ id: worker.id, revision });
  releaseRoute(value, () => Response.json({ error: code }, { status: 409 }));
  await expect(publishCloudflare(value, revision)).rejects.toThrow(`Release ${NATIVE_RELEASE_ID}: ${reason}.`);
  expect(calls.map((call) => call.argv.join(" "))).toEqual(["pnpm run build:packages"]);
});

test("the client and the docs go live only after the release step answered", async () => {
  const value = platform();
  const calls = commands();
  value.deployedVersion = async (worker) => ({ id: worker.id, revision });
  const order: string[] = [];
  releaseRoute(value, () => {
    order.push("release");
    return Response.json(REPORT);
  });
  spyOn(console, "log").mockImplementation(() => {});
  spyOn(processTools, "command").mockImplementation(async (spec) => {
    calls.push(spec);
    order.push(spec.argv.join(" "));
    return "";
  });
  await publishCloudflare(value, revision);
  expect(order.indexOf("release")).toBeLessThan(order.indexOf("pnpm --dir apps/game build"));
  expect(order.indexOf("release")).toBeGreaterThan(order.indexOf("pnpm run build:packages"));
});

test("a release read for another commit, or none, asks nothing of the launch Worker", async () => {
  const value = platform();
  const requests = releaseRoute(value, () => Response.json(REPORT));
  recordIdentity(value, "d".repeat(40));
  await expect(advanceFrontierRelease(value, revision)).rejects.toThrow("No release identity was read for this commit");
  expect(requests).toEqual([]);
});

test("a deploy without setup's service credentials asks nothing of the launch Worker", async () => {
  const value = platform();
  recordIdentity(value);
  const requests: unknown[] = [];
  globalThis.fetch = mock(
    async (url: unknown) => (requests.push(url), Response.json(REPORT)),
  ) as unknown as typeof fetch;
  await expect(advanceFrontierRelease(value, revision)).rejects.toThrow("Service credentials are missing");
  expect(requests).toEqual([]);
});

test("deployment executables come from installed dependencies", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../apps/game/package.json", import.meta.url), "utf8"));
  expect(manifest.devDependencies.wrangler).toBe("4.136.3");
  for (const file of readdirSync(import.meta.dir)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    expect(readFileSync(join(import.meta.dir, file), "utf8")).not.toMatch(/\b(?:dlx|npx)\b/);
  }
});
