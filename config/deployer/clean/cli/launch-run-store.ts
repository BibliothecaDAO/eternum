#!/usr/bin/env bun
import * as fs from "node:fs";
import {
  recordFactoryRotationLaunchStarted,
  recordFactoryRotationLaunchStepFailed,
  recordFactoryRotationLaunchStepStarted,
  recordFactoryRotationLaunchStepSucceeded,
  recordFactoryLaunchStarted,
  recordFactoryLaunchStepFailed,
  recordFactoryLaunchStepStarted,
  recordFactoryLaunchStepSucceeded,
  recordFactorySeriesLaunchStarted,
  recordFactorySeriesLaunchStepFailed,
  recordFactorySeriesLaunchStepStarted,
  recordFactorySeriesLaunchStepSucceeded,
  type LaunchWorkflowScope,
  type RotationLaunchWorkflowScope,
  type SeriesLaunchWorkflowScope,
} from "../run-store";
import {
  buildFactoryRunRequestContext,
  buildFactoryRotationRunRequestContext,
  buildFactorySeriesRunRequestContext,
  parseArgs,
  resolveLaunchGameStepId,
  resolveLaunchKind,
  resolveLaunchRotationStepId,
  resolveLaunchSeriesStepId,
  resolveLaunchWorkflowScope,
  resolveRotationLaunchWorkflowScope,
  resolveSeriesLaunchWorkflowScope,
} from "./launch-request";

type LaunchRunStoreEvent = "launch-started" | "step-started" | "step-succeeded" | "step-failed";

function usage(): void {
  console.log(
    [
      "",
      "Usage:",
      "  bun config/deployer/clean/cli/launch-run-store.ts --launch-kind <game|series|rotation> --event <launch-started|step-started|step-succeeded|step-failed> --environment <slot.blitz|slot.eternum|mainnet.blitz|mainnet.eternum>",
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
      "Required for step events:",
      "  --step <single-game-step-id|series-step-id>",
      "",
      "Optional flags:",
      "  --launch-step <full|...>",
      "  --map-config-overrides-json <json>",
      "  --blitz-registration-overrides-json <json>",
      "  --error-message <message>",
      "  --error-message-file <path>",
      "  --branch <factory-runs>",
      "",
    ].join("\n"),
  );
}

function resolveLaunchRunStoreEvent(value?: string): LaunchRunStoreEvent {
  switch (value) {
    case "launch-started":
    case "step-started":
    case "step-succeeded":
    case "step-failed":
      return value;
    default:
      throw new Error(
        `Unsupported run-store event "${value}". Expected one of: launch-started, step-started, step-succeeded, step-failed`,
      );
  }
}

function readErrorMessage(args: ReturnType<typeof parseArgs>): string | undefined {
  if (args["error-message"]) {
    return args["error-message"];
  }

  if (!args["error-message-file"]) {
    return undefined;
  }

  return fs.readFileSync(args["error-message-file"], "utf8").trim() || undefined;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true") {
    usage();
    return;
  }

  const event = resolveLaunchRunStoreEvent(args.event);
  const launchKind = resolveLaunchKind(args);
  const options = {
    branch: args.branch,
  };

  if (launchKind === "rotation") {
    const requestedLaunchStep: RotationLaunchWorkflowScope = resolveRotationLaunchWorkflowScope(args["launch-step"]);
    const request = buildFactoryRotationRunRequestContext(args, requestedLaunchStep);
    const stepId = event === "launch-started" ? undefined : resolveLaunchRotationStepId(args.step);

    switch (event) {
      case "launch-started":
        await recordFactoryRotationLaunchStarted(request, options);
        return;
      case "step-started":
        await recordFactoryRotationLaunchStepStarted(
          {
            ...request,
            stepId,
          },
          options,
        );
        return;
      case "step-succeeded":
        await recordFactoryRotationLaunchStepSucceeded(
          {
            ...request,
            stepId,
          },
          options,
        );
        return;
      case "step-failed":
        await recordFactoryRotationLaunchStepFailed(
          {
            ...request,
            stepId,
            errorMessage: readErrorMessage(args),
          },
          options,
        );
        return;
    }
  }

  if (launchKind === "series") {
    const requestedLaunchStep: SeriesLaunchWorkflowScope = resolveSeriesLaunchWorkflowScope(args["launch-step"]);
    const request = buildFactorySeriesRunRequestContext(args, requestedLaunchStep);
    const stepId = event === "launch-started" ? undefined : resolveLaunchSeriesStepId(args.step);

    switch (event) {
      case "launch-started":
        await recordFactorySeriesLaunchStarted(request, options);
        return;
      case "step-started":
        await recordFactorySeriesLaunchStepStarted(
          {
            ...request,
            stepId,
          },
          options,
        );
        return;
      case "step-succeeded":
        await recordFactorySeriesLaunchStepSucceeded(
          {
            ...request,
            stepId,
          },
          options,
        );
        return;
      case "step-failed":
        await recordFactorySeriesLaunchStepFailed(
          {
            ...request,
            stepId,
            errorMessage: readErrorMessage(args),
          },
          options,
        );
        return;
    }
  }

  const requestedLaunchStep: LaunchWorkflowScope = resolveLaunchWorkflowScope(args["launch-step"]);
  const request = buildFactoryRunRequestContext(args, requestedLaunchStep);
  const stepId = event === "launch-started" ? undefined : resolveLaunchGameStepId(args.step);

  switch (event) {
    case "launch-started":
      await recordFactoryLaunchStarted(request, options);
      return;
    case "step-started":
      await recordFactoryLaunchStepStarted(
        {
          ...request,
          stepId,
        },
        options,
      );
      return;
    case "step-succeeded":
      await recordFactoryLaunchStepSucceeded(
        {
          ...request,
          stepId,
        },
        options,
      );
      return;
    case "step-failed":
      await recordFactoryLaunchStepFailed(
        {
          ...request,
          stepId,
          errorMessage: readErrorMessage(args),
        },
        options,
      );
      return;
  }
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
    message.includes('Unsupported run-store event "') ||
    message.includes('Unsupported launch step "') ||
    message.includes('Unsupported series launch step "') ||
    message.includes('Unsupported launch kind "')
  ) {
    usage();
  }
  console.error(message);
  process.exit(1);
});
