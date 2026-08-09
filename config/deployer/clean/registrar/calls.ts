import appchainManifest from "../../../../contracts/game/manifest_appchain.json";
import { Account, CallData, type Call } from "starknet";
import { loadRepoJsonFile } from "../shared/repo";

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
}

const DEFAULT_MANIFEST = appchainManifest as RegistrarManifest;
const APPCHAIN_NAMESPACE = "s2_blitz";

function resolveRegistrarManifest(): RegistrarManifest {
  const manifestPath = process.env.APPCHAIN_MANIFEST_PATH;
  return manifestPath ? loadRepoJsonFile<RegistrarManifest>(manifestPath) : DEFAULT_MANIFEST;
}

function findContract(manifest: RegistrarManifest, contractName: string): ManifestContract | undefined {
  return manifest.contracts?.find((contract) => contract.tag === `${APPCHAIN_NAMESPACE}-${contractName}`);
}

function abiIncludesEntrypoint(entries: ManifestAbiEntry[] | undefined, entrypoint: string): boolean {
  return Boolean(
    entries?.some(
      (entry) =>
        (entry.type === "function" && entry.name === entrypoint) || abiIncludesEntrypoint(entry.items, entrypoint),
    ),
  );
}

function requireRegistrarContract(manifest: RegistrarManifest, entrypoint: RegistrarEntrypoint): ManifestContract {
  const registrar = findContract(manifest, "registrar_systems");
  if (!registrar?.address) {
    throw new Error(
      `${APPCHAIN_NAMESPACE}-registrar_systems is missing from the appchain manifest; migrate the s2 world first`,
    );
  }
  if (!registrar.systems?.includes(entrypoint) && !abiIncludesEntrypoint(registrar.abi, entrypoint)) {
    throw new Error(`registrar_systems manifest is missing ${entrypoint}`);
  }
  return registrar;
}

function buildRegistrarCall(
  entrypoint: RegistrarEntrypoint,
  calldata: string[],
  manifest: RegistrarManifest = resolveRegistrarManifest(),
): Call {
  const registrar = requireRegistrarContract(manifest, entrypoint);
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

async function executeRegistrarCall(account: Account, call: Call): Promise<RegistrarTransactionResult> {
  const transaction = await account.execute(call);
  const receipt = await account.waitForTransaction(transaction.transaction_hash);
  if (!transactionSucceeded(receipt)) {
    throw new Error(`${call.entrypoint} failed for transaction ${transaction.transaction_hash}`);
  }
  return { transactionHash: transaction.transaction_hash, receipt };
}

function normalizeFelt(value: string): string {
  return `0x${BigInt(value).toString(16)}`;
}

function resolveGameCreatedSelector(manifest: RegistrarManifest): string | undefined {
  const selector = manifest.events?.find((event) => event.tag === `${APPCHAIN_NAMESPACE}-GameCreated`)?.selector;
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
  manifest: RegistrarManifest = resolveRegistrarManifest(),
): number | undefined {
  const gameCreatedSelector = resolveGameCreatedSelector(manifest);
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

export function resolveAppchainWorldAddress(manifest: RegistrarManifest = resolveRegistrarManifest()): string {
  requireRegistrarContract(manifest, "create_game");
  if (!manifest.world?.address) {
    throw new Error("World address is missing from contracts/game/manifest_appchain.json");
  }
  return manifest.world.address;
}

export function resolveAppchainContractAddress(
  contractName: string,
  manifest: RegistrarManifest = resolveRegistrarManifest(),
): string {
  const contract = findContract(manifest, contractName);
  if (!contract?.address) {
    throw new Error(`${APPCHAIN_NAMESPACE}-${contractName} is missing from the appchain manifest`);
  }
  return contract.address;
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

export function assertAppchainRegistrarAvailable(manifest: RegistrarManifest = resolveRegistrarManifest()): void {
  const requiredEntrypoints: RegistrarEntrypoint[] = [
    "bootstrap_chain_config",
    "register_preset",
    "register_series",
    "create_game",
  ];
  requiredEntrypoints.forEach((entrypoint) => requireRegistrarContract(manifest, entrypoint));
}

export async function bootstrapChainConfig(
  account: Account,
  chainConfig: unknown,
): Promise<RegistrarTransactionResult> {
  return executeRegistrarCall(
    account,
    buildRegistrarCall("bootstrap_chain_config", CallData.compile([chainConfig] as never)),
  );
}

export async function registerPreset(
  account: Account,
  payload: { presetConfig: unknown; gameConfig: unknown; sideTables: unknown },
): Promise<RegistrarTransactionResult> {
  return executeRegistrarCall(account, buildRegistrarCall("register_preset", buildRegisterPresetCalldata(payload)));
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
    ),
  );
}

export async function createRegistrarGame(account: Account, params: unknown): Promise<CreateRegistrarGameResult> {
  const result = await executeRegistrarCall(
    account,
    buildRegistrarCall("create_game", buildCreateGameCalldata(params)),
  );
  return {
    ...result,
    gameId: resolveCreatedGameId(result.receipt),
  };
}

export function isRegistrarAlreadyInitializedError(error: unknown): boolean {
  return /chain config already initialized/i.test(error instanceof Error ? error.message : String(error));
}

export function isRegistrarAlreadyRegisteredError(error: unknown): boolean {
  return /(preset|series) already registered/i.test(error instanceof Error ? error.message : String(error));
}
