#!/usr/bin/env bun
import { DEFAULT_MAINNET_MAX_ACTIONS, DEFAULT_SLOT_MAX_ACTIONS, DEFAULT_VERSION } from "../constants";
import { runLaunchStep } from "../launch/runner";
import { runLaunchRotationStep } from "../launch/rotation-runner";
import { runLaunchSeriesStep } from "../launch/series-runner";
import { requireGitHubBranchStoreConfig, readGitHubBranchJsonFile } from "../run-store/github";
import { resolveFactoryRotationRunRecordPath, resolveFactorySeriesRunRecordPath } from "../run-store/paths";
import type { FactoryRotationRunRecord, FactorySeriesRunRecord } from "../run-store/types";
import type { LaunchRotationRequest, LaunchSeriesRequest } from "../types";
import {
  buildLaunchGameRequest,
  buildLaunchRotationRequest,
  buildLaunchSeriesRequest,
  parseArgs,
  resolveLaunchGameStepId,
  resolveLaunchKind,
  resolveLaunchRotationStepId,
  resolveLaunchSeriesStepId,
} from "./launch-request";

function usage(): void {
  console.log(
    [
      "",
      "Usage:",
      "  bun config/deployer/clean/cli/launch-step.ts --launch-kind <game|series|rotation> --step <step-id> --environment <slot.blitz|slot.eternum|mainnet.blitz|mainnet.eternum>",
      "",
      "Game launch:",
      "  --game <world-name> --start-time <unix|iso>",
      "",
      "Series launch:",
      "  --series-name <series-name> --series-games-json <json-array>",
      "",
      "Rotation launch:",
      "  --rotation-name <rotation-name> --first-game-start-time <unix|iso> --game-interval-minutes <n> --max-games <n> --evaluation-interval-minutes <n>",
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
      "  MAP_CONFIG_OVERRIDES_JSON=<json> / --map-config-overrides-json <json>",
      "  BLITZ_REGISTRATION_OVERRIDES_JSON=<json> / --blitz-registration-overrides-json <json>",
      "  --auto-retry-enabled <true|false>",
      "  --auto-retry-interval-minutes <number>",
      "  --mode <batched|sequential>",
      `  --version <felt>              default: ${DEFAULT_VERSION}`,
      `  --max-actions <number>        default: slot ${DEFAULT_SLOT_MAX_ACTIONS}, mainnet ${DEFAULT_MAINNET_MAX_ACTIONS}`,
      "  --skip-indexer",
      "  --skip-lootchest-role-grant",
      "  --skip-banks",
      "  --dry-run",
      "",
    ].join("\n"),
  );
}

async function resolveSeriesResumeSummary(request: LaunchSeriesRequest) {
  const config = requireGitHubBranchStoreConfig();
  const { value } = await readGitHubBranchJsonFile<FactorySeriesRunRecord>(
    config,
    resolveFactorySeriesRunRecordPath({
      environmentId: request.environmentId,
      seriesName: request.seriesName,
    }),
  );

  return value?.summary;
}

async function resolveRotationResumeSummary(request: LaunchRotationRequest) {
  const config = requireGitHubBranchStoreConfig();
  const { value } = await readGitHubBranchJsonFile<FactoryRotationRunRecord>(
    config,
    resolveFactoryRotationRunRecordPath({
      environmentId: request.environmentId,
      rotationName: request.rotationName,
    }),
  );

  return value?.summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true") {
    usage();
    return;
  }

  if (resolveLaunchKind(args) === "series") {
    const request = buildLaunchSeriesRequest(args);
    const summary = await runLaunchSeriesStep({
      ...request,
      stepId: resolveLaunchSeriesStepId(args.step),
      resumeSummary: request.resumeSummary || (await resolveSeriesResumeSummary(request)),
    });
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (resolveLaunchKind(args) === "rotation") {
    const request = buildLaunchRotationRequest(args);
    const summary = await runLaunchRotationStep({
      ...request,
      stepId: resolveLaunchRotationStepId(args.step),
      resumeSummary: request.resumeSummary || (await resolveRotationResumeSummary(request)),
    });
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const summary = await runLaunchStep({
    ...buildLaunchGameRequest(args),
    stepId: resolveLaunchGameStepId(args.step),
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  if (
    message.includes("--environment, --game, and --start-time are required") ||
    message.includes("--environment and --series-name are required for series launches") ||
    message.includes(
      "--environment, --rotation-name, --first-game-start-time, --game-interval-minutes, --max-games, and --evaluation-interval-minutes are required for rotation launches",
    ) ||
    message.includes("--series-games-json is required for series launches") ||
    message.includes('Unsupported launch step "') ||
    message.includes('Unsupported series launch step "') ||
    message.includes('Unsupported launch kind "')
  ) {
    usage();
  }
  console.error(message);
  process.exit(1);
});
