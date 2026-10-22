import { PublicError, deploymentStage } from "./errors";
import { join, relative } from "node:path";
import { setTimeout } from "node:timers/promises";
import { l2EnvironmentProblem } from "../../apps/game/src/runtime/l2-environment";
import { command } from "./process";
import { Platform, databaseWorkers, workers, type Secrets, type Worker } from "./platform";
import { clientSite, type PagesSite } from "./settings";
import { NATIVE_RELEASE_ID } from "../release/native-release";
import type { ApplyReleaseRequest, ReleaseReport } from "../../apps/launch-service/src/operator-api";

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
  await advanceFrontierRelease(platform);
  await deployClient(platform, revision);
  await deployDocs(platform, revision);
}

/** What the release route's refusals mean for the person running the deploy. */
const RELEASE_REFUSALS: Record<string, string> = {
  release_not_registered: `the shard has not registered release ${NATIVE_RELEASE_ID} yet; run the box half (pnpm run deploy) first`,
  release_unpublished: `Herald does not publish release ${NATIVE_RELEASE_ID} yet; rerun the box half`,
  release_older_than_shard: `the shard runs a release newer than ${NATIVE_RELEASE_ID}; deploy a newer commit`,
  release_downgrade: `a running game is pinned past release ${NATIVE_RELEASE_ID}; deploy a newer commit`,
};

/**
 * The running Frontier games take the release this commit ships before its client goes live: the launch Worker applies
 * it as the launcher. It refuses until the box half has registered the release and Herald publishes it; a rerun sends
 * nothing.
 */
export async function advanceFrontierRelease(platform: Platform) {
  if (!platform.apply) throw new PublicError("Dry run cannot advance a release");
  deploymentStage("advance Frontier release");
  const secrets = platform.store.read<Secrets>("secrets.json");
  if (!secrets) throw new PublicError("Service credentials are missing; run setup with --apply before publishing");
  const request: ApplyReleaseRequest = { releaseId: NATIVE_RELEASE_ID };
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
/** The docs site, built as validation builds it and published from the same commit as the client. */
export async function deployDocs(platform: Platform, revision: string) {
  if (!platform.apply) throw new PublicError("Dry run cannot deploy the docs");
  deploymentStage("publish docs");
  await command({ argv: ["pnpm", "run", "build:docs"] });
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
