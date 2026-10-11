import { existsSync } from "node:fs";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { l2EnvironmentProblem } from "../../apps/game/src/runtime/l2-environment";
import { command } from "./process";
import { Platform, workers, type Worker } from "./platform";
import { root } from "./settings";

async function requireReleaseTree(revision: string) {
  await command({ argv: ["git", "fetch", "origin", revision] });
  const local = (await command({ argv: ["git", "rev-parse", "HEAD^{tree}"] })).trim();
  const released = (await command({ argv: ["git", "rev-parse", `${revision}^{tree}`] })).trim();
  const dirty = (await command({ argv: ["git", "status", "--porcelain", "--untracked-files=no"] })).trim();
  if (dirty || local !== released) throw new Error("Checkout the clean released source before deploying");
}
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
export async function workersReady(platform: Platform, revision: string) {
  for (const worker of workers) if (!(await workerReady(platform, worker, revision))) return false;
  return true;
}
export async function deployWorkers(platform: Platform, revision: string) {
  if (!platform.apply) throw new Error("Dry run cannot deploy Workers");
  await requireReleaseTree(revision);
  await command({ argv: ["pnpm", "run", "build:packages"] });
  for (const worker of workers) {
    if ((await platform.deployedRevision(worker)) !== revision) {
      if (["identity", "launch"].includes(worker.id))
        await platform.wrangler(worker, ["d1", "migrations", "apply", "DB", "--remote"]);
      await platform.wrangler(worker, ["deploy", "--tag", revision]);
    }
    let ready = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      ready = await workerReady(platform, worker, revision);
      if (ready) break;
      if (attempt < 19) await setTimeout(3000);
    }
    if (!ready) throw new Error("Worker version did not reach its public route");
  }
}
export function clientEnvironment(platform: Platform, revision: string) {
  const problem = l2EnvironmentProblem(platform.target.worker, platform.inputs.rpc);
  if (problem) throw new Error("Client chain and Alchemy RPC environment do not agree");
  return {
    VITE_PUBLIC_L2_RPC_URL: platform.inputs.rpc,
    VITE_PUBLIC_ENVIRONMENT: platform.target.worker,
    VITE_PUBLIC_GAME_VERSION: revision,
    VITE_PUBLIC_SENTRY_DSN: "",
  };
}
async function verifyPublishedClient(platform: Platform) {
  // The exported verifier only reads. Its CLI additionally writes a report, so do not use that in dry runs.
  await command({
    argv: ["node", "--input-type=module"],
    input: `
import { verifyClientDeployment } from './apps/game/scripts/verify-client-deployment.mjs';
const result = await verifyClientDeployment('apps/game/dist', ${JSON.stringify(platform.target.origin)});
if (!result.ok) process.exitCode = 1;
`,
  });
}
export async function clientReady(platform: Platform, revision: string) {
  if ((await platform.clientRevision()) !== revision) return false;
  if (
    platform.store.read<{ revision: string }>("client-build.json")?.revision !== revision ||
    !existsSync(join(root, "apps/game/dist/sw.js"))
  )
    return false;
  await verifyPublishedClient(platform);
  return true;
}
export async function deployClient(platform: Platform, revision: string) {
  if (!platform.apply) throw new Error("Dry run cannot deploy the client");
  const env = clientEnvironment(platform, revision);
  await requireReleaseTree(revision);
  await command({ argv: ["pnpm", "run", "build:packages"] });
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
  platform.store.write("client-build.json", { revision });
  if ((await platform.clientRevision()) !== revision)
    await command({
      argv: [
        "pnpm",
        "dlx",
        "wrangler@3",
        "pages",
        "deploy",
        "apps/game/dist",
        "--project-name",
        platform.target.pages,
        "--branch",
        "main",
        "--commit-hash",
        revision,
      ],
      env: cloudflare,
    });
  await verifyPublishedClient(platform);
}
