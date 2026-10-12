import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { command } from "./process";
import { PrivateStore } from "./private-store";
import { Platform } from "./platform";
import { deployWorkers, deployClient } from "./publish";
import { archivedRevision, deploymentRevision } from "./revision";
import { environments, root, type Inputs } from "./settings";
import { deploymentEnvironment, reportFailure } from "./deploy";
import { PublicError } from "./errors";

async function publish(environment: string | undefined, directory: string | undefined, revision: string | undefined) {
  const target = deploymentEnvironment(environment);
  if (!directory || !revision || !/^[0-9a-f]{40}$/.test(revision))
    throw new PublicError("A private directory and commit are required");
  const store = new PrivateStore(directory, root, true);
  const inputs = store.read<Inputs>("inputs.json");
  if (!inputs?.cloudflareToken || !inputs.rpc) throw new PublicError("Run setup before publishing Cloudflare");
  const platform = new Platform(environments[target], inputs, store, true);
  const unlock = store.lock();
  try {
    console.log(`Cloudflare deployment commit ${revision}.`);
    await deployWorkers(platform, revision);
    await deployClient(platform, revision);
  } finally {
    unlock();
  }
}

async function main() {
  const [environment, directory, ...extra] = process.argv.slice(2);
  if (extra.length)
    throw new PublicError("Usage: pnpm run deploy:cloudflare <dev|production> /absolute/private-directory");
  const target = deploymentEnvironment(environment);
  if (!directory)
    throw new PublicError("Usage: pnpm run deploy:cloudflare <dev|production> /absolute/private-directory");
  const commit = await deploymentRevision(target);
  if (archivedRevision()) return publish(target, directory, commit);
  const exported = mkdtempSync(join(tmpdir(), "realms-deploy-"));
  try {
    await command({ argv: ["git", "archive", "--format=tar", "--output", join(exported, "source.tar"), commit] });
    await command({ argv: ["tar", "-xf", "source.tar"], cwd: exported });
    await command({ argv: ["pnpm", "install", "--frozen-lockfile", "--ignore-scripts"], cwd: exported });
    console.log(
      await command({
        argv: ["bun", "--no-env-file", "deploy/first/cloudflare.ts", target, directory],
        cwd: exported,
      }),
    );
  } finally {
    rmSync(exported, { recursive: true, force: true });
  }
}

if (import.meta.main) main().catch(reportFailure);
