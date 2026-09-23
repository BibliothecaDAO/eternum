import { presetRegistrationCall } from "./native-preset";
import { confirmedTransactionReceipt } from "../shared/transaction";
import { completeNativeAdminCommand } from "../world/native/command";
import { nativeDomainAbi } from "../world/native/manifest";
import type { RegistrarWorld } from "../world/native/types";
import type { buildNativePreset } from "../config/native-preset";
import { resolveGameTransactionResourceBounds } from "@bibliothecadao/eternum";
import { Account, CallData, shortString, type Call, type RawArgs, RpcProvider } from "starknet";
import { loadRepoJsonFile } from "../shared/repo";
import type { DeploymentEnvironmentId } from "../types";

type RegistrarEntrypoint = "register_preset" | "create_game";

interface ManifestAbiEntry {
  type?: string;
  name?: string;
  items?: ManifestAbiEntry[];
}

interface ManifestContract {
  address?: string;
  abi?: ManifestAbiEntry[];
}

export type RegistrarManifest = RegistrarWorld;

export interface RegistrarTransactionResult {
  transactionHash: string;
  receipt: unknown;
}

export interface CreateRegistrarGameResult extends RegistrarTransactionResult {
  gameId?: number;
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
        `${context.environmentId} world is not deployed; set its registrar address in the native manifest`,
      );
    }
    throw new Error(`Native registry is missing from the manifest`);
  }
  if (!abiIncludesEntrypoint(registrar.abi, entrypoint)) {
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

export function resolveRegistrarExecutionDetails() {
  return {
    version: 3 as const,
    tip: 0,
    resourceBounds: resolveGameTransactionResourceBounds(),
  };
}

async function executeRegistrarCall(
  account: Account,
  call: Call,
  target: RegistrarTarget,
): Promise<RegistrarTransactionResult> {
  const transaction = await account.execute(call, resolveRegistrarExecutionDetails());
  const receipt = await confirmedTransactionReceipt(account, transaction.transaction_hash);
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

function resolveNativeCreatedGameId(receipt: unknown, manifest: RegistrarWorld): number | undefined {
  const schema = manifest.native.schemas[manifest.native.activeSchema];
  const model = schema.models.find((model) => model.name === "GameRegistry");
  const layouts = schema.domains.registry.events.filter((event) => event.name === "RowSet");
  if (!model || !layouts.length) throw new Error("Native manifest has no game registry event");
  for (const event of readReceiptEvents(receipt)) {
    if (!event.from_address || BigInt(event.from_address) !== BigInt(manifest.native.domains.registry.address))
      continue;
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

export async function findRegistrarGame(
  provider: RpcProvider,
  name: string,
  target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID,
): Promise<{ gameId: number } | null> {
  const { manifest } = resolveRegistrarContext(target);
  const [id] = await provider.callContract({
    contractAddress: manifest.native.domains.registry.address,
    entrypoint: "game_id_by_name",
    calldata: [shortString.encodeShortString(name)],
  });
  if (id === undefined) throw new Error("Registrar returned no game identity");
  const value = BigInt(id);
  if (value < 0n || value > 0xffffffffn) throw new Error("Registrar returned an invalid game identity");
  return value === 0n ? null : { gameId: Number(value) };
}

/**
 * A Blitz roster is its players' gameplay accounts: the contract authenticates each command through the account, so an
 * account needs no registry binding and need not be deployed yet. The roster keeps an owner field until the registry
 * goes; it carries the account.
 */
export function blitzRosterOf(accounts: readonly string[]) {
  if (accounts.length < 1 || accounts.length > 24) throw new Error("Blitz requires 1 to 24 registered players");
  const normalized = accounts.map((account) => {
    if (!/^0x[0-9a-f]+$/i.test(account) || BigInt(account) === 0n) throw new Error("Invalid roster account");
    return `0x${BigInt(account).toString(16)}`;
  });
  if (new Set(normalized).size !== normalized.length) throw new Error("Duplicate roster account");
  return normalized.map((account) => ({ owner: account, account }));
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

export function assertRegistrarAvailable(target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID): void {
  const context = resolveRegistrarContext(target);
  const requiredEntrypoints: RegistrarEntrypoint[] = ["register_preset", "create_game"];
  requiredEntrypoints.forEach((entrypoint) => requireRegistrarContract(context, entrypoint));
}

export async function createRegistrarGame(
  account: Account,
  params: unknown,
  target: RegistrarTarget,
  nativeDefinition?: ReturnType<typeof buildNativePreset>,
): Promise<CreateRegistrarGameResult> {
  const context = resolveRegistrarContext(target);
  if (!nativeDefinition) throw new Error("Native game creation requires its current preset definition");
  const presetId = Number((params as { preset_id: number }).preset_id);
  const registration = presetRegistrationCall(nativeDefinition, presetId, context.manifest);
  const [commitment] = await account.callContract(
    {
      contractAddress: registration.address,
      entrypoint: "preset_commitment",
      calldata: [presetId],
    },
    "latest",
  );
  if (commitment === undefined || BigInt(commitment) !== BigInt(registration.commitment))
    throw new Error("Current preset differs from the launch configuration; reload its balance before creating a game");
  const calldata = new CallData(nativeDomainAbi(context.manifest, "registry")).compile("create_game", {
    params: params as RawArgs,
    definition: nativeDefinition,
  });
  const result = await executeRegistrarCall(account, buildRegistrarCall("create_game", calldata, target), target);
  return { ...result, gameId: resolveCreatedGameId(result.receipt, target) };
}

export async function settleBlitzRoster(
  provider: RpcProvider,
  gameId: number,
  credentials: { accountAddress: string; privateKey: string },
  target: RegistrarTarget,
  admissionUrl: string,
): Promise<BlitzRosterSettlement> {
  const { manifest } = resolveRegistrarContext(target);
  const registry = manifest.native.domains.registry.address;
  const read = async () =>
    new CallData(nativeDomainAbi(manifest, "registry")).parse(
      "game",
      await provider.callContract({ contractAddress: registry, entrypoint: "game", calldata: [gameId] }, "latest"),
    ) as { ready: boolean; end_at: bigint; end_grace_seconds: bigint };
  let game = await read();
  if (game.ready) return { finalizeAt: Number(game.end_at + game.end_grace_seconds), settlementTransactions: 0 };
  const settled = await completeNativeAdminCommand({
    provider,
    manifest,
    admissionUrl,
    gameId,
    ...credentials,
    command: { kind: "SettleBlitzRoster", value: undefined },
  });
  game = await read();
  if (!game.ready) throw new Error("Roster settlement did not make the game ready");
  return { finalizeAt: Number(game.end_at + game.end_grace_seconds), settlementTransactions: settled.transactions };
}

export interface BlitzRosterSettlement {
  finalizeAt: number;
  /** Transactions the settlement burst took at this game start; zero when the roster was already settled. */
  settlementTransactions: number;
}
