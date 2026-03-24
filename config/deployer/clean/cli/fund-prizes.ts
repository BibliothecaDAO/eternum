#!/usr/bin/env bun
import { Account, RpcProvider } from "starknet";
import { DEFAULT_CARTRIDGE_API_BASE } from "../constants";
import { resolveDeploymentEnvironment } from "../environment";
import { resolvePrizeDistributionAddressForFactoryGame } from "../factory/prize-distribution-address";
import {
  resolveDefaultSeriesLikePrizeFundingGameNames,
  resolveGamePrizeFundingReadiness,
  resolveSelectedSeriesLikePrizeFundingGameNames,
} from "../prize-funding-readiness";
import {
  recordFactoryGamePrizeFundingSucceeded,
  recordFactoryRotationPrizeFundingSucceeded,
  recordFactorySeriesPrizeFundingSucceeded,
} from "../run-store/prize-funding";
import { requireGitHubBranchStoreConfig, readGitHubBranchJsonFile } from "../run-store/github";
import {
  resolveFactoryRunRecordPath,
  resolveFactorySeriesRunRecordPath,
  resolveFactoryRotationRunRecordPath,
} from "../run-store/paths";
import type {
  FactoryLaunchInputRecord,
  FactoryRotationLaunchInputRecord,
  FactoryRotationRunRecord,
  FactoryRunRecord,
  FactorySeriesLaunchInputRecord,
  FactorySeriesRunRecord,
} from "../run-store/types";
import { resolveCommonAddressesPath } from "../shared/addresses";
import { ensureRepoDirectory, loadRepoJsonFile, writeRepoJsonFile } from "../shared/repo";
import { toSafeSlug } from "../shared/slug";
import type { LaunchGameRequest, LaunchRotationRequest, LaunchSeriesRequest, PrizeFundingTransfer } from "../types";
import { parseArgs } from "./args";

type PrizeFundingRunKind = "game" | "series" | "rotation";
type PrizeFundingInputRecord =
  | FactoryLaunchInputRecord
  | FactorySeriesLaunchInputRecord
  | FactoryRotationLaunchInputRecord;
type PrizeFundingRunRecord = FactoryRunRecord | FactorySeriesRunRecord | FactoryRotationRunRecord;

interface PrizeFundingTarget {
  gameName: string;
  prizeAddress: string;
}

interface ResolvedPrizeFundingPlan {
  environmentId: string;
  runKind: PrizeFundingRunKind;
  runName: string;
  chain: "slot" | "mainnet";
  rpcUrl: string;
  cartridgeApiBase: string;
  accountAddress: string;
  privateKey: string;
  selectedGameNames: string[];
  tokenAddress: string;
  amountDisplay: string;
  amountRaw: bigint;
  decimals: number;
  targets: PrizeFundingTarget[];
}

interface PrizeFundingTransactionResult {
  transactionHash: string;
  fundedAt: string;
}

interface PrizeFundingCliArgs {
  environmentId: string;
  runKind: PrizeFundingRunKind;
  runName: string;
  amountDisplay: string;
  selectedGameNames: string[];
}

function usage() {
  console.log(
    [
      "",
      "Usage:",
      "  bun config/deployer/clean/cli/fund-prizes.ts --environment <slot.blitz|mainnet.blitz|slot.eternum|mainnet.eternum> --run-kind <game|series|rotation> --run-name <name> --amount <tokens>",
      "",
      "Optional:",
      "  --selected-games-json <json-array-of-game-names>",
      "  --rpc-url <override>",
      "  --account-address <override>",
      "  --private-key <override>",
      "  --cartridge-api-base <override>",
      "",
    ].join("\n"),
  );
}

function resolveCliArgs() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help === "true") {
    usage();
    process.exit(0);
  }

  const environmentId = args.environment;
  const runKind = resolveRunKind(args["run-kind"]);
  const runName = args["run-name"];
  const amountDisplay = args.amount;

  if (!environmentId || !runName || !amountDisplay) {
    throw new Error("--environment, --run-kind, --run-name, and --amount are required");
  }

  return {
    environmentId,
    runKind,
    runName,
    amountDisplay,
    selectedGameNames: parseSelectedGameNames(args["selected-games-json"]),
  } satisfies PrizeFundingCliArgs;
}

function resolveRunKind(value: string | undefined): PrizeFundingRunKind {
  if (value === "game" || value === "series" || value === "rotation") {
    return value;
  }

  throw new Error(`Unsupported run kind "${value}". Expected "game", "series", or "rotation"`);
}

function parseSelectedGameNames(value: string | undefined) {
  if (!value) {
    return [];
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(value);
  } catch {
    throw new Error("--selected-games-json must be valid JSON");
  }

  if (!Array.isArray(parsedValue) || parsedValue.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new Error("--selected-games-json must be a JSON array of non-empty strings");
  }

  return parsedValue.map((gameName) => gameName.trim());
}

function buildRpcProvider(rpcUrl: string, chain: "slot" | "mainnet") {
  const chainId = chain === "mainnet" ? "0x534e5f4d41494e" : undefined;
  return chainId ? new RpcProvider({ nodeUrl: rpcUrl, chainId }) : new RpcProvider({ nodeUrl: rpcUrl });
}

function buildExecutionAccount(provider: RpcProvider, accountAddress: string, privateKey: string) {
  return new Account({
    provider,
    address: accountAddress,
    signer: privateKey,
  });
}

function parseDecimalAmountToRaw(amountDisplay: string, decimals: number) {
  const normalizedAmount = amountDisplay.trim();

  if (!/^\d+(\.\d+)?$/.test(normalizedAmount)) {
    throw new Error(`Invalid prize amount "${amountDisplay}"`);
  }

  const [wholePart, fractionalPart = ""] = normalizedAmount.split(".");

  if (fractionalPart.length > decimals) {
    throw new Error(`Prize amount "${amountDisplay}" exceeds token precision (${decimals} decimals)`);
  }

  const scale = 10n ** BigInt(decimals);
  const wholeUnits = BigInt(wholePart) * scale;
  const fractionalUnits = fractionalPart ? BigInt(fractionalPart.padEnd(decimals, "0")) : 0n;

  return wholeUnits + fractionalUnits;
}

function toUint256(value: bigint) {
  const mask = (1n << 128n) - 1n;

  return {
    low: `0x${(value & mask).toString(16)}`,
    high: `0x${(value >> 128n).toString(16)}`,
  };
}

function loadCommonAddresses(chain: string): Record<string, unknown> {
  return loadRepoJsonFile<Record<string, unknown>>(resolveCommonAddressesPath(chain));
}

function resolvePrizeTokenAddress(
  rawRequest: LaunchGameRequest | LaunchSeriesRequest | LaunchRotationRequest,
  chain: string,
) {
  const configuredToken = rawRequest.blitzRegistrationOverrides?.fee_token?.trim();

  if (configuredToken?.startsWith("0x")) {
    return configuredToken;
  }

  const commonAddresses = loadCommonAddresses(chain);

  if (configuredToken && typeof commonAddresses[configuredToken] === "string") {
    return String(commonAddresses[configuredToken]);
  }

  if (typeof commonAddresses.lords === "string" && commonAddresses.lords.trim()) {
    return commonAddresses.lords;
  }

  throw new Error(`Could not resolve a prize token address for chain "${chain}"`);
}

async function resolveTokenDecimals(provider: RpcProvider, tokenAddress: string) {
  const response = await provider.callContract(
    {
      contractAddress: tokenAddress,
      entrypoint: "decimals",
      calldata: [],
    },
    "latest",
  );

  const rawValue = response[0];
  const decimals = Number(rawValue);

  if (!Number.isFinite(decimals) || decimals < 0) {
    throw new Error(`Could not resolve token decimals for ${tokenAddress}`);
  }

  return decimals;
}

async function readRunRecordWithInput(runKind: PrizeFundingRunKind, environmentId: string, runName: string) {
  const config = requireGitHubBranchStoreConfig();
  const runRecordPath = resolveRunRecordPath(runKind, environmentId, runName);
  const { value: runRecord } = await readGitHubBranchJsonFile<PrizeFundingRunRecord>(config, runRecordPath);

  if (!runRecord) {
    throw new Error(`Could not find ${runKind} run "${runName}" in ${environmentId}`);
  }

  const { value: inputRecord } = await readGitHubBranchJsonFile<PrizeFundingInputRecord>(config, runRecord.inputPath);

  if (!inputRecord?.request) {
    throw new Error(`Could not find launch input for ${environmentId}/${runName}`);
  }

  return {
    runRecord,
    inputRecord,
  };
}

function resolveRunRecordPath(runKind: PrizeFundingRunKind, environmentId: string, runName: string) {
  if (runKind === "series") {
    return resolveFactorySeriesRunRecordPath({ environmentId, seriesName: runName });
  }

  if (runKind === "rotation") {
    return resolveFactoryRotationRunRecordPath({ environmentId, rotationName: runName });
  }

  return resolveFactoryRunRecordPath({ environmentId, gameName: runName });
}

function resolveGameRequest(
  inputRecord: PrizeFundingInputRecord,
): LaunchGameRequest | LaunchSeriesRequest | LaunchRotationRequest {
  return inputRecord.request;
}

function resolveRpcUrl(
  rawRequest: LaunchGameRequest | LaunchSeriesRequest | LaunchRotationRequest,
  environmentId: string,
) {
  return rawRequest.rpcUrl || resolveDeploymentEnvironment(environmentId as LaunchGameRequest["environmentId"]).rpcUrl;
}

function resolveExecutionCredentials(
  rawRequest: LaunchGameRequest | LaunchSeriesRequest | LaunchRotationRequest,
  cliArgs: Record<string, string>,
) {
  const accountAddress =
    cliArgs["account-address"] || rawRequest.accountAddress || process.env.DOJO_ACCOUNT_ADDRESS || "";
  const privateKey = cliArgs["private-key"] || rawRequest.privateKey || process.env.DOJO_PRIVATE_KEY || "";

  if (!accountAddress || !privateKey) {
    throw new Error("Missing DOJO_ACCOUNT_ADDRESS/DOJO_PRIVATE_KEY (or --account-address/--private-key)");
  }

  return {
    accountAddress,
    privateKey,
  };
}

function resolveCartridgeApiBase(
  rawRequest: LaunchGameRequest | LaunchSeriesRequest | LaunchRotationRequest,
  cliArgs: Record<string, string>,
) {
  return (
    cliArgs["cartridge-api-base"] ||
    rawRequest.cartridgeApiBase ||
    process.env.CARTRIDGE_API_BASE ||
    DEFAULT_CARTRIDGE_API_BASE
  );
}

function ensureGameRunReadyForPrizeFunding(runRecord: FactoryRunRecord) {
  const readiness = resolveGamePrizeFundingReadiness(runRecord);

  if (!readiness.ready) {
    throw new Error(readiness.reason ?? `Game "${runRecord.gameName}" is not ready for prize funding`);
  }
}

function buildDefaultSeriesSelection(runRecord: FactorySeriesRunRecord | FactoryRotationRunRecord) {
  return resolveDefaultSeriesLikePrizeFundingGameNames(runRecord);
}

function resolveSeriesLikeSelectedGames(
  runRecord: FactorySeriesRunRecord | FactoryRotationRunRecord,
  requestedGameNames: string[],
) {
  return resolveSelectedSeriesLikePrizeFundingGameNames(runRecord, requestedGameNames);
}

async function resolvePrizeFundingTargets(
  chain: "slot" | "mainnet",
  cartridgeApiBase: string,
  selectedGameNames: string[],
) {
  const targets: PrizeFundingTarget[] = [];

  for (const gameName of selectedGameNames) {
    const resolution = await resolvePrizeDistributionAddressForFactoryGame({
      chain,
      gameName,
      cartridgeApiBase,
    });

    targets.push({
      gameName,
      prizeAddress: resolution.prizeDistributionAddress,
    });
  }

  return targets;
}

async function resolvePrizeFundingPlan(cliArgs: PrizeFundingCliArgs, rawCliArgs: Record<string, string>) {
  const { runRecord, inputRecord } = await readRunRecordWithInput(
    cliArgs.runKind,
    cliArgs.environmentId,
    cliArgs.runName,
  );

  const rawRequest = resolveGameRequest(inputRecord);
  const rpcUrl = rawCliArgs["rpc-url"] || resolveRpcUrl(rawRequest, cliArgs.environmentId);
  const { accountAddress, privateKey } = resolveExecutionCredentials(rawRequest, rawCliArgs);
  const cartridgeApiBase = resolveCartridgeApiBase(rawRequest, rawCliArgs);
  const provider = buildRpcProvider(rpcUrl, runRecord.chain);
  const tokenAddress = resolvePrizeTokenAddress(rawRequest, runRecord.chain);
  const decimals = await resolveTokenDecimals(provider, tokenAddress);
  const amountRaw = parseDecimalAmountToRaw(cliArgs.amountDisplay, decimals);

  if (amountRaw <= 0n) {
    throw new Error("Prize amount must be greater than zero");
  }

  const selectedGameNames = resolveSelectedGameNamesForRun(runRecord, cliArgs.selectedGameNames);
  const targets = await resolvePrizeFundingTargets(runRecord.chain, cartridgeApiBase, selectedGameNames);

  return {
    environmentId: cliArgs.environmentId,
    runKind: cliArgs.runKind,
    runName: cliArgs.runName,
    chain: runRecord.chain,
    rpcUrl,
    cartridgeApiBase,
    accountAddress,
    privateKey,
    selectedGameNames,
    tokenAddress,
    amountDisplay: cliArgs.amountDisplay,
    amountRaw,
    decimals,
    targets,
  } satisfies ResolvedPrizeFundingPlan;
}

function resolveSelectedGameNamesForRun(runRecord: PrizeFundingRunRecord, requestedGameNames: string[]) {
  if (runRecord.kind === "series") {
    return resolveSeriesLikeSelectedGames(runRecord, requestedGameNames);
  }

  if (runRecord.kind === "rotation") {
    return resolveSeriesLikeSelectedGames(runRecord, requestedGameNames);
  }

  ensureGameRunReadyForPrizeFunding(runRecord);
  return [runRecord.gameName];
}

async function submitPrizeFundingTransaction(plan: ResolvedPrizeFundingPlan): Promise<PrizeFundingTransactionResult> {
  const provider = buildRpcProvider(plan.rpcUrl, plan.chain);
  const account = buildExecutionAccount(provider, plan.accountAddress, plan.privateKey);
  const amount = toUint256(plan.amountRaw);
  const calls = plan.targets.map((target) => ({
    contractAddress: plan.tokenAddress,
    entrypoint: "transfer",
    calldata: [target.prizeAddress, amount.low, amount.high],
  }));

  const transaction = await account.execute(calls);
  const receipt = await account.waitForTransaction(transaction.transaction_hash);
  const successfulReceipt =
    (typeof (receipt as { isSuccess?: () => boolean }).isSuccess === "function" &&
      (receipt as { isSuccess: () => boolean }).isSuccess()) ||
    (receipt as { execution_status?: string }).execution_status === "SUCCEEDED";

  if (!successfulReceipt) {
    throw new Error(`Prize funding transaction failed for ${transaction.transaction_hash}`);
  }

  return {
    transactionHash: transaction.transaction_hash,
    fundedAt: new Date().toISOString(),
  };
}

function buildPrizeFundingTransfer(
  plan: ResolvedPrizeFundingPlan,
  transactionResult: PrizeFundingTransactionResult,
): PrizeFundingTransfer {
  return {
    id: transactionResult.transactionHash,
    tokenAddress: plan.tokenAddress,
    amountRaw: plan.amountRaw.toString(),
    amountDisplay: plan.amountDisplay,
    decimals: plan.decimals,
    transactionHash: transactionResult.transactionHash,
    fundedAt: transactionResult.fundedAt,
  };
}

async function persistPrizeFundingLedger(
  plan: ResolvedPrizeFundingPlan,
  transfer: PrizeFundingTransfer,
): Promise<void> {
  if (plan.runKind === "series") {
    await recordFactorySeriesPrizeFundingSucceeded(
      {
        environmentId: plan.environmentId as FactorySeriesRunRecord["environment"],
        seriesName: plan.runName,
      },
      plan.selectedGameNames,
      transfer,
    );
    return;
  }

  if (plan.runKind === "rotation") {
    await recordFactoryRotationPrizeFundingSucceeded(
      {
        environmentId: plan.environmentId as FactoryRotationRunRecord["environment"],
        rotationName: plan.runName,
      },
      plan.selectedGameNames,
      transfer,
    );
    return;
  }

  await recordFactoryGamePrizeFundingSucceeded(
    {
      environmentId: plan.environmentId as FactoryRunRecord["environment"],
      gameName: plan.runName,
    },
    transfer,
  );
}

function writePrizeFundingArtifact(plan: ResolvedPrizeFundingPlan, transactionResult: PrizeFundingTransactionResult) {
  const outputDirectory = ensureRepoDirectory(`.context/factory-prize-funding/${plan.environmentId}`);
  const outputPath = `${outputDirectory}/${toSafeSlug(plan.runName)}.json`;

  writeRepoJsonFile(`.context/factory-prize-funding/${plan.environmentId}/${toSafeSlug(plan.runName)}.json`, {
    environment: plan.environmentId,
    runKind: plan.runKind,
    runName: plan.runName,
    selectedGameNames: plan.selectedGameNames,
    tokenAddress: plan.tokenAddress,
    amountDisplay: plan.amountDisplay,
    amountRaw: plan.amountRaw.toString(),
    decimals: plan.decimals,
    transactionHash: transactionResult.transactionHash,
    fundedAt: transactionResult.fundedAt,
    targets: plan.targets,
    outputPath,
  });

  return outputPath;
}

async function main() {
  const rawCliArgs = parseArgs(process.argv.slice(2));
  const cliArgs = resolveCliArgs();
  const plan = await resolvePrizeFundingPlan(cliArgs, rawCliArgs);
  const transactionResult = await submitPrizeFundingTransaction(plan);
  const transfer = buildPrizeFundingTransfer(plan, transactionResult);
  await persistPrizeFundingLedger(plan, transfer);
  const outputPath = writePrizeFundingArtifact(plan, transactionResult);

  console.log(
    JSON.stringify(
      {
        environment: plan.environmentId,
        runKind: plan.runKind,
        runName: plan.runName,
        selectedGameNames: plan.selectedGameNames,
        tokenAddress: plan.tokenAddress,
        amountDisplay: plan.amountDisplay,
        transactionHash: transactionResult.transactionHash,
        outputPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  if (
    message.includes("--environment, --run-kind, --run-name, and --amount are required") ||
    message.includes('Unsupported run kind "')
  ) {
    usage();
  }

  console.error(message);
  process.exit(1);
});
