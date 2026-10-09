import { createOperatorAccount } from "../shared/madara-account";
import { presetRegistrationCall } from "./native-preset";
import { confirmedTransactionReceipt } from "../shared/transaction";
import { completeNativeAdminCommand } from "../world/native/command";
import { nativeGamesAbi, nativeWorldSchema } from "../world/native/manifest";
import type { RegistrarWorld } from "../world/native/types";
import type { buildNativePreset } from "../config/native-preset";
import { resolveGameTransactionResourceBounds, worldView } from "@bibliothecadao/eternum";
import { Account, CallData, shortString, type Call, type RawArgs, RpcProvider } from "starknet";
import { loadRepoJsonFile } from "../shared/repo";
import type { DeploymentEnvironmentId } from "../types";

type RegistrarEntrypoint = "register_preset" | "create_game" | "freeze_blitz_roster";

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

interface RegistrarTransactionResult {
  transactionHash: string;
  receipt: unknown;
}

export interface CreateRegistrarGameResult extends RegistrarTransactionResult {
  gameId?: number;
}

type RegistrarEnvironmentId = DeploymentEnvironmentId;
type RegistrarTarget = RegistrarEnvironmentId | RegistrarManifest;

interface RegistrarContext {
  environmentId?: RegistrarEnvironmentId;
  manifest: RegistrarManifest;
}

const DEFAULT_ENVIRONMENT_ID: RegistrarEnvironmentId = "madara.blitz";

function resolveRegistrarContext(target: RegistrarTarget = DEFAULT_ENVIRONMENT_ID): RegistrarContext {
  if (typeof target !== "string") {
    nativeGamesAbi(target);
    return { manifest: target };
  }
  const path = process.env.NATIVE_WORLD_MANIFEST;
  if (!path) throw new Error("NATIVE_WORLD_MANIFEST is required");
  const manifest = loadRepoJsonFile<RegistrarManifest>(path);
  nativeGamesAbi(manifest);
  return { environmentId: target, manifest };
}

function registrarContract(context: RegistrarContext): ManifestContract {
  return {
    address: context.manifest.world.address,
    abi: nativeGamesAbi(context.manifest) as ManifestAbiEntry[],
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
  const layouts = schema.games.events.filter((event) => event.name === "RowSet");
  if (!model || !layouts.length) throw new Error("Native manifest has no game registry event");
  for (const event of readReceiptEvents(receipt)) {
    if (!event.from_address || BigInt(event.from_address) !== BigInt(manifest.world.address)) continue;
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
    contractAddress: manifest.world.address,
    entrypoint: worldView(nativeWorldSchema(manifest), "game_id_by_name"),
    calldata: [shortString.encodeShortString(name)],
  });
  if (id === undefined) throw new Error("Registrar returned no game identity");
  const value = BigInt(id);
  if (value < 0n || value > 0xffffffffn) throw new Error("Registrar returned an invalid game identity");
  return value === 0n ? null : { gameId: Number(value) };
}

/** Freeze exactly the ledger's stored wallet/account pair, without resolving identity again. */
export function blitzRosterOf(players: readonly { wallet: string; account: string }[]) {
  if (players.length < 1 || players.length > 24) throw new Error("Blitz requires 1 to 24 registered players");
  const canonical = (value: string, field: string) => {
    if (!/^0x[0-9a-f]+$/i.test(value) || BigInt(value) === 0n) throw new Error(`Invalid roster ${field}`);
    return `0x${BigInt(value).toString(16)}`;
  };
  const rows = players.map(({ account, wallet }) => ({
    account: canonical(account, "account"),
    wallet: canonical(wallet, "wallet"),
  }));
  for (const field of ["account", "wallet"] as const)
    if (new Set(rows.map((row) => row[field])).size !== rows.length) throw new Error(`Duplicate roster ${field}`);
  return rows;
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
      entrypoint: registration.commitmentView,
      calldata: [presetId],
    },
    "latest",
  );
  if (commitment === undefined || BigInt(commitment) !== BigInt(registration.commitment))
    throw new Error("Current preset differs from the launch configuration; reload its balance before creating a game");
  const calldata = new CallData(nativeGamesAbi(context.manifest)).compile("create_game", {
    params: params as RawArgs,
  });
  const result = await executeRegistrarCall(account, buildRegistrarCall("create_game", calldata, target), target);
  return { ...result, gameId: resolveCreatedGameId(result.receipt, target) };
}

export async function freezeBlitzRoster(
  provider: RpcProvider,
  gameId: number,
  players: readonly { account: string; wallet: string }[],
  credentials: { accountAddress: string; privateKey: string },
  target: RegistrarTarget,
): Promise<void> {
  const { manifest } = resolveRegistrarContext(target);
  const account = createOperatorAccount(provider, credentials.accountAddress, credentials.privateKey);
  const calldata = new CallData(nativeGamesAbi(manifest)).compile("freeze_blitz_roster", {
    game_id: gameId,
    players: blitzRosterOf(players),
  });
  await executeRegistrarCall(account, buildRegistrarCall("freeze_blitz_roster", calldata, target), target);
}

export async function settleBlitzRoster(
  provider: RpcProvider,
  gameId: number,
  credentials: { accountAddress: string; privateKey: string },
  target: RegistrarTarget,
): Promise<BlitzRosterSettlement> {
  const { manifest } = resolveRegistrarContext(target);
  const registry = manifest.world.address;
  const read = async () =>
    new CallData(nativeGamesAbi(manifest)).parse(
      "game",
      await provider.callContract({ contractAddress: registry, entrypoint: "game", calldata: [gameId] }, "latest"),
    ) as { ready: boolean; end_at: bigint; end_grace_seconds: bigint };
  let game = await read();
  if (game.ready) return { finalizeAt: Number(game.end_at + game.end_grace_seconds), settlementTransactions: 0 };
  const settled = await completeNativeAdminCommand({
    provider,
    manifest,
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
