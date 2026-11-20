import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as processTools from "./process";
import {
  advanceFrontierRelease,
  keepChatRetention,
  clientEnvironment,
  buildClient,
  buildPackages,
  deployDocs,
  deployWorkers,
  listOfficialShard,
  publishClient,
  publishCloudflare,
} from "./publish";
import { NATIVE_RELEASES } from "../release/native-release";
import { Platform, databaseWorkers, workers, workerSecrets, type Secrets } from "./platform";
import { PrivateStore } from "./private-store";
import { environments, shardInputs, type Inputs } from "./settings";
import { releaseLine } from "../../packages/core/src/test-support/releases";

const revision = "a".repeat(40);
const input = {
  rpc: "https://starknet-mainnet.g.alchemy.com/v2/throwaway",
  cloudflareToken: "test-cloudflare",
  resend: "test-resend",
  discordClientId: "test-discord-id",
  cosignerPublicKey: "0x123",
  cosignerUrl: "https://cosigner.test",
  cosignerToken: "test-cosigner-token",
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
    await buildClient(value, revision);
    await publishClient(value, revision);
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
  await buildClient(value, revision);
  await publishClient(value, revision);
  const upload = calls.findIndex((call) => call.argv.includes("wrangler"));
  expect(upload).toBeGreaterThan(0);
  expect(calls.slice(upload + 1).map((call) => call.argv[1])).toEqual([
    "apps/game/scripts/verify-client-deployment.mjs",
  ]);
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
  await deployWorkers(value, revision, workers);
  expect([...deployed]).toEqual(workers.map((worker) => worker.id));
  for (const name of ["identity", "launch", "admin"])
    expect(actions.indexOf(`${name}:d1 migrations apply DB --remote`)).toBeLessThan(
      actions.indexOf(`${name}:deploy --tag ${revision}`),
    );
  const count = actions.length;
  await deployWorkers(value, revision, workers);
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
    // The build names the environment, so its pages unfurl with that environment's own link preview image.
    expect(calls[0]!.env).toEqual({ VITE_PUBLIC_ENVIRONMENT: environment === "dev" ? "staging" : "production" });
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
  await expect(buildClient(value, revision)).rejects.toThrow("Dry run");
  await expect(publishClient(value, revision)).rejects.toThrow("Dry run");
  await expect(deployDocs(value, revision)).rejects.toThrow("Dry run");
  await expect(buildPackages(value)).rejects.toThrow("Dry run");
  await expect(deployWorkers(value, revision, workers)).rejects.toThrow("Dry run");
  await expect(advanceFrontierRelease(value, revision)).rejects.toThrow("Dry run");
  await expect(listOfficialShard(value, revision)).rejects.toThrow("Dry run");
  expect(calls).toEqual([]);
});

/** The release the checkout's run read from the box's build, recorded for `commit`. */
const IDENTITY = {
  releaseId: NATIVE_RELEASES.frontier.release,
  schema: "2fbdecd09f961d7b387524eef591d8a0185c2dea59c7c334560c9789a444149e",
  logic: { season: "0x55e0", troops: "0x77a2" },
  migration: "0x0",
};
const CHAIN = "0x5245414c4d535f444556";
const recordIdentity = (value: Platform, commit = revision) =>
  value.store.write("release-identity.json", { commit, release: IDENTITY, chainId: CHAIN });
const HERALD = {
  version: 1,
  chainId: CHAIN,
  releases: releaseLine(IDENTITY.schema, [NATIVE_RELEASES.frontier.release]),
};
const PREVIOUS = { url: "https://old-herald.test", chainId: "0x1" };
const boxOf = (value: Platform) => ({ chainId: CHAIN, url: shardInputs(value.target).public_herald_url });

interface DirectoryRow {
  url: string;
  chainId: string;
}

function releaseRoute(
  value: Platform,
  answer: () => Response,
  {
    herald = HERALD,
    rows = [],
    legacy = false,
    refusePut = () => false,
  }: { herald?: unknown; rows?: DirectoryRow[]; legacy?: boolean; refusePut?: () => boolean } = {},
) {
  value.store.write("secrets.json", { operator: "operator-test" } as Secrets);
  recordIdentity(value);
  const requests: { url: string; init?: RequestInit }[] = [];
  const directory = { rows, puts: [] as { url: string; init: RequestInit }[] };
  const order: string[] = [];
  globalThis.fetch = mock(async (url: string | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith("/api/factory/release")) {
      requests.push({ url: path, init });
      order.push("release");
      return answer();
    }
    if (path === `${shardInputs(value.target).public_herald_url}/manifest`) return Response.json(herald);
    if (path.endsWith("/api/directory/shard") && init?.method === undefined)
      return legacy
        ? Response.json({ error: "not_found" }, { status: 404 })
        : Response.json({ shard: rows[0] ?? null });
    if (path.endsWith("/api/directory/shard") && init?.method === "PUT") {
      if (refusePut()) throw new Error("connection reset");
      directory.puts.push({ url: path, init });
      order.push("directory");
      const row = { url: JSON.parse(String(init.body)).url, chainId: HERALD.chainId };
      directory.rows.splice(0, directory.rows.length, row);
      return Response.json({ shard: row });
    }
    return Response.json({
      environment: value.target.worker,
      version: path.endsWith("/api/health") ? "identity" : "launch",
    });
  }) as unknown as typeof fetch;
  return { requests, directory, order };
}

function workerDeploys(value: Platform, order: string[], refuse = (_worker: string, _args: string[]) => false) {
  const deployed = new Set<string>();
  value.deployedVersion = async (worker) => (deployed.has(worker.id) ? { id: worker.id, revision } : undefined);
  value.wrangler = async (worker, args) => {
    if (refuse(worker.id, args)) throw new Error("wrangler connection reset");
    order.push(`${worker.id}:${args.join(" ")}`);
    if (args[0] === "deploy") deployed.add(worker.id);
    return "";
  };
}
const REPORT = {
  shard: {
    chainId: "0x1",
    releaseId: NATIVE_RELEASES.frontier.release,
    games: [{ gameId: 1, from: 1, to: NATIVE_RELEASES.frontier.release, transactions: ["0xa"] }],
    opened: [],
  },
};

test.each(["dev", "production"] as const)(
  "%s asks the launch Worker, as the operator, to advance its Frontier games to the box's build of this release",
  async (environment) => {
    const value = platform(environment);
    const { requests } = releaseRoute(value, () => Response.json(REPORT));
    spyOn(console, "log").mockImplementation(() => {});
    await advanceFrontierRelease(value, revision);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toBe(`${value.target.origin}/api/factory/release`);
    expect(requests[0]!.init!.method).toBe("POST");
    expect(new Headers(requests[0]!.init!.headers).get("authorization")).toBe("Bearer operator-test");
    expect(JSON.parse(String(requests[0]!.init!.body))).toEqual({ release: IDENTITY, shard: boxOf(value) });
    expect(value.store.read<typeof REPORT>("release-advance.json")).toEqual(REPORT);
  },
);

test("the launch Worker's report of the release opened for new games is printed", async () => {
  const value = platform();
  releaseRoute(value, () => Response.json({ shard: { ...REPORT.shard, opened: ["0xb"] } }));
  const log = spyOn(console, "log").mockImplementation(() => {});
  await advanceFrontierRelease(value, revision);
  expect(log).toHaveBeenCalledWith(`New games on 0x1 start on release ${NATIVE_RELEASES.frontier.release}.`);
});

test.each([
  ["release_not_registered", "the shard has not registered it yet; run the box half (pnpm run deploy) first"],
  [
    "release_contents_differ",
    "the shard registered other contents under this release number; run the box half at this commit, or bump the release",
  ],
  ["release_unpublished", "Herald does not publish it with this commit's schema; rerun the box half"],
  ["release_unverified", "the box half has never built this release; run it (pnpm run deploy) first"],
])("a release the launch Worker refuses (%s) stops the deploy before any game reader changes", async (code, reason) => {
  const value = platform();
  const calls = commands();
  const order = deployOrder(value);
  releaseRoute(value, () => Response.json({ error: code }, { status: 409 }), { rows: [boxOf(value)] });
  await expect(publishCloudflare(value, revision)).rejects.toThrow(
    `Release ${NATIVE_RELEASES.frontier.release}: ${reason}.`,
  );
  expect(order).toEqual(["launch"]);
  expect(calls.map((call) => call.argv.join(" "))).toContain("pnpm --dir apps/game build");
  expect(calls.some((call) => call.argv.includes("wrangler"))).toBe(false);
});

test("on the listed chain the launch Worker and the client's build come before the release step; every game reader goes live after it", async () => {
  const value = platform();
  const order = deployOrder(value);
  releaseRoute(
    value,
    () => {
      order.push("release");
      return Response.json(REPORT);
    },
    { rows: [boxOf(value)] },
  );
  spyOn(console, "log").mockImplementation(() => {});
  spyOn(processTools, "command").mockImplementation(async (spec) => {
    order.push(spec.argv.join(" "));
    return "";
  });
  await publishCloudflare(value, revision);
  const release = order.indexOf("release");
  expect(order.indexOf("launch")).toBeLessThan(release);
  expect(order.indexOf("pnpm --dir apps/game build")).toBeLessThan(release);
  const readers = workers.filter((worker) => worker.id !== "launch").map((worker) => order.indexOf(worker.id));
  expect(Math.min(...readers)).toBeGreaterThan(release);
  expect(order.findIndex((step) => step.includes("wrangler pages deploy dist"))).toBeGreaterThan(Math.max(...readers));
});

function deployOrder(value: Platform) {
  const order: string[] = [];
  const deployed = new Set<string>();
  value.deployedVersion = async (worker) => (deployed.has(worker.id) ? { id: worker.id, revision } : undefined);
  value.wrangler = async (worker, args) => {
    if (args[0] === "deploy") {
      deployed.add(worker.id);
      order.push(worker.id);
    }
    return "";
  };
  value.chatObjects = async () => [];
  return order;
}

test("a release read for another commit, or none, asks nothing of the launch Worker", async () => {
  const value = platform();
  const { requests } = releaseRoute(value, () => Response.json(REPORT));
  recordIdentity(value, "d".repeat(40));
  await expect(advanceFrontierRelease(value, revision)).rejects.toThrow("No release identity was read for this commit");
  expect(requests).toEqual([]);
});

const published = (ids: readonly string[]) =>
  workers
    .filter((worker) => ids.includes(worker.id))
    .flatMap((worker) => [
      ...(databaseWorkers.some((id) => id === worker.id) ? [`${worker.id}:d1 migrations apply DB --remote`] : []),
      `${worker.id}:deploy --tag ${revision}`,
    ]);
const readerIds = workers.map((worker) => worker.id).filter((id) => id !== "launch" && id !== "identity");

test.each([
  ["a fresh chain", { rows: [] as DirectoryRow[] }],
  ["another listed chain", { rows: [PREVIOUS] }],
  ["an identity Worker without the one-row directory", { legacy: true }],
])("%s: identity and the box's row come before the launch Worker joins the launcher", async (_, directory) => {
  const value = platform();
  commands();
  value.chatObjects = async () => [];
  const { order } = releaseRoute(value, () => Response.json(REPORT), directory);
  workerDeploys(value, order);
  spyOn(console, "log").mockImplementation(() => {});
  await publishCloudflare(value, revision);
  expect(order).toEqual([
    ...published(["identity"]),
    "directory",
    ...published(["launch"]),
    "release",
    ...published(readerIds),
  ]);
});

test("on the listed chain no row is written and identity goes live after the release step", async () => {
  const value = platform();
  commands();
  value.chatObjects = async () => [];
  const { order, directory } = releaseRoute(value, () => Response.json(REPORT), { rows: [boxOf(value)] });
  workerDeploys(value, order);
  spyOn(console, "log").mockImplementation(() => {});
  await publishCloudflare(value, revision);
  expect(order).toEqual([...published(["launch"]), "release", ...published(["identity", ...readerIds])]);
  expect(directory.puts).toEqual([]);
});

test("a refused release on a fresh chain leaves identity, the row and the launch Worker, and no game reader", async () => {
  const value = platform();
  commands();
  value.chatObjects = async () => [];
  const { order, directory } = releaseRoute(value, () =>
    Response.json({ error: "release_unpublished" }, { status: 409 }),
  );
  workerDeploys(value, order);
  await expect(publishCloudflare(value, revision)).rejects.toThrow(`Release ${NATIVE_RELEASES.frontier.release}`);
  expect(order).toEqual([...published(["identity"]), "directory", ...published(["launch"]), "release"]);
  expect(directory.rows).toEqual([boxOf(value)]);
});

test.each([
  ["a fresh chain", false, "identity"],
  ["a fresh chain", false, "directory"],
  ["a fresh chain", false, "launch"],
  ["a fresh chain", false, "release"],
  ["a fresh chain", false, "relay"],
  ["the listed chain", true, "launch"],
  ["the listed chain", true, "release"],
  ["the listed chain", true, "identity"],
])(
  "%s: a deploy stopped at %s ends, on its rerun, with every Worker live, one row and the release applied",
  async (_, listed, stop) => {
    const value = platform();
    const rows = listed ? [boxOf(value)] : [];
    commands();
    value.chatObjects = async () => [];
    let stopped = true;
    const once = (step: string) => stopped && stop === step && !(stopped = false);
    const { order, directory, requests } = releaseRoute(
      value,
      () =>
        once("release") ? Response.json({ error: "release_apply_failed" }, { status: 503 }) : Response.json(REPORT),
      { rows, refusePut: () => once("directory") },
    );
    workerDeploys(value, order, (worker, args) => args[0] === "deploy" && once(worker));
    spyOn(console, "log").mockImplementation(() => {});
    await expect(publishCloudflare(value, revision)).rejects.toThrow();
    await publishCloudflare(value, revision);
    expect(new Set(order.filter((step) => step.endsWith(`deploy --tag ${revision}`)))).toEqual(
      new Set(published(workers.map((worker) => worker.id)).filter((step) => step.includes(":deploy"))),
    );
    expect(directory.rows).toEqual([boxOf(value)]);
    expect(directory.puts.length).toBe(listed ? 0 : 1);
    expect(JSON.parse(String(requests.at(-1)!.init!.body))).toEqual({ release: IDENTITY, shard: boxOf(value) });
  },
);

test("listing the shard twice sends one PUT as the operator, then nothing, and ends with the box's one row", async () => {
  const value = platform();
  const { directory, order } = releaseRoute(value, () => Response.json(REPORT), { rows: [PREVIOUS] });
  workerDeploys(value, order);
  spyOn(console, "log").mockImplementation(() => {});
  for (let run = 0; run < 2; run += 1) await listOfficialShard(value, revision);
  const herald = shardInputs(value.target).public_herald_url;
  expect(
    directory.puts.map(({ url, init }) => [
      url,
      init.method,
      new Headers(init.headers).get("authorization"),
      init.body,
    ]),
  ).toEqual([
    [`${value.target.origin}/api/directory/shard`, "PUT", "Bearer operator-test", JSON.stringify({ url: herald })],
  ]);
  expect(directory.rows).toEqual([{ url: herald, chainId: CHAIN }]);
});

test("a deploy stopped after a migration keeps the previous row, and its rerun ends with the box's one row", async () => {
  const value = platform();
  commands();
  value.chatObjects = async () => [];
  const { directory, order } = releaseRoute(value, () => Response.json(REPORT), { rows: [PREVIOUS] });
  let stopped = true;
  workerDeploys(value, order, (worker, args) => stopped && worker === "identity" && args[0] === "deploy");
  spyOn(console, "log").mockImplementation(() => {});
  await expect(publishCloudflare(value, revision)).rejects.toThrow("wrangler connection reset");
  expect(order.at(-1)).toBe("identity:d1 migrations apply DB --remote");
  expect(directory.rows).toEqual([PREVIOUS]);
  expect(directory.puts).toEqual([]);
  stopped = false;
  await publishCloudflare(value, revision);
  expect(directory.puts).toHaveLength(1);
  expect(directory.rows).toEqual([{ url: shardInputs(value.target).public_herald_url, chainId: CHAIN }]);
});

test.each([
  ["Herald serves another chain", { ...HERALD, chainId: "0x999" }, CHAIN, "Herald serves another chain than the box's"],
  [
    "Herald does not publish the release",
    { ...HERALD, releases: {} },
    CHAIN,
    `Herald does not publish release ${NATIVE_RELEASES.frontier.release} with the box's schema`,
  ],
  ["the box has not prepared its shard", HERALD, null, "The box half has not prepared its shard"],
])("%s: the listing is refused before any PUT, and the previous row stays", async (_, herald, chainId, message) => {
  const value = platform();
  const { directory } = releaseRoute(value, () => Response.json(REPORT), { herald, rows: [PREVIOUS] });
  value.store.write("release-identity.json", { commit: revision, release: IDENTITY, chainId });
  await expect(listOfficialShard(value, revision)).rejects.toThrow(message);
  expect(directory.puts).toEqual([]);
  expect(directory.rows).toEqual([PREVIOUS]);
});

test("a box that never built lists nothing and leaves the previous row", async () => {
  const value = platform();
  const { directory } = releaseRoute(value, () => Response.json(REPORT), { rows: [PREVIOUS] });
  value.store.write("release-identity.json", { commit: revision, release: null, chainId: null });
  spyOn(console, "log").mockImplementation(() => {});
  await listOfficialShard(value, revision);
  expect(directory.puts).toEqual([]);
  expect(directory.rows).toEqual([PREVIOUS]);
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

/** Object ids as Cloudflare lists them: 64 hex characters. */
const objectIds = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => `${prefix}${index.toString(16)}`.padEnd(64, "0"));

/**
 * Cloudflare's Durable Object lists and the identity Worker's retention route, as the deploy reaches them: the room
 * namespace lists 151 objects over two pages, one without stored data; the inbox namespace lists two.
 */
function chatRoutes(value: Platform, { namespaces = ["ChatRoom", "ChatInbox"], refuse = false } = {}) {
  value.store.write("secrets.json", { operator: "operator-test" } as Secrets);
  const script = `realms-identity${value.target.workerSuffix}`;
  const rooms = objectIds("a", 151);
  const inboxes = objectIds("b", 2);
  const calls: { url: string; authorization: string | null; body: { className: string; ids: string[] } }[] = [];
  const listed = (result: unknown, cursor = "") => Response.json({ success: true, result, result_info: { cursor } });
  globalThis.fetch = mock(async (url: string | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith("/api/operator/chat-retention")) {
      const body = JSON.parse(String(init!.body)) as { className: string; ids: string[] };
      calls.push({ url: path, authorization: new Headers(init!.headers).get("authorization"), body });
      return refuse ? new Response(null, { status: 500 }) : Response.json({ kept: body.ids.length });
    }
    if (path.includes("/namespaces/rooms/objects"))
      return path.includes("cursor=")
        ? listed([...rooms.slice(100, 150), rooms[150]].map((id, index) => ({ id, hasStoredData: index < 50 })))
        : listed(
            rooms.slice(0, 100).map((id) => ({ id, hasStoredData: true })),
            "more",
          );
    if (path.includes("/namespaces/inboxes/objects")) return listed(inboxes.map((id) => ({ id, hasStoredData: true })));
    if (path.includes("/durable_objects/namespaces"))
      return listed([
        { id: "elsewhere", script: "realms-launch", class: "ChatRoom" },
        ...namespaces.map((className) => ({
          id: className === "ChatRoom" ? "rooms" : "inboxes",
          script,
          class: className,
        })),
      ]);
    throw new Error(`unexpected request ${path}`);
  }) as unknown as typeof fetch;
  return { calls, rooms, inboxes };
}

test.each(["dev", "production"] as const)(
  "%s names every chat object holding data to the identity Worker, a hundred a call, as the operator",
  async (environment) => {
    const value = platform(environment);
    const { calls, rooms, inboxes } = chatRoutes(value);
    spyOn(console, "log").mockImplementation(() => {});
    await keepChatRetention(value);
    expect(calls.map(({ url }) => url)).toEqual(
      Array.from({ length: 3 }, () => `${value.target.origin}/api/operator/chat-retention`),
    );
    expect(calls.every(({ authorization }) => authorization === "Bearer operator-test")).toBe(true);
    expect(calls.map(({ body }) => body)).toEqual([
      { className: "ChatRoom", ids: rooms.slice(0, 100) },
      { className: "ChatRoom", ids: rooms.slice(100, 150) },
      { className: "ChatInbox", ids: inboxes },
    ]);
  },
);

test("a chat namespace the identity Worker lacks stops the deploy before any object is called", async () => {
  const value = platform();
  const { calls } = chatRoutes(value, { namespaces: ["ChatRoom"] });
  await expect(keepChatRetention(value)).rejects.toThrow("realms-identity-staging has no ChatInbox namespace");
  expect(calls).toEqual([]);
});

test("a retention call the Worker refuses stops the deploy", async () => {
  const value = platform();
  const { calls } = chatRoutes(value, { refuse: true });
  await expect(keepChatRetention(value)).rejects.toThrow("Chat retention refused ChatRoom: 500");
  expect(calls).toHaveLength(1);
});

test("deployment executables come from installed dependencies", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../apps/game/package.json", import.meta.url), "utf8"));
  expect(manifest.devDependencies.wrangler).toBe("4.136.3");
  for (const file of readdirSync(import.meta.dir)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    expect(readFileSync(join(import.meta.dir, file), "utf8")).not.toMatch(/\b(?:dlx|npx)\b/);
  }
});
