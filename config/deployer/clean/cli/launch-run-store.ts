#!/usr/bin/env bun
import * as fs from "node:fs";
import {
  recordFactoryLaunchStarted,
  recordFactoryLaunchStepFailed,
  recordFactoryLaunchStepStarted,
  recordFactoryLaunchStepSucceeded,
  type LaunchWorkflowScope,
} from "../run-store";
import {
  buildFactoryRunRequestContext,
  parseArgs,
  resolveLaunchGameStepId,
  resolveLaunchWorkflowScope,
} from "./launch-request";

type LaunchRunStoreEvent = "launch-started" | "step-started" | "step-succeeded" | "step-failed";

function usage(): void {
  console.log(
    [
      "",
      "Usage:",
      "  bun config/deployer/clean/cli/launch-run-store.ts --event <launch-started|step-started|step-succeeded|step-failed> --environment <slot.blitz|slot.eternum> --game <world-name> --start-time <unix|iso>",
      "",
      "Required for step events:",
      "  --step <create-world|wait-for-factory-index|configure-world|grant-lootchest-role|grant-village-pass-role|create-banks|create-indexer>",
      "",
      "Optional flags:",
      "  --launch-step <full|create-world|wait-for-factory-index|configure-world|grant-lootchest-role|grant-village-pass-role|create-banks|create-indexer>",
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

function resolveEventStepId(event: LaunchRunStoreEvent, stepValue?: string) {
  if (event === "launch-started") {
    return undefined;
  }

  return resolveLaunchGameStepId(stepValue);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true") {
    usage();
    return;
  }

  const event = resolveLaunchRunStoreEvent(args.event);
  const requestedLaunchStep: LaunchWorkflowScope = resolveLaunchWorkflowScope(args["launch-step"]);
  const request = buildFactoryRunRequestContext(args, requestedLaunchStep);
  const stepId = resolveEventStepId(event, args.step);
  const options = {
    branch: args.branch,
  };

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
    message.includes('Unsupported run-store event "') ||
    message.includes('Unsupported launch step "')
  ) {
    usage();
  }
  console.error(message);
  process.exit(1);
});
