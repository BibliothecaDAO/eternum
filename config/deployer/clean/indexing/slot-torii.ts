import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { DEFAULT_TORII_SLOT_TEAM, DEFAULT_TORII_VERSION } from "../constants";
import { ensureRepoDirectory, resolveRepoPath } from "../shared/repo";
import type { IndexerCreationMode, IndexerLiveState, IndexerRequest, IndexerTier } from "../types";

const SLOT_COMMAND_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const TORII_TEMPLATE_PATH = "contracts/game/torii-template.toml";
const TORII_OUTPUT_DIRECTORY = ".context/torii";
const DEFAULT_WORLD_BLOCK = "0";

type SlotCommandRunner = (args: string[]) => SpawnSyncReturns<string>;

export interface EnsureSlotIndexerOptions {
  onProgress?: (message: string) => void;
  slotCommandRunner?: SlotCommandRunner;
  slotTeam?: string;
  toriiVersion?: string;
}

export interface SlotIndexerActionResult {
  mode: IndexerCreationMode;
  action: "created" | "already-live" | "tier-updated" | "tier-already-matched";
  liveState: IndexerLiveState;
  requestedTier: IndexerTier;
  previousTier?: IndexerTier;
  configPath?: string;
}

export interface DeleteSlotIndexerResult {
  action: "deleted" | "already-missing";
  liveState: IndexerLiveState;
  previousTier?: IndexerTier;
}

export interface SlotToriiDeploymentInfo {
  gameName: string;
  serviceName: string;
}

export interface ResolvedIndexerArtifactState {
  indexerCreated: boolean;
  indexerTier?: IndexerTier;
  indexerUrl?: string;
  indexerVersion?: string;
  indexerBranch?: string;
  lastIndexerDescribeAt?: string;
}

function runSlotCommand(args: string[]): SpawnSyncReturns<string> {
  return spawnSync("slot", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: SLOT_COMMAND_MAX_BUFFER_BYTES,
    env: process.env,
  });
}

function normalizeCapturedOutput(output: string | null | undefined): string {
  return `${output || ""}`.trim();
}

function buildSlotCommandOutput(result: Pick<SpawnSyncReturns<string>, "stdout" | "stderr">): string {
  return [normalizeCapturedOutput(result.stderr), normalizeCapturedOutput(result.stdout)].filter(Boolean).join("\n");
}

function buildSlotCommandFailureMessage(action: string, result: SpawnSyncReturns<string>): string {
  if (result.error) {
    return `Failed to ${action}: ${result.error.message}`;
  }

  const exitCode = result.status ?? 1;
  const output = buildSlotCommandOutput(result);
  return output ? `Failed to ${action}: ${output}` : `Failed to ${action}: slot exited with code ${exitCode}`;
}

function captureDescribeValue(output: string, label: string): string | undefined {
  const match = output.match(new RegExp(`^${label}:\\s+(.+)$`, "im"));
  return match?.[1]?.trim();
}

function parseIndexerTier(value: string | undefined): IndexerTier | undefined {
  switch ((value || "").trim().toLowerCase()) {
    case "basic":
    case "pro":
    case "legendary":
    case "epic":
      return value!.trim().toLowerCase() as IndexerTier;
    default:
      return undefined;
  }
}

function parseDescribeLiveState(output: string): IndexerLiveState {
  const describedAt = new Date().toISOString();

  return {
    state: "existing",
    stateSource: "describe",
    currentTier: parseIndexerTier(captureDescribeValue(output, "Tier")),
    url: captureDescribeValue(output, "Url"),
    version: captureDescribeValue(output, "Version"),
    branch: captureDescribeValue(output, "Branch"),
    describedAt,
  };
}

function isNotFoundDescribeOutput(output: string): boolean {
  return /not found|code = NotFound|deployment .* not found/i.test(output);
}

function listOutputContainsToriiProject(output: string, projectName: string): boolean {
  let currentProject = "";

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("Project: ")) {
      currentProject = line.slice("Project: ".length).trim().split(/\s+/)[0] || "";
      continue;
    }

    if (line.startsWith("Service: ")) {
      const serviceName = line.slice("Service: ".length).trim().split(/\s+/)[0] || "";
      if (currentProject === projectName && serviceName === "torii") {
        return true;
      }
    }
  }

  return false;
}

function parseSlotAccountDeploymentLine(line: string): SlotToriiDeploymentInfo | null {
  const trimmedLine = line.trim();
  const match = trimmedLine.match(/^Deployment:\s+([^/\s]+)\/([^/\s]+)\s*$/i);

  if (!match) {
    return null;
  }

  return {
    gameName: match[1] || "",
    serviceName: (match[2] || "").toLowerCase(),
  };
}

export function listSlotToriiDeploymentNamesFromAccountInfo(output: string): string[] {
  const orderedGameNames: string[] = [];
  const seenGameNames = new Set<string>();

  for (const rawLine of output.split(/\r?\n/)) {
    const deployment = parseSlotAccountDeploymentLine(rawLine);
    if (!deployment || deployment.serviceName !== "torii" || !deployment.gameName) {
      continue;
    }

    if (seenGameNames.has(deployment.gameName)) {
      continue;
    }

    seenGameNames.add(deployment.gameName);
    orderedGameNames.push(deployment.gameName);
  }

  return orderedGameNames;
}

export function listSlotToriiDeploymentNames(
  options: Pick<EnsureSlotIndexerOptions, "slotCommandRunner"> = {},
): string[] {
  const slotCommandRunner = options.slotCommandRunner || runSlotCommand;
  const accountInfoResult = slotCommandRunner(["a", "info"]);

  if ((accountInfoResult.status ?? 1) !== 0) {
    throw new Error(buildSlotCommandFailureMessage("read Slot account deployments", accountInfoResult));
  }

  return listSlotToriiDeploymentNamesFromAccountInfo(accountInfoResult.stdout || "");
}

export function resolveSlotToriiLiveStates(
  gameNames: string[],
  options: Pick<EnsureSlotIndexerOptions, "onProgress" | "slotCommandRunner"> = {},
) {
  return gameNames.map((gameName) => ({
    gameName,
    liveState: resolveSlotToriiLiveState(gameName, options),
  }));
}

export function resolveSlotToriiLiveState(
  name: string,
  options: Pick<EnsureSlotIndexerOptions, "onProgress" | "slotCommandRunner"> = {},
): IndexerLiveState {
  const slotCommandRunner = options.slotCommandRunner || runSlotCommand;
  const describeResult = slotCommandRunner(["d", "describe", name, "torii"]);

  if ((describeResult.status ?? 1) === 0) {
    options.onProgress?.(`Resolved Torii state for ${name} via slot d describe`);
    return parseDescribeLiveState(describeResult.stdout || "");
  }

  const describeError = buildSlotCommandOutput(describeResult);

  if (isNotFoundDescribeOutput(describeError)) {
    options.onProgress?.(`Resolved Torii state for ${name} as missing via slot d describe`);
    return {
      state: "missing",
      stateSource: "describe-not-found",
      describeError,
    };
  }

  const listResult = slotCommandRunner(["d", "list"]);
  if ((listResult.status ?? 1) === 0) {
    const listOutput = listResult.stdout || "";
    if (listOutputContainsToriiProject(listOutput, name)) {
      options.onProgress?.(`Resolved Torii state for ${name} via slot d list fallback`);
      return {
        state: "existing",
        stateSource: "list",
        describeError,
      };
    }

    options.onProgress?.(`Resolved Torii state for ${name} as missing via slot d list fallback`);
    return {
      state: "missing",
      stateSource: "list",
      describeError,
    };
  }

  return {
    state: "indeterminate",
    stateSource: "describe-and-list-failed",
    describeError: [describeError, buildSlotCommandOutput(listResult)].filter(Boolean).join("\n"),
  };
}

function renderToriiConfig(request: IndexerRequest): string {
  const templatePath = resolveRepoPath(TORII_TEMPLATE_PATH);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing Torii template: ${TORII_TEMPLATE_PATH}`);
  }

  const relativeDirectory = path.join(TORII_OUTPUT_DIRECTORY, request.env, request.worldName);
  const outputDirectory = ensureRepoDirectory(relativeDirectory);
  const outputPath = path.resolve(outputDirectory, "torii.toml");
  const template = fs.readFileSync(templatePath, "utf8");
  const namespaces = request.namespaces
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => `"${value}"`)
    .join(", ");
  const contracts = (request.externalContracts || []).map((value) => value.trim()).filter(Boolean);
  const rendered = replaceToriiContractsPlaceholder(
    template
      .replaceAll("{RPC_URL}", request.rpcUrl)
      .replaceAll("{WORLD_ADDRESS}", request.worldAddress)
      .replaceAll("{WORLD_BLOCK}", DEFAULT_WORLD_BLOCK)
      .replaceAll("{NAMESPACE}", namespaces),
    contracts,
  );

  fs.writeFileSync(outputPath, rendered);
  return outputPath;
}

function replaceToriiContractsPlaceholder(template: string, contracts: string[]): string {
  return template
    .split(/\r?\n/)
    .map((line) => {
      if (!line.includes("{CONTRACTS}")) {
        return line;
      }

      const indent = line.match(/^\s*/)?.[0] || "";
      if (contracts.length === 0) {
        return indent;
      }

      return contracts.map((value) => `${indent}"${value}",`).join("\n");
    })
    .join("\n");
}

function requireExistingToriiState(
  name: string,
  options: Pick<EnsureSlotIndexerOptions, "onProgress" | "slotCommandRunner">,
) {
  const liveState = resolveSlotToriiLiveState(name, options);
  if (liveState.state !== "existing") {
    throw new Error(`Torii deployment "${name}" is not available after the Slot command completed`);
  }

  return liveState;
}

function requireMissingToriiState(
  name: string,
  options: Pick<EnsureSlotIndexerOptions, "onProgress" | "slotCommandRunner">,
) {
  const liveState = resolveSlotToriiLiveState(name, options);
  if (liveState.state !== "missing") {
    throw new Error(`Torii deployment "${name}" still exists after the Slot command completed`);
  }

  return liveState;
}

export function resolveIndexerArtifactState(
  liveState: IndexerLiveState,
  options: {
    fallbackTier?: IndexerTier;
  } = {},
): ResolvedIndexerArtifactState {
  return {
    indexerCreated: liveState.state === "existing",
    indexerTier: liveState.currentTier || options.fallbackTier,
    indexerUrl: liveState.url,
    indexerVersion: liveState.version,
    indexerBranch: liveState.branch,
    lastIndexerDescribeAt: liveState.describedAt,
  };
}

export function ensureSlotIndexerDeployment(
  request: IndexerRequest,
  options: EnsureSlotIndexerOptions = {},
): SlotIndexerActionResult {
  const requestedTier = request.tier || "basic";
  const slotCommandRunner = options.slotCommandRunner || runSlotCommand;
  const preExistingState = resolveSlotToriiLiveState(request.worldName, options);

  if (preExistingState.state === "existing") {
    return {
      mode: "slot-direct",
      action: "already-live",
      liveState: preExistingState,
      requestedTier,
      previousTier: preExistingState.currentTier,
    };
  }

  if (preExistingState.state === "indeterminate") {
    throw new Error(
      `Unable to verify whether Torii deployment "${request.worldName}" already exists. Refusing to create a duplicate while state is indeterminate.`,
    );
  }

  const configPath = renderToriiConfig(request);
  const slotTeam = options.slotTeam || DEFAULT_TORII_SLOT_TEAM;
  const toriiVersion = options.toriiVersion || DEFAULT_TORII_VERSION;
  const createResult = slotCommandRunner([
    "d",
    "create",
    "-f",
    "--team",
    slotTeam,
    "--tier",
    requestedTier,
    request.worldName,
    "torii",
    "--version",
    toriiVersion,
    "--config",
    configPath,
  ]);

  if ((createResult.status ?? 1) !== 0) {
    throw new Error(buildSlotCommandFailureMessage(`create Torii deployment "${request.worldName}"`, createResult));
  }

  const liveState = requireExistingToriiState(request.worldName, options);
  return {
    mode: "slot-direct",
    action: "created",
    liveState,
    requestedTier,
    previousTier: preExistingState.currentTier,
    configPath,
  };
}

export function ensureSlotIndexerTier(
  options: {
    name: string;
    tier: IndexerTier;
  } & Pick<EnsureSlotIndexerOptions, "onProgress" | "slotCommandRunner">,
): SlotIndexerActionResult {
  const currentState = resolveSlotToriiLiveState(options.name, options);

  if (currentState.state === "missing") {
    throw new Error(`Torii deployment "${options.name}" does not exist`);
  }

  if (currentState.state === "indeterminate") {
    throw new Error(`Unable to verify the Torii deployment state for "${options.name}"`);
  }

  if (currentState.currentTier === options.tier) {
    return {
      mode: "slot-direct",
      action: "tier-already-matched",
      liveState: currentState,
      requestedTier: options.tier,
      previousTier: currentState.currentTier,
    };
  }

  const slotCommandRunner = options.slotCommandRunner || runSlotCommand;
  const updateResult = slotCommandRunner(["d", "update", "--tier", options.tier, options.name, "torii"]);

  if ((updateResult.status ?? 1) !== 0) {
    throw new Error(buildSlotCommandFailureMessage(`update Torii tier for "${options.name}"`, updateResult));
  }

  const liveState = requireExistingToriiState(options.name, options);
  return {
    mode: "slot-direct",
    action: "tier-updated",
    liveState,
    requestedTier: options.tier,
    previousTier: currentState.currentTier,
  };
}

export function deleteSlotIndexerDeployment(
  options: {
    name: string;
  } & Pick<EnsureSlotIndexerOptions, "onProgress" | "slotCommandRunner">,
): DeleteSlotIndexerResult {
  const currentState = resolveSlotToriiLiveState(options.name, options);

  if (currentState.state === "missing") {
    return {
      action: "already-missing",
      liveState: currentState,
      previousTier: currentState.currentTier,
    };
  }

  if (currentState.state === "indeterminate") {
    throw new Error(`Unable to verify the Torii deployment state for "${options.name}"`);
  }

  const slotCommandRunner = options.slotCommandRunner || runSlotCommand;
  const deleteResult = slotCommandRunner(["d", "delete", options.name, "torii", "-f"]);

  if ((deleteResult.status ?? 1) !== 0) {
    throw new Error(buildSlotCommandFailureMessage(`delete Torii deployment "${options.name}"`, deleteResult));
  }

  const liveState = requireMissingToriiState(options.name, options);
  return {
    action: "deleted",
    liveState,
    previousTier: currentState.currentTier,
  };
}
