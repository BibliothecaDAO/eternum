import { confirmedTransactionReceipt } from "../shared/transaction";
import { completeNativeAdminCommand } from "../world/native/command";
import { nativeDomainAbi } from "../world/native/manifest";
import type { NativeWorldManifest } from "../world/native/types";
import type { buildNativePreset } from "../config/native-preset";
import { resolveGameTransactionResourceBounds } from "@bibliothecadao/eternum";
import { Account, CallData, shortString, type Call, type RawArgs, RpcProvider } from "starknet";
import { resolveDeploymentEnvironment } from "../environment";
import { openLedgerGame, type LedgerTarget } from "../ledger/calls";
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

export function createRosterVerifier(rpcUrl: string, manifestPath: string) {
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const manifest = loadRepoJsonFile<RegistrarManifest>(manifestPath);
  return async (owner: string): Promise<void> => {
    await resolveBlitzRoster(provider, [owner], manifest);
  };
}

export async function resolveBlitzRoster(
  provider: RpcProvider,
  owners: readonly string[],
  target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID,
) {
  if (owners.length < 1 || owners.length > 24) throw new Error("Blitz requires 1 to 24 registered identities");
  const normalized = owners.map((owner) => {
    if (!/^0x[0-9a-f]+$/i.test(owner) || BigInt(owner) === 0n) throw new Error("Invalid roster identity");
    return `0x${BigInt(owner).toString(16)}`;
  });
  if (new Set(normalized).size !== normalized.length) throw new Error("Duplicate roster identity");
  const { manifest } = resolveRegistrarContext(target);
  const block = await provider.getBlockNumber();
  const authentication = await provider.callContract(
    {
      contractAddress: manifest.native.domains.season.address,
      entrypoint: "authentication",
      calldata: [],
    },
    block,
  );
  const decoded = new CallData(nativeDomainAbi(manifest, "season")).parse("authentication", authentication) as {
    registry: bigint;
  };
  const registry = `0x${BigInt(decoded.registry).toString(16)}`;
  if (BigInt(registry) === 0n) throw new Error("World has no PlayerRegistry");
  return Promise.all(normalized.map((owner) => readRosterPlayer(provider, registry, owner, block)));
}

async function readRosterPlayer(provider: RpcProvider, registry: string, owner: string, block: number) {
  const [account] = await provider.callContract(
    {
      contractAddress: registry,
      entrypoint: "account_of",
      calldata: [owner],
    },
    block,
  );
  if (account === undefined || BigInt(account) === 0n) throw new Error(`Identity ${owner} has no gameplay account`);
  const [boundOwner] = await provider.callContract(
    {
      contractAddress: registry,
      entrypoint: "owner_of",
      calldata: [account],
    },
    block,
  );
  if (boundOwner === undefined || BigInt(boundOwner) !== BigInt(owner))
    throw new Error(`Registry binding mismatch for ${owner}`);
  return { owner, account: `0x${BigInt(account).toString(16)}` };
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

export function assertRegistrarAvailable(target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID): void {
  const context = resolveRegistrarContext(target);
  const requiredEntrypoints: RegistrarEntrypoint[] = ["register_preset", "create_game"];
  requiredEntrypoints.forEach((entrypoint) => requireRegistrarContract(context, entrypoint));
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

export function isRegistrarAlreadyRegisteredError(error: unknown): boolean {
  return /preset already registered/i.test(error instanceof Error ? error.message : String(error));
}

export async function settleBlitzRoster(
  provider: RpcProvider,
  gameId: number,
  credentials: { accountAddress: string; privateKey: string },
  target: RegistrarTarget,
  admissionUrl: string,
): Promise<number> {
  const { manifest } = resolveRegistrarContext(target);
  const season = manifest.native.domains.season.address;
  const read = async () =>
    new CallData(nativeDomainAbi(manifest, "season")).parse(
      "game",
      await provider.callContract({ contractAddress: season, entrypoint: "game", calldata: [gameId] }, "latest"),
    ) as { ready: boolean; end_at: bigint; end_grace_seconds: bigint };
  let game = await read();
  if (game.ready) return Number(game.end_at + game.end_grace_seconds);
  await completeNativeAdminCommand({
    provider,
    manifest,
    admissionUrl,
    gameId,
    ...credentials,
    command: { kind: "SettleBlitzRoster", value: undefined },
  });
  game = await read();
  if (!game.ready) throw new Error("Roster settlement did not make the game ready");
  return Number(game.end_at + game.end_grace_seconds);
}
