import { PublicError, deploymentStage } from "./errors";
import { join, relative } from "node:path";
import { setTimeout } from "node:timers/promises";
import { l2EnvironmentProblem } from "../../apps/game/src/runtime/l2-environment";
import { command } from "./process";
import { Platform, databaseWorkers, workers, type Secrets, type Worker } from "./platform";
import { clientSite, type PagesSite } from "./settings";
import { NATIVE_RELEASE_ID } from "../release/native-release";
import { readReleaseIdentity } from "./release-identity";
import type { ApplyReleaseRequest, ReleaseReport } from "../../apps/launch-service/src/operator-api";
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
export async function deployWorkers(platform: Platform, revision: string) {
  if (!platform.apply) throw new PublicError("Dry run cannot deploy Workers");
  deploymentStage("build packages");
  await command({ argv: ["pnpm", "run", "build:packages"] });
  for (const worker of workers) {
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
/**
 * The Cloudflare half once setup has created every resource: the Workers, then the running Frontier games' release,
 * then the client and the docs, which go live only once the games run the release they expect.
 */
export async function publishCloudflare(platform: Platform, revision: string) {
  await deployWorkers(platform, revision);
  await keepChatRetention(platform);
  await advanceFrontierRelease(platform, revision);
  await deployClient(platform, revision);
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
  const request: ApplyReleaseRequest = { release: readReleaseIdentity(platform.store, revision) };
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
  if (!response.ok || !body?.shards) {
    const code = typeof body?.error === "string" ? body.error : "release_apply_failed";
    throw new PublicError(`Release ${NATIVE_RELEASE_ID}: ${RELEASE_REFUSALS[code] ?? code}.`, response.status, code);
  }
  platform.store.write("release-advance.json", body);
  for (const { chainId, games } of body.shards)
    for (const { gameId, from, to } of games)
      console.log(`Frontier game ${gameId} on ${chainId}: release ${from} → ${to}.`);
}

export function clientEnvironment(platform: Platform, revision: string) {
  const problem = l2EnvironmentProblem(platform.target.worker, platform.inputs.rpc);
  if (problem) throw new PublicError("Client chain and Alchemy RPC environment do not agree");
  return {
    VITE_PUBLIC_L2_RPC_URL: platform.inputs.rpc,
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
export async function deployClient(platform: Platform, revision: string) {
  if (!platform.apply) throw new PublicError("Dry run cannot deploy the client");
  deploymentStage("publish client");
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
