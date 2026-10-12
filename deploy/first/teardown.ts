import { boxCommand } from "./box";
import { deploymentRevision } from "./revision";
import { environments } from "./settings";
import { reportFailure } from "./deploy";
import { PublicError, deploymentStage } from "./errors";

async function main() {
  if (process.argv.slice(2).join() !== "dev") throw new PublicError("Teardown is available only for dev");
  deploymentStage("teardown dev");
  console.log(await boxCommand(environments.dev, await deploymentRevision("dev"), "teardown dev"));
}

if (import.meta.main) main().catch(reportFailure);
