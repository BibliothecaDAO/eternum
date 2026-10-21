import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { command, requireInstalledDependencies } from "./process";
import { PrivateStore } from "./private-store";
import { archivedRevision, deploymentRevision } from "./revision";
import { environments, root, type Inputs } from "./settings";
import { deploymentEnvironment, reportFailure } from "./deploy";
import { PublicError, deploymentStage } from "./errors";
import { ADMIN_ACCESS, type AdminAccess } from "./admin-access";
import type { Platform } from "./platform";

/**
 * Where a commit is exported, installed and built: several GB, so on the checkout's own disk. The system temp directory
 * can be a small tmpfs that other work shares, and a full one stops the publish part-way.
 */
const EXPORTS = join(root, ".context", "deploy-exports");

/**
 * The private directory of a finished setup: its inputs, and the admin's Access, without which the admin Worker's deploy
 * fails after the Workers before it are already live. Refused before anything is exported or deployed.
 */
export function setUpDirectory(directory: string) {
  const store = new PrivateStore(directory, root, true);
  const inputs = store.read<Inputs>("inputs.json");
  if (!inputs?.cloudflareToken || !inputs.rpc) throw new PublicError("Run setup before publishing Cloudflare");
  if (!store.read<AdminAccess>(ADMIN_ACCESS)?.audience)
    throw new PublicError("Admin access is not set up yet; run setup with --apply before publishing Cloudflare");
  return { store, inputs };
}

/**
 * Every resource setup creates for this environment, the docs' Pages site among them, before any Worker is replaced: a
 * site added to the deployment reaches an existing environment through setup, never through a failed publish.
 */
export async function requireCloudflareResources(platform: Platform) {
  if (!(await platform.resourcesPresent()))
    throw new PublicError("Cloudflare resources are missing; run setup with --apply before publishing Cloudflare");
}

async function publish(environment: string | undefined, directory: string | undefined, revision: string | undefined) {
  const target = deploymentEnvironment(environment);
  deploymentStage("publish Cloudflare");
  if (!directory || !revision || !/^[0-9a-f]{40}$/.test(revision))
    throw new PublicError("A private directory and commit are required");
  const { store, inputs } = setUpDirectory(directory);
  requireInstalledDependencies();
  const { Platform } = await import("./platform");
  const { deployWorkers, deployClient, deployDocs } = await import("./publish");
  const platform = new Platform(environments[target], inputs, store, true);
  const unlock = store.lock();
  try {
    console.log(`Cloudflare deployment commit ${revision}.`);
    await requireCloudflareResources(platform);
    await deployWorkers(platform, revision);
    await deployClient(platform, revision);
    await deployDocs(platform, revision);
  } finally {
    unlock();
  }
}

async function main() {
  const [environment, directory, ...extra] = process.argv.slice(2);
  if (extra.length)
    throw new PublicError("Usage: pnpm run deploy:cloudflare <dev|production> /absolute/private-directory");
  const target = deploymentEnvironment(environment);
  deploymentStage("publish Cloudflare");
  if (!directory)
    throw new PublicError("Usage: pnpm run deploy:cloudflare <dev|production> /absolute/private-directory");
  setUpDirectory(directory);
  const commit = await deploymentRevision(target);
  if (archivedRevision()) return publish(target, directory, commit);
  mkdirSync(EXPORTS, { recursive: true });
  const exported = mkdtempSync(join(EXPORTS, "realms-deploy-"));
  try {
    await command({ argv: ["git", "archive", "--format=tar", "--output", join(exported, "source.tar"), commit] });
    await command({ argv: ["tar", "-xf", "source.tar"], cwd: exported });
    await command({ argv: ["pnpm", "install", "--frozen-lockfile", "--ignore-scripts"], cwd: exported });
    const child = Bun.spawn(["bun", "--no-env-file", "deploy/first/cloudflare.ts", target, directory], {
      cwd: exported,
      stdin: "ignore",
      stdout: "inherit",
      stderr: "inherit",
    });
    process.exitCode = await child.exited;
  } finally {
    rmSync(exported, { recursive: true, force: true });
  }
}

if (import.meta.main) main().catch(reportFailure);
