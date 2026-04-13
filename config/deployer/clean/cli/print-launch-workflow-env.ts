#!/usr/bin/env bun
import { buildLaunchRequest, parseArgs } from "./launch-request";
import { renderLaunchWorkflowEnvironmentExports } from "./launch-workflow-env";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  process.stdout.write(`${renderLaunchWorkflowEnvironmentExports(buildLaunchRequest(args))}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
