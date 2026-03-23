#!/usr/bin/env bun
import { buildLaunchGameRequest, parseArgs } from "./launch-request";
import { DEFAULT_MAINNET_MAX_ACTIONS, DEFAULT_SLOT_MAX_ACTIONS, DEFAULT_VERSION } from "../constants";
import { launchGame } from "../launch/runner";

function usage(): void {
  console.log(
    [
      "",
      "Usage:",
      "  bun config/deployer/clean/cli/create.ts --environment <slot.blitz|slot.eternum|mainnet.blitz|mainnet.eternum> --game <world-name> --start-time <unix|iso>",
      "",
      "Optional env or flags:",
      "  RPC_URL / --rpc-url",
      "  FACTORY_ADDRESS / --factory-address",
      "  DOJO_ACCOUNT_ADDRESS / --account-address",
      "  DOJO_PRIVATE_KEY / --private-key",
      "  VITE_PUBLIC_VRF_PROVIDER_ADDRESS / --vrf-provider-address",
      "  TORII_NAMESPACES / --torii-namespaces",
      "  CARTRIDGE_API_BASE / --cartridge-api-base",
      "  GITHUB_TOKEN",
      "  GITHUB_REPOSITORY",
      "  --workflow-file <factory-torii-deployer.yml>",
      "  --ref <git-ref>",
      "  Local fallback: if GITHUB_TOKEN is unset, the clean deployer will try gh auth token",
      "                  and log that it did so. If GITHUB_REPOSITORY is unset, it will try",
      "                  gh repo view. If ref is unset, it will try the current git branch.",
      "  VERBOSE_CONFIG_LOGS=true / --verbose-config-logs",
      "  DEV_MODE_ON=true|false / --dev-mode-on true|false",
      "  SINGLE_REALM_MODE=true|false / --single-realm-mode true|false",
      "  TWO_PLAYER_MODE=true|false / --two-player-mode true|false",
      "  DURATION_SECONDS=<integer> / --duration-seconds <integer>",
      "                               overrides config duration; used by blitz season end_at",
      "  MAP_CONFIG_OVERRIDES_JSON=<json> / --map-config-overrides-json <json>",
      "  BLITZ_REGISTRATION_OVERRIDES_JSON=<json> / --blitz-registration-overrides-json <json>",
      "  --mode <batched|sequential>",
      `  --version <felt>              default: ${DEFAULT_VERSION}`,
      `  --max-actions <number>        default: slot ${DEFAULT_SLOT_MAX_ACTIONS}, mainnet ${DEFAULT_MAINNET_MAX_ACTIONS}`,
      "  --factory-address <0x...>     override the environment default",
      "  --series-name <value>",
      "  --series-game-number <number>",
      "  --skip-indexer",
      "  --skip-lootchest-role-grant",
      "  --skip-banks",
      "  --dry-run",
      "",
      "Examples:",
      "  bun config/deployer/clean/cli/create.ts --environment slot.blitz --game bltz-fire-gate-42 --start-time 1763112600",
      "  bun config/deployer/clean/cli/create.ts --environment slot.eternum --game etrn-iron-mist-11 --start-time 2025-11-14T09:30:00Z",
      "  bun config/deployer/clean/cli/create.ts --environment mainnet.eternum --game etrn-iron-mist-11 --start-time 2025-11-14T09:30:00Z",
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
