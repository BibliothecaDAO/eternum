#!/usr/bin/env bun
import { resolveDeploymentEnvironment } from "../environment";
import { parseArgs, resolveOptionalArg, type CliArgs } from "./args";

function usage(): void {
  console.log(
    [
      "",
      "Usage:",
      "  bun config/deployer/clean/cli/print-create-game-max-actions.ts --environment <slot.blitz|slot.eternum|mainnet.blitz|mainnet.eternum>",
      "",
      "Optional env:",
      "  GAME_LAUNCH_ENVIRONMENT",
      "",
    ].join("\n"),
  );
}

function requireEnvironmentId(args: CliArgs): string {
  const environmentId = resolveOptionalArg(args, "environment", ["GAME_LAUNCH_ENVIRONMENT"]);
  if (!environmentId) {
    throw new Error("--environment or GAME_LAUNCH_ENVIRONMENT is required");
  }

  return environmentId;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true") {
    usage();
    return;
  }

  const environment = resolveDeploymentEnvironment(requireEnvironmentId(args));
  process.stdout.write(String(environment.createGame.maxActions));
}

main();
