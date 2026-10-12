import { deploymentRevision } from "./revision";
import { deployShard } from "./box";
import { environments, type Environment } from "./settings";
import { PublicError } from "./errors";
import { deploymentStage, reportFailure } from "./errors";
export { reportFailure } from "./errors";

export function deploymentEnvironment(value: string | undefined): Environment {
  if (value !== "dev" && value !== "production") throw new PublicError("Choose dev or production");
  return value;
}

async function main() {
  const [environment, ...extra] = process.argv.slice(2);
  if (extra.length) throw new PublicError("Usage: pnpm run deploy <dev|production>");
  const target = deploymentEnvironment(environment);
  deploymentStage("deploy shard");
  const revision = await deploymentRevision(target);
  console.log(`Deployment commit ${revision}.`);
  await deployShard(environments[target], revision, console.log);
}

if (import.meta.main) main().catch(reportFailure);
