#!/usr/bin/env bun
import { buildLaunchGameRequest, parseArgs } from "./launch-request";
import { DEFAULT_MADARA_PRESET_ID } from "../constants";
import { launchGame } from "../launch/runner";

function usage(): void {
  console.log(
    [
      "",
      "Usage:",
      "  bun config/deployer/clean/cli/create.ts --environment madara.blitz --game <world-name> --start-time <unix|iso>",
      "  bun config/deployer/clean/cli/create.ts --config-path <path-to-launch.yaml>",
      "",
      "Optional env or flags:",
      "  GAME_LAUNCH_CONFIG_PATH / --config-path",
      "  RPC_URL / --rpc-url",
      "  DOJO_ACCOUNT_ADDRESS / --account-address",
      "  DOJO_PRIVATE_KEY / --private-key",
      "  VERBOSE_CONFIG_LOGS=true / --verbose-config-logs",
      "  DEV_MODE_ON=true|false / --dev-mode-on true|false",
      "  SINGLE_REALM_MODE=true|false / --single-realm-mode true|false",
      "  TWO_PLAYER_MODE=true|false / --two-player-mode true|false",
      "  DURATION_SECONDS=<integer> / --duration-seconds <integer>",
      "                               overrides config duration; used by blitz season end_at",
      "  MAP_CONFIG_OVERRIDES_JSON=<json> / --map-config-overrides-json <json>",
      "  BLITZ_REGISTRATION_OVERRIDES_JSON=<json> / --blitz-registration-overrides-json <json>",
      "  --mode <batched|sequential>",
      `  --version <felt>              default: ${DEFAULT_MADARA_PRESET_ID}`,
      "  --series-name <value>",
      "  --series-game-number <number>",
      "  --dry-run",
      "",
      "Examples:",
      "  bun config/deployer/clean/cli/create.ts --environment madara.blitz --game bltz-lab-96 --start-time 2026-08-25T12:00:00Z",
      "",
    ].join("\n"),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true") {
    usage();
    return;
  }

  const summary = await launchGame(buildLaunchGameRequest(args));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  if (message.includes("--environment, --game, and --start-time are required")) {
    usage();
  }
  console.error(message);
  process.exit(1);
});
