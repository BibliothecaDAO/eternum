#!/usr/bin/env bun
import { DEFAULT_MAX_ACTIONS, DEFAULT_VERSION } from "../constants";
import { runLaunchStep } from "../launch/runner";
import { buildLaunchGameRequest, parseArgs, resolveLaunchGameStepId } from "./launch-request";

function usage(): void {
  console.log(
    [
      "",
      "Usage:",
      "  bun config/deployer/clean/cli/launch-step.ts --step <create-world|wait-for-factory-index|configure-world|grant-lootchest-role|grant-village-pass-role|create-banks|create-indexer|sync-paymaster> --environment <slot.blitz|slot.eternum|mainnet.blitz|mainnet.eternum> --game <world-name> --start-time <unix|iso>",
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
      `  --max-actions <number>        default: ${DEFAULT_MAX_ACTIONS}`,
      "  --factory-address <0x...>     override the environment default",
      "  --series-name <value>",
      "  --series-game-number <number>",
      "  --skip-indexer",
      "  --skip-lootchest-role-grant",
      "  --skip-banks",
      "  --dry-run",
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

  const stepId = resolveLaunchGameStepId(args.step);
  const summary = await runLaunchStep({
    ...buildLaunchGameRequest(args),
    stepId,
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  if (
    message.includes("--environment, --game, and --start-time are required") ||
    message.includes('Unsupported launch step "')
  ) {
    usage();
  }
  console.error(message);
  process.exit(1);
});
