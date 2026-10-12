import { deploymentRevision } from "./revision";
import { deployShard } from "./box";
import { environments, type Environment } from "./settings";
import { PublicError } from "./dates";
import { CommandFailure } from "./process";

export function deploymentEnvironment(value: string | undefined): Environment {
  if (value !== "dev" && value !== "production") throw new PublicError("Choose dev or production");
  return value;
}

export function reportFailure(error: unknown): void {
  if (error instanceof PublicError) console.error(error.message);
  else if (error instanceof CommandFailure && error.log) console.error(`Command failed; log: ${error.log}`);
  else console.error(`Deployment failed: ${error instanceof Error ? error.name : "unknown"}`);
  process.exitCode = 1;
}

async function main() {
  const [environment, ...extra] = process.argv.slice(2);
  if (extra.length) throw new PublicError("Usage: pnpm run deploy <dev|production>");
  const target = deploymentEnvironment(environment);
  const revision = await deploymentRevision(target);
  console.log(`Deployment commit ${revision}.`);
  await deployShard(environments[target], revision, console.log);
}

if (import.meta.main) main().catch(reportFailure);
