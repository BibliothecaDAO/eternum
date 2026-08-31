import { resolveGameTransactionResourceBounds } from "@bibliothecadao/eternum";
import { Account, CallData, type Call } from "starknet";
import { resolveDeploymentEnvironment } from "../environment";
import { openLedgerGame, type LedgerTarget } from "../ledger/calls";
import { loadRepoJsonFile } from "../shared/repo";
import type { DeploymentEnvironmentId, WorldDeployment } from "../types";

type RegistrarEntrypoint = "bootstrap_chain_config" | "register_preset" | "register_series" | "create_game";

interface ManifestAbiEntry {
  type?: string;
  name?: string;
  items?: ManifestAbiEntry[];
}

interface ManifestContract {
  tag?: string;
  address?: string;
  abi?: ManifestAbiEntry[];
  systems?: string[];
}

interface ManifestEvent {
  tag?: string;
  selector?: string;
}

export interface RegistrarManifest {
  world?: {
    address?: string;
    seed?: string;
  };
  contracts?: ManifestContract[];
  events?: ManifestEvent[];
}

export interface RegistrarTransactionResult {
  transactionHash: string;
  receipt: unknown;
}

export interface CreateRegistrarGameResult extends RegistrarTransactionResult {
  gameId?: number;
  openLedgerTxHash?: string;
}

export interface RegistrarLedgerGameTarget {
  account: Account;
  target: LedgerTarget;
  presetId: number;
  start: number;
  end: number;
}

export type RegistrarEnvironmentId = DeploymentEnvironmentId;
type RegistrarTarget = RegistrarEnvironmentId | RegistrarManifest;

interface RegistrarContext {
  environmentId?: RegistrarEnvironmentId;
  manifest: RegistrarManifest;
  registrarAddress?: string;
}

const DEFAULT_ENVIRONMENT_ID: RegistrarEnvironmentId = "appchain.blitz";
const APPCHAIN_NAMESPACE = "s2";

function resolveEnvironmentManifest(deployment: WorldDeployment): RegistrarManifest {
  const manifestPath = process.env.GAME_MANIFEST_PATH || deployment.manifestPath;
  return loadRepoJsonFile<RegistrarManifest>(manifestPath);
}

function resolveRegistrarContext(target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID): RegistrarContext {
  if (typeof target !== "string") {
    return { manifest: target };
  }

  const environment = resolveDeploymentEnvironment(target);
  return {
    environmentId: target,
    manifest: resolveEnvironmentManifest(environment.world),
    registrarAddress: process.env.GAME_MANIFEST_PATH ? undefined : environment.world.registrarAddress,
  };
}

function findContract(context: RegistrarContext, contractName: string): ManifestContract | undefined {
  return context.manifest.contracts?.find((contract) => contract.tag === `${APPCHAIN_NAMESPACE}-${contractName}`);
}

function hasDeployedAddress(address: string | undefined): address is string {
  return typeof address === "string" && address.length > 0 && !/^0x0*$/i.test(address);
}

function abiIncludesEntrypoint(entries: ManifestAbiEntry[] | undefined, entrypoint: string): boolean {
  return Boolean(
    entries?.some(
      (entry) =>
        (entry.type === "function" && entry.name === entrypoint) || abiIncludesEntrypoint(entry.items, entrypoint),
    ),
  );
}

function requireRegistrarContract(context: RegistrarContext, entrypoint: RegistrarEntrypoint): ManifestContract {
  const registrar = findContract(context, "registrar_systems");
  const registrarAddress = context.registrarAddress ?? registrar?.address;
  if (!registrar || !hasDeployedAddress(registrarAddress)) {
    if (context.environmentId) {
      throw new Error(
        `${context.environmentId} world not deployed yet; set its registrar address after migrating ${context.manifest.world?.seed ?? "the configured profile"}`,
      );
    }
    throw new Error(
      `${APPCHAIN_NAMESPACE}-registrar_systems is missing from the appchain manifest; migrate the s2 world first`,
    );
  }
  if (!registrar.systems?.includes(entrypoint) && !abiIncludesEntrypoint(registrar.abi, entrypoint)) {
    throw new Error(`registrar_systems manifest is missing ${entrypoint}`);
  }
  return { ...registrar, address: registrarAddress };
}

function buildRegistrarCall(
  entrypoint: RegistrarEntrypoint,
  calldata: string[],
  target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID,
): Call {
  const registrar = requireRegistrarContract(resolveRegistrarContext(target), entrypoint);
  return {
    contractAddress: registrar.address!,
    entrypoint,
    calldata,
  };
}

function transactionSucceeded(receipt: unknown): boolean {
  const helper = receipt as { isSuccess?: () => boolean; execution_status?: string };
  if (typeof helper.isSuccess === "function") {
    return helper.isSuccess();
  }
  return !helper.execution_status || helper.execution_status === "SUCCEEDED";
}

// The revert reason must ride in the thrown error: the idempotency matchers (isRegistrarAlreadyInitializedError,
// isRegistrarAlreadyRegisteredError) test the message, so a bare "failed for transaction 0x…" hides the on-chain
// assert and turns an expected already-initialized/-registered revert into a hard failure.
function receiptRevertReason(receipt: unknown): string | undefined {
  const reason = (receipt as { revert_reason?: unknown }).revert_reason;
  return typeof reason === "string" && reason.length > 0 ? reason : undefined;
}

export function resolveRegistrarExecutionDetails(target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID) {
  const chain = typeof target === "string" ? resolveDeploymentEnvironment(target).chain : "appchain";
  const resourceBounds = resolveGameTransactionResourceBounds(chain);
  return {
    version: 3 as const,
    tip: 0,
    ...(resourceBounds ? { resourceBounds } : {}),
  };
}

async function executeRegistrarCall(
  account: Account,
  call: Call,
  target: RegistrarTarget,
): Promise<RegistrarTransactionResult> {
  const transaction = await account.execute(call, resolveRegistrarExecutionDetails(target));
  const receipt = await account.waitForTransaction(transaction.transaction_hash);
  if (!transactionSucceeded(receipt)) {
    const reason = receiptRevertReason(receipt);
    throw new Error(
      `${call.entrypoint} failed for transaction ${transaction.transaction_hash}${reason ? `: ${reason}` : ""}`,
    );
  }
  return { transactionHash: transaction.transaction_hash, receipt };
}

function normalizeFelt(value: string): string {
  return `0x${BigInt(value).toString(16)}`;
}

function resolveGameCreatedSelector(context: RegistrarContext): string | undefined {
  const selector = context.manifest.events?.find(
    (event) => event.tag === `${APPCHAIN_NAMESPACE}-GameCreated`,
  )?.selector;
  return selector ? normalizeFelt(selector) : undefined;
}

function readReceiptEvents(receipt: unknown): Array<{ keys?: string[]; data?: string[] }> {
  const events = (receipt as { events?: unknown }).events;
  return Array.isArray(events) ? (events as Array<{ keys?: string[]; data?: string[] }>) : [];
}

function parseGameId(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const gameId = Number(BigInt(value));
  return Number.isSafeInteger(gameId) && gameId > 0 ? gameId : undefined;
}

export function resolveCreatedGameId(
  receipt: unknown,
  target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID,
): number | undefined {
  const gameCreatedSelector = resolveGameCreatedSelector(resolveRegistrarContext(target));
  if (!gameCreatedSelector) {
    return undefined;
  }

  for (const event of readReceiptEvents(receipt)) {
    const keys = event.keys?.map(normalizeFelt) ?? [];
    const selectorIndex = keys.indexOf(gameCreatedSelector);
    if (selectorIndex === 0) {
      return parseGameId(event.keys?.[1]);
    }
    if (selectorIndex > 0 && Number(BigInt(event.data?.[0] ?? "0")) > 0) {
      return parseGameId(event.data?.[1]);
    }
  }

  return undefined;
}

export function resolveRegistrarWorldAddress(target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID): string {
  const context = resolveRegistrarContext(target);
  requireRegistrarContract(context, "create_game");
  const worldAddress = context.manifest.world?.address;
  if (!hasDeployedAddress(worldAddress)) {
    throw new Error("World address is missing from the selected manifest");
  }
  return worldAddress;
}

export function resolveRegistrarContractAddress(
  contractName: string,
  target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID,
): string {
  const contract = findContract(resolveRegistrarContext(target), contractName);
  const contractAddress = contract?.address;
  if (!hasDeployedAddress(contractAddress)) {
    throw new Error(`${APPCHAIN_NAMESPACE}-${contractName} is missing from the appchain manifest`);
  }
  return contractAddress;
}

export function resolveRegistrarEnvironmentId(environmentId: DeploymentEnvironmentId): RegistrarEnvironmentId {
  return environmentId;
}

export function buildRegisterPresetCalldata(payload: {
  presetConfig: unknown;
  gameConfig: unknown;
  sideTables: unknown;
}): string[] {
  return CallData.compile([payload.presetConfig, payload.gameConfig, payload.sideTables] as never);
}

export function buildCreateGameCalldata(params: unknown): string[] {
  return CallData.compile([params] as never);
}

export function assertRegistrarAvailable(target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID): void {
  const context = resolveRegistrarContext(target);
  const requiredEntrypoints: RegistrarEntrypoint[] = [
    "bootstrap_chain_config",
    "register_preset",
    "register_series",
    "create_game",
  ];
  requiredEntrypoints.forEach((entrypoint) => requireRegistrarContract(context, entrypoint));
}

export async function bootstrapChainConfig(
  account: Account,
  chainConfig: unknown,
  target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID,
): Promise<RegistrarTransactionResult> {
  return executeRegistrarCall(
    account,
    buildRegistrarCall("bootstrap_chain_config", CallData.compile([chainConfig] as never), target),
    target,
  );
}

export async function registerPreset(
  account: Account,
  payload: { presetConfig: unknown; gameConfig: unknown; sideTables: unknown },
  target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID,
): Promise<RegistrarTransactionResult> {
  return executeRegistrarCall(
    account,
    buildRegistrarCall("register_preset", buildRegisterPresetCalldata(payload), target),
    target,
  );
}

export async function registerSeries(
  account: Account,
  params: {
    seriesId: string;
    owner: string;
    numGames: number;
    totalChests?: bigint | number;
    capRatioBps?: bigint | number;
  },
  target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID,
): Promise<RegistrarTransactionResult> {
  return executeRegistrarCall(
    account,
    buildRegistrarCall(
      "register_series",
      CallData.compile([
        params.seriesId,
        params.owner,
        params.numGames,
        params.totalChests ?? 0,
        params.capRatioBps ?? 10_000,
      ] as never),
      target,
    ),
    target,
  );
}

export async function createRegistrarGame(
  account: Account,
  params: unknown,
  target: RegistrarTarget,
  ledger?: RegistrarLedgerGameTarget,
): Promise<CreateRegistrarGameResult> {
  const result = await executeRegistrarCall(
    account,
    buildRegistrarCall("create_game", buildCreateGameCalldata(params), target),
    target,
  );
  const gameId = resolveCreatedGameId(result.receipt, target);
  const ledgerResult =
    gameId && ledger
      ? await openLedgerGame(ledger.account, ledger.target, gameId, ledger.presetId, ledger.start, ledger.end)
      : null;
  return {
    ...result,
    gameId,
    openLedgerTxHash: ledgerResult?.transactionHash,
  };
}

export function isRegistrarAlreadyInitializedError(error: unknown): boolean {
  return /chain config already initialized/i.test(error instanceof Error ? error.message : String(error));
}

export function isRegistrarAlreadyRegisteredError(error: unknown): boolean {
  return /(preset|series) already registered/i.test(error instanceof Error ? error.message : String(error));
}
