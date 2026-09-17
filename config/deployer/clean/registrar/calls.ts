import { nativeDomainAbi } from "../world/native/manifest";
import type { NativeWorldManifest } from "../world/native/types";
import type { buildNativePreset } from "../config/native-preset";
import { resolveGameTransactionResourceBounds } from "@bibliothecadao/eternum";
import { Account, CallData, type Call, type RawArgs } from "starknet";
import { resolveDeploymentEnvironment } from "../environment";
import { openLedgerGame, type LedgerTarget } from "../ledger/calls";
import { loadRepoJsonFile } from "../shared/repo";
import type { DeploymentEnvironmentId } from "../types";

type RegistrarEntrypoint =
  | "bootstrap_chain_config"
  | "register_preset"
  | "register_series"
  | "create_game"
  | "backfill_completed_hyperstructures";

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

export type RegistrarManifest = NativeWorldManifest;

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
}

const DEFAULT_ENVIRONMENT_ID: RegistrarEnvironmentId = "madara.blitz";

function resolveRegistrarContext(target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID): RegistrarContext {
  if (typeof target !== "string") {
    nativeDomainAbi(target, "registry");
    return { manifest: target };
  }
  const path = process.env.NATIVE_WORLD_MANIFEST;
  if (!path) throw new Error("NATIVE_WORLD_MANIFEST is required");
  const manifest = loadRepoJsonFile<RegistrarManifest>(path);
  nativeDomainAbi(manifest, "registry");
  return { environmentId: target, manifest };
}

function registrarContract(context: RegistrarContext): ManifestContract {
  return {
    address: context.manifest.native.domains.registry.address,
    abi: nativeDomainAbi(context.manifest, "registry") as ManifestAbiEntry[],
  };
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
  const registrar = registrarContract(context);
  const registrarAddress = registrar.address;
  if (!registrar || !hasDeployedAddress(registrarAddress)) {
    if (context.environmentId) {
      throw new Error(
        `${context.environmentId} world not deployed yet; set its registrar address after migrating ${context.manifest.world?.seed ?? "the configured profile"}`,
      );
    }
    throw new Error(`Native registry is missing from the manifest`);
  }
  if (!registrar.systems?.includes(entrypoint) && !abiIncludesEntrypoint(registrar.abi, entrypoint)) {
    throw new Error(`Native registry ABI is missing ${entrypoint}`);
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

function readReceiptEvents(receipt: unknown): Array<{ from_address?: string; keys?: string[]; data?: string[] }> {
  const events = (receipt as { events?: unknown }).events;
  return Array.isArray(events) ? (events as Array<{ from_address?: string; keys?: string[]; data?: string[] }>) : [];
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
  const context = resolveRegistrarContext(target);
  return resolveNativeCreatedGameId(receipt, context.manifest);
}

function resolveNativeCreatedGameId(receipt: unknown, manifest: NativeWorldManifest): number | undefined {
  const schema = manifest.native.schemas[manifest.native.activeSchema];
  const model = schema.models.find((model) => model.name === "GameRegistry");
  const layouts = schema.domains.season.events.filter((event) => event.name === "RowSet");
  if (!model || !layouts.length) throw new Error("Native manifest has no game registry event");
  for (const event of readReceiptEvents(receipt)) {
    if (!event.from_address || BigInt(event.from_address) !== BigInt(manifest.native.domains.season.address)) continue;
    const keys = event.keys ?? [];
    if (
      !layouts.some(
        (layout) =>
          keys.length === layout.prefix.length + 2 &&
          layout.prefix.every((key, index) => BigInt(key) === BigInt(keys[index])),
      )
    )
      continue;
    if (BigInt(keys.at(-2)!) !== 1n || BigInt(keys.at(-1)!) !== BigInt(model.identity)) continue;
    const data = event.data ?? [];
    if (BigInt(data[0] ?? 0) !== 1n || Number(BigInt(data[2] ?? -1)) !== data.length - 3) continue;
    return parseGameId(data[1]);
  }
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
  const requiredEntrypoints: RegistrarEntrypoint[] = ["register_preset", "register_series", "create_game"];
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
  nativeDefinition?: ReturnType<typeof buildNativePreset>,
): Promise<CreateRegistrarGameResult> {
  const context = resolveRegistrarContext(target);
  if (!nativeDefinition) throw new Error("Native game creation requires its immutable preset definition");
  const calldata = new CallData(nativeDomainAbi(context.manifest, "registry")).compile("create_game", {
    params: params as RawArgs,
    definition: nativeDefinition,
  });
  const result = await executeRegistrarCall(account, buildRegistrarCall("create_game", calldata, target), target);
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

export async function backfillCompletedHyperstructures(
  account: Account,
  gameId: number,
  startIndex: number,
  ids: number[],
  target: RegistrarTarget,
): Promise<RegistrarTransactionResult> {
  const calldata = CallData.compile([gameId, startIndex, ids]);
  return executeRegistrarCall(
    account,
    buildRegistrarCall("backfill_completed_hyperstructures", calldata, target),
    target,
  );
}
