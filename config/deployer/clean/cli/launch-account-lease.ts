#!/usr/bin/env bun
import {
  acquireFactoryAccountLease,
  FactoryAccountLeaseBusyError,
  heartbeatFactoryAccountLease,
  releaseFactoryAccountLeaseRecord,
} from "../run-store";
import type { DeploymentEnvironmentId } from "../types";
import { resolveOptionalArg } from "./args";
import { parseArgs, resolveLaunchGameStepId } from "./launch-request";

type LaunchAccountLeaseEvent = "acquire" | "heartbeat" | "release";

function usage(): void {
  console.log(
    [
      "",
      "Usage:",
      "  bun config/deployer/clean/cli/launch-account-lease.ts --event <acquire|heartbeat|release> --environment <slot.blitz|slot.eternum|mainnet.blitz|mainnet.eternum> --game <world-name> --step <step-id>",
      "",
      "Required flags:",
      "  --step <create-world|wait-for-factory-index|configure-world|grant-lootchest-role|grant-village-pass-role|create-banks|create-indexer|sync-paymaster>",
      "",
      "Optional flags:",
      "  --account-address <0x...>    Defaults to DOJO_ACCOUNT_ADDRESS",
      "  --lease-id <uuid>           Required for heartbeat and release",
      "  --branch <factory-runs>",
      "",
    ].join("\n"),
  );
}

function resolveLaunchAccountLeaseEvent(value?: string): LaunchAccountLeaseEvent {
  switch (value) {
    case "acquire":
    case "heartbeat":
    case "release":
      return value;
    default:
      throw new Error(`Unsupported account lease event "${value}". Expected one of: acquire, heartbeat, release`);
  }
}

function requireAccountAddress(args: ReturnType<typeof parseArgs>): string {
  const accountAddress = resolveOptionalArg(args, "account-address", ["DOJO_ACCOUNT_ADDRESS"]);
  if (!accountAddress) {
    throw new Error("--account-address is required when DOJO_ACCOUNT_ADDRESS is not set");
  }

  return accountAddress;
}

function requireFactoryAccountLeaseArgs(args: ReturnType<typeof parseArgs>) {
  const environmentId = args.environment;
  const gameName = args.game;

  if (!environmentId || !gameName) {
    throw new Error("--environment and --game are required");
  }

  return {
    environmentId: environmentId as DeploymentEnvironmentId,
    gameName,
  };
}

function requireLeaseId(event: LaunchAccountLeaseEvent, args: ReturnType<typeof parseArgs>): string | undefined {
  if (event === "acquire") {
    return args["lease-id"];
  }

  if (!args["lease-id"]) {
    throw new Error(`--lease-id is required for ${event}`);
  }

  return args["lease-id"];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true") {
    usage();
    return;
  }

  const event = resolveLaunchAccountLeaseEvent(args.event);
  const requiredArgs = requireFactoryAccountLeaseArgs(args);
  const stepId = resolveLaunchGameStepId(args.step);
  const accountAddress = requireAccountAddress(args);
  const leaseId = requireLeaseId(event, args);
  const options = {
    branch: args.branch,
  };

  const leaseRequest = {
    ...requiredArgs,
    stepId,
    accountAddress,
    leaseId,
  } as const;

  switch (event) {
    case "acquire": {
      const lease = await acquireFactoryAccountLease(leaseRequest, options);
      console.log(lease.owner.leaseId);
      return;
    }
    case "heartbeat":
      await heartbeatFactoryAccountLease(leaseRequest, options);
      return;
    case "release":
      await releaseFactoryAccountLeaseRecord(leaseRequest, options);
      return;
  }
}

main().catch((error: unknown) => {
  if (error instanceof FactoryAccountLeaseBusyError) {
    console.error(error.message);
    process.exit(2);
  }

  const message = error instanceof Error ? error.stack || error.message : String(error);
  if (
    message.includes("--environment and --game are required") ||
    message.includes('Unsupported account lease event "') ||
    message.includes('Unsupported launch step "') ||
    message.includes("--account-address is required") ||
    message.includes("--lease-id is required")
  ) {
    usage();
  }
  console.error(message);
  process.exit(1);
});
