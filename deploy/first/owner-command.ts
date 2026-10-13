import { PublicError, deploymentStage, reportFailure } from "./errors";
import { requireInstalledDependencies } from "./process";

async function main() {
  const [command] = process.argv.splice(2, 1);
  if (command !== "setup" && command !== "season") throw new PublicError("Choose setup or season");
  deploymentStage(`${command} prerequisites`);
  requireInstalledDependencies();
  const entry = command === "setup" ? await import("./main") : await import("./season");
  await entry.main();
}

if (import.meta.main) main().catch(reportFailure);
