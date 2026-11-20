import { PublicError, deploymentStage } from "./errors";
import { join, relative } from "node:path";
import { setTimeout } from "node:timers/promises";
import { command } from "./process";
import { Platform, databaseWorkers, workers, type Secrets, type Worker } from "./platform";
import { clientSite, shardInputs, type PagesSite } from "./settings";
import { NATIVE_RELEASES } from "../release/native-release";
import { readReleaseIdentity } from "./release-identity";
import type { ApplyReleaseRequest, ReleaseIdentity, ReleaseReport } from "../../apps/launch-service/src/operator-api";
import { CHAT_RETENTION_BATCH } from "../../apps/realms/server/chat/chat-objects";

async function workerReady(platform: Platform, worker: Worker, revision: string) {
  const version = await platform.deployedVersion(worker);
  if (version?.revision !== revision) return false;
  const path = worker.id === "identity" ? "/api/health" : worker.id === "launch" ? "/api/factory/version" : undefined;
  if (!path) return true;
  const response = await fetch(`${platform.target.origin}${path}`, {
    redirect: "error",
    headers: { "User-Agent": "realms-deployment/1" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return false;
  const body = (await response.json()) as { environment: string; version: string };
  return body.environment === platform.target.worker && body.version === version.id;
}
export async function buildPackages(platform: Platform) {
  if (!platform.apply) throw new PublicError("Dry run cannot deploy Workers");
  deploymentStage("build packages");
  await command({ argv: ["pnpm", "run", "build:packages"] });
}
export async function deployWorkers(platform: Platform, revision: string, selected: readonly Worker[]) {
  if (!platform.apply) throw new PublicError("Dry run cannot deploy Workers");
  for (const worker of selected) {
    deploymentStage(`publish ${worker.id}`);
    if ((await platform.deployedRevision(worker)) !== revision) {
      if (databaseWorkers.some((id) => id === worker.id))
        await platform.wrangler(worker, ["d1", "migrations", "apply", "DB", "--remote"]);
      await platform.wrangler(worker, ["deploy", "--tag", revision]);
    }
    let ready = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      ready = await workerReady(platform, worker, revision);
      if (ready) break;
      if (attempt < 19) await setTimeout(3000);
    }
    if (!ready) throw new PublicError("Worker version did not reach its public route");
  }
}
const releaseWorkers = workers.filter((worker) => worker.id === "launch");
const directoryWorkers = workers.filter((worker) => worker.id === "identity");
const gameReaderWorkers = workers.filter((worker) => worker.id !== "launch");

export async function publishCloudflare(platform: Platform, revision: string) {
  await buildPackages(platform);
  await listOfficialShard(platform, revision);
  await deployWorkers(platform, revision, releaseWorkers);
  await buildClient(platform, revision);
  await advanceFrontierRelease(platform, revision);
  await deployWorkers(platform, revision, gameReaderWorkers);
  await keepChatRetention(platform);
  await publishClient(platform, revision);
  await deployDocs(platform, revision);
}

/**
 * Every chat object the identity Worker holds keeps chat's thirty days (apps/realms server/chat/retention.ts): the
 * deploy names each one to the Worker, which deletes its messages past thirty days and sets its alarm for the rest. An
 * object written before retention existed has no alarm, and gains one here. A rerun changes nothing.
 */
export async function keepChatRetention(platform: Platform) {
  if (!platform.apply) throw new PublicError("Dry run cannot reach chat");
  deploymentStage("keep chat retention");
  const operator = platform.store.read<Secrets>("secrets.json")?.operator;
  if (!operator) throw new PublicError("Service credentials are missing; run setup with --apply before publishing");
  for (const { className, ids } of await platform.chatObjects()) {
    for (let start = 0; start < ids.length; start += CHAT_RETENTION_BATCH)
      await callChatRetention(platform, operator, { className, ids: ids.slice(start, start + CHAT_RETENTION_BATCH) });
    console.log(`${className}: ${ids.length} objects keep thirty days of chat.`);
  }
}

async function callChatRetention(platform: Platform, operator: string, call: { className: string; ids: string[] }) {
  const response = await fetch(`${platform.target.origin}/api/operator/chat-retention`, {
    method: "POST",
    redirect: "error",
    headers: {
      "User-Agent": "realms-deployment/1",
      "Content-Type": "application/json",
      Authorization: `Bearer ${operator}`,
    },
    body: JSON.stringify(call),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new PublicError(`Chat retention refused ${call.className}: ${response.status}`);
}

export async function listOfficialShard(platform: Platform, revision: string) {
  if (!platform.apply) throw new PublicError("Dry run cannot list the shard");
  deploymentStage("list the official shard");
  const secrets = platform.store.read<Secrets>("secrets.json");
  if (!secrets) throw new PublicError("Service credentials are missing; run setup with --apply before publishing");
  const { shard } = await servedShard(platform, revision);
  if (!shard) {
    console.log("The box half has never built: no shard to list.");
    return;
  }
  if (isSameShard(await listedShard(platform, secrets.operator), shard)) {
    console.log(`The directory already lists ${shard.chainId} at ${shard.url}.`);
    return;
  }
  await deployWorkers(platform, revision, directoryWorkers);
  await putDirectoryShard(platform, secrets.operator, shard.url, shard.chainId);
  console.log(`The directory lists ${shard.chainId} at ${shard.url}.`);
}

type ShardRow = NonNullable<ApplyReleaseRequest["shard"]>;

async function servedShard(platform: Platform, revision: string): Promise<ApplyReleaseRequest> {
  const { release, chainId } = readReleaseIdentity(platform.store, revision);
  if (!release) return { release, shard: null };
  if (!chainId) throw new PublicError("The box half has not prepared its shard; run it (pnpm run deploy) first");
  const url = shardInputs(platform.target).public_herald_url;
  await requireHeraldServes(url, chainId, release);
  return { release, shard: { chainId, url } };
}

async function listedShard(platform: Platform, operator: string): Promise<ShardRow | null> {
  const response = await fetch(`${platform.target.origin}/api/directory/shard`, {
    redirect: "error",
    headers: { "User-Agent": "realms-deployment/1", Authorization: `Bearer ${operator}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new PublicError(`The directory: HTTP ${response.status}.`, response.status, "directory_unavailable");
  return ((await response.json()) as { shard: ShardRow | null }).shard;
}

const isSameShard = (listed: ShardRow | null, shard: ShardRow) =>
  listed !== null && isSameChain(listed.chainId, shard.chainId) && listed.url === shard.url;

async function requireHeraldServes(herald: string, chainId: string, release: ReleaseIdentity) {
  const response = await fetch(`${herald}/manifest`, {
    redirect: "error",
    headers: { "User-Agent": "realms-deployment/1" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new PublicError(`Herald manifest: HTTP ${response.status}.`, response.status, "manifest_unavailable");
  const manifest = (await response.json().catch(() => null)) as {
    chainId?: unknown;
    releases?: Record<string, { schema?: unknown } | undefined>;
  } | null;
  if (!isSameChain(manifest?.chainId, chainId))
    throw new PublicError("Herald serves another chain than the box's; rerun the box half (pnpm run deploy)");
  if (manifest?.releases?.[String(release.releaseId)]?.schema !== release.schema)
    throw new PublicError(
      `Herald does not publish release ${release.releaseId} with the box's schema; rerun the box half (pnpm run deploy)`,
    );
}

async function putDirectoryShard(platform: Platform, operator: string, herald: string, chainId: string) {
  const response = await fetch(`${platform.target.origin}/api/directory/shard`, {
    method: "PUT",
    redirect: "error",
    headers: {
      "User-Agent": "realms-deployment/1",
      "Content-Type": "application/json",
      Authorization: `Bearer ${operator}`,
    },
    body: JSON.stringify({ url: herald }),
    signal: AbortSignal.timeout(60_000),
  });
  const body = (await response.json().catch(() => null)) as { shard?: { chainId?: unknown }; error?: unknown } | null;
  if (!response.ok || !isSameChain(body?.shard?.chainId, chainId)) {
    const code = typeof body?.error === "string" ? body.error : "directory_listing_failed";
    throw new PublicError(`The directory refused the shard: ${code}.`, response.status, code);
  }
}

function isSameChain(value: unknown, chainId: string) {
  try {
    return typeof value === "string" && BigInt(value) === BigInt(chainId);
  } catch {
    return false;
  }
}

/** What the release route's refusals mean for the person running the deploy. */
const RELEASE_REFUSALS: Record<string, string> = {
  release_unverified: "the box half has never built this release; run it (pnpm run deploy) first",
  release_not_registered: "the shard has not registered it yet; run the box half (pnpm run deploy) first",
  release_contents_differ:
    "the shard registered other contents under this release number; run the box half at this commit, or bump the release",
  release_unpublished: "Herald does not publish it with this commit's schema; rerun the box half",
  release_older_than_shard: "the shard runs a newer release; deploy a newer commit",
  release_downgrade: "a running game is pinned past it; deploy a newer commit",
};

/**
 * The running Frontier games take the release this commit ships, as the box half built it, before its client goes
 * live: the launch Worker applies it as the launcher. It refuses until the shard has registered exactly that release
 * and Herald publishes it with the commit's schema; a rerun sends nothing.
 */
export async function advanceFrontierRelease(platform: Platform, revision: string) {
  if (!platform.apply) throw new PublicError("Dry run cannot advance a release");
  deploymentStage("advance Frontier release");
  const secrets = platform.store.read<Secrets>("secrets.json");
  if (!secrets) throw new PublicError("Service credentials are missing; run setup with --apply before publishing");
  const request = await servedShard(platform, revision);
  const response = await fetch(`${platform.target.origin}/api/factory/release`, {
    method: "POST",
    redirect: "error",
    headers: {
      "User-Agent": "realms-deployment/1",
      "Content-Type": "application/json",
      Authorization: `Bearer ${secrets.operator}`,
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(300_000),
  });
  const body = (await response.json().catch(() => null)) as (ReleaseReport & { error?: string }) | null;
  if (!response.ok || body?.shard === undefined) {
    const code = typeof body?.error === "string" ? body.error : "release_apply_failed";
    throw new PublicError(
      `Release ${NATIVE_RELEASES.frontier.release}: ${RELEASE_REFUSALS[code] ?? code}.`,
      response.status,
      code,
    );
  }
  platform.store.write("release-advance.json", body);
  if (body.shard) {
    const { chainId, games, opened } = body.shard;
    for (const { gameId, from, to } of games)
      console.log(`Frontier game ${gameId} on ${chainId}: release ${from} → ${to}.`);
    if (opened.length) console.log(`New games on ${chainId} start on release ${NATIVE_RELEASES.frontier.release}.`);
  }
}

export function clientEnvironment(platform: Platform, revision: string) {
  return {
    VITE_PUBLIC_ENVIRONMENT: platform.target.worker,
    VITE_PUBLIC_GAME_VERSION: revision,
    // The privacy policy (apps/game/src/shell/legal.tsx) describes no error reports: a DSN here needs a section there
    // saying what a report carries.
    VITE_PUBLIC_SENTRY_DSN: "",
  };
}
async function verifyPublishedClient(platform: Platform) {
  deploymentStage("verify client");
  await command({
    argv: [
      "node",
      "apps/game/scripts/verify-client-deployment.mjs",
      "apps/game/dist",
      platform.target.origin,
      join(platform.store.directory, "client-deployment-check.json"),
    ],
  });
}
export async function buildClient(platform: Platform, revision: string) {
  if (!platform.apply) throw new PublicError("Dry run cannot deploy the client");
  deploymentStage("build client");
  const env = clientEnvironment(platform, revision);
  await command({ argv: ["pnpm", "--dir", "apps/game", "test", "src/utils/chunk-load-recovery.test.ts", "src/pwa"] });
  await command({ argv: ["pnpm", "--dir", "apps/game", "verify:assets"] });
  await command({ argv: ["pnpm", "--dir", "apps/game", "build"], env });
  await command({
    argv: [
      "node",
      "apps/game/scripts/verify-pwa-build.mjs",
      "apps/game/dist",
      join(platform.store.directory, "pwa-build-check.json"),
    ],
  });
  await command({
    argv: ["node", "--input-type=module"],
    input: `
import { readdir, unlink } from 'node:fs/promises';
for (const file of await readdir('apps/game/dist', {recursive:true}))
  if (file.endsWith('.js.map')) await unlink('apps/game/dist/' + file);
`,
  });
}
export async function publishClient(platform: Platform, revision: string) {
  if (!platform.apply) throw new PublicError("Dry run cannot deploy the client");
  deploymentStage("publish client");
  const cloudflare = await platform.cloudflareEnvironment();
  await command({
    argv: ["node", "apps/game/scripts/ensure-pwa-cache-rule.mjs", platform.target.origin, platform.target.zone],
    env: cloudflare,
  });
  await publishSite(platform, clientSite(platform.target), "apps/game/dist", revision);
  await verifyPublishedClient(platform);
}
/**
 * The docs site, built as validation builds it and published from the same commit as the client. Its build reads the
 * client's environment constant, so its pages unfurl with the environment's own link preview image.
 */
export async function deployDocs(platform: Platform, revision: string) {
  if (!platform.apply) throw new PublicError("Dry run cannot deploy the docs");
  deploymentStage("publish docs");
  await command({
    argv: ["pnpm", "run", "build:docs"],
    env: { VITE_PUBLIC_ENVIRONMENT: platform.target.worker },
  });
  await publishSite(platform, platform.target.docs, "apps/game-docs/dist", revision);
  deploymentStage("verify docs");
  await command({
    argv: [
      "node",
      "apps/game-docs/scripts/verify-docs-deployment.mjs",
      "apps/game-docs/dist",
      platform.target.docs.origin,
      join(platform.store.directory, "docs-deployment-check.json"),
    ],
  });
}
/**
 * Upload a built site to its Pages project as this commit's deployment. Every run uploads the build it then checks, so
 * the check proves what this run published, a rerun at the same commit included: two builds of one commit in two
 * directories differ, and Pages stores only the files it lacks.
 */
async function publishSite(platform: Platform, site: PagesSite, dist: string, revision: string) {
  await command({
    argv: [
      "pnpm",
      "--dir",
      "apps/game",
      "exec",
      "wrangler",
      "pages",
      "deploy",
      relative("apps/game", dist),
      "--project-name",
      site.pages,
      "--branch",
      "main",
      "--commit-hash",
      revision,
    ],
    env: await platform.cloudflareEnvironment(),
  });
}
