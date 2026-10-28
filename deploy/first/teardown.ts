import { boxCommand } from "./box";
import { deploymentRevision } from "./revision";
import { environments, type Environment } from "./settings";
import { reportFailure } from "./deploy";
import { PublicError, deploymentStage } from "./errors";
import { shell } from "./process";

const USAGE =
  "Usage: pnpm run teardown dev [/opt/athanor/backups/NAME] | pnpm run teardown production /opt/athanor/backups/NAME";

/**
 * The box's teardown arguments: the environment and the backup the box verifies before removing its shard, which
 * production always needs and dev takes to rehearse production's path.
 */
export function teardownArguments(args: string[]): { environment: Environment; invocation: string } {
  const [environment, backup, ...extra] = args;
  if (environment === "dev" && backup === undefined) return { environment, invocation: "teardown dev" };
  if (
    (environment === "dev" || environment === "production") &&
    backup !== undefined &&
    !extra.length &&
    /^\/opt\/athanor\/backups\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(backup)
  )
    return { environment, invocation: `teardown ${environment} ${shell(backup)}` };
  throw new PublicError(USAGE);
}

async function main() {
  const { environment, invocation } = teardownArguments(process.argv.slice(2));
  deploymentStage(`teardown ${environment}`);
  console.log(await boxCommand(environments[environment], await deploymentRevision(environment), invocation));
}

if (import.meta.main) main().catch(reportFailure);
