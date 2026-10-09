import { Account, CallData, shortString } from "starknet";
import { DeviceSigner, deviceKeyOf } from "@bibliothecadao/eternum";
import { configureGameplayAccountSubmits, openShard } from "@bibliothecadao/eternum/game-client";
import { getNeighborHexes, RESOURCE_PRECISION, ResourcesIds, StructureType } from "@bibliothecadao/types";
import {
  nativeTilePackingConstants,
  type NativeModelName,
  type NativeRows,
} from "../../../contracts/l3/world-native/schema/client.gen";
import type { NativeCommand } from "../../../contracts/l3/world-native/schema/commands.gen";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { nativeCommandBits } from "../../../contracts/l3/world-native/schema/commands.gen";
import { seasonSeconds } from "../../../packages/core/src/utils/days";
import { SELF_CHECK_PRESET_ID } from "../../../config/source/common/native-preset-modes";
import { buildNativePreset } from "../../../config/deployer/clean/config/native-preset";
import {
  buildNativeGameParams,
  buildNativePresetRegistration,
  loadNativePresetConfiguration,
  registerNativePreset,
} from "../../../config/deployer/clean/registrar/native-preset";
import { createRegistrarGame } from "../../../config/deployer/clean/registrar/calls";
import { createOperatorAccount } from "../../../config/deployer/clean/shared/madara-account";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";
import { assertProviderChain } from "../../../packages/chain/chain-guard.js";
import { createHarnessAccounts } from "./account-factory";
import { connectHarnessGameClient } from "./game-client";
import { prepareOpenHomes } from "./game-setup";
import { createHarnessGame, EXPLORER_TROOP_COUNT } from "./harness-game";
import { HarnessProvider } from "./provider";
import { readPlayBounds } from "./player-invoke";
import { commandForRoute, MISSING_ENTITY, routeReasons } from "./self-check-routes";
import type { DeploymentCheckPort, RouteCase } from "./self-check";

type Store = RouteCase["client"]["setup"]["store"];
const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} required for deployment self-check`);
  return value;
};
const assert = (condition: unknown): void => {
  if (!condition) throw new Error("Self-check fact assertion failed");
};

/** One approved bot in one real throwaway game. No test contract, storage cheat, fixed root or guessed entity layout. */
const fixture: DeploymentCheckPort = {
  async createThrowawayGame(stopped) {
    const manifest = readShardManifest<NativeWorldManifest>(required("NATIVE_WORLD_MANIFEST"));
    const shard = await openShard(required("HERALD_URL"), bindings.schemaIdentity);
    const rpc = new HarnessProvider(shard.rpcUrl);
    const admin = new HarnessProvider(required("HARNESS_ADMIN_RPC_URL"));
    const clients: RouteCase["client"][] = [];
    const dispose = () => {
      stopped.removeEventListener("abort", abortSetup);
      try {
        clients.forEach((client) => client.dispose());
      } finally {
        rpc.dispose();
        admin.dispose();
      }
    };
    const abortSetup = () => {
      // A timed-out setup has no returned fixture for the runner to dispose. Its failure is already recorded there.
      try {
        dispose();
      } catch {}
    };
    stopped.addEventListener("abort", abortSetup, { once: true });
    try {
      stopped.throwIfAborted();
      assert(BigInt(shard.worldAddress) === BigInt(manifest.world.address));
      await Promise.all([
        assertProviderChain(rpc, manifest, "self-check public RPC"),
        assertProviderChain(admin, manifest, "HARNESS_ADMIN_RPC_URL"),
      ]);
      await checkConstructor(rpc, manifest, required("DEPLOYER_ACCOUNT_ADDRESS"));
      stopped.throwIfAborted();
      const privateLauncher = createOperatorAccount(
        admin,
        required("DEPLOYER_ACCOUNT_ADDRESS"),
        required("DEPLOYER_PRIVATE_KEY"),
      );
      const approved = await approveCheckBot(admin, shard);
      stopped.throwIfAborted();
      const gameId = await createCheckGame(privateLauncher, admin, manifest, stopped);
      stopped.throwIfAborted();
      await prepareOpenHomes(gameId, [approved.address]);
      stopped.throwIfAborted();
      const connect = async (actor: string, scope = gameId) => {
        const connection = await connectHarnessGameClient({ actor, gameId: scope, shard });
        clients.push(connection.client);
        stopped.throwIfAborted();
        return connection.client;
      };
      const bot = configureGameplayAccountSubmits(
        new Account({
          provider: rpc,
          address: approved.address,
          signer: new DeviceSigner(deviceKeyOf(approved.privateKey)),
          cairoVersion: "1",
        }),
        shard,
      );
      const botClient = await connect(bot.address);
      const launcher = configureGameplayAccountSubmits(
        createOperatorAccount(rpc, privateLauncher.address, required("DEPLOYER_PRIVATE_KEY")),
        shard,
      );
      const launcherClient = await connect(launcher.address);
      await createHarnessGame(botClient).waitUntilPlaying();
      stopped.throwIfAborted();
      const blitzId = await createModeCheckGame(
        "blitz",
        2,
        privateLauncher,
        admin,
        manifest,
        approved.address,
        stopped,
      );
      const frontierId = await createModeCheckGame(
        "frontier",
        5,
        privateLauncher,
        admin,
        manifest,
        approved.address,
        stopped,
      );
      const blitzClient = await connect(launcher.address, blitzId);
      const frontierClient = await connect(bot.address, frontierId);
      const routes = bindModeRoutes(
        buildRoutePlan(bot, botClient, launcher, launcherClient),
        launcher,
        blitzClient,
        bot,
        frontierClient,
      );
      return { gameId, supplementalGameIds: [blitzId, frontierId], routes, dispose };
    } catch (error) {
      dispose();
      throw error;
    }
  },
};

async function approveCheckBot(admin: HarnessProvider, shard: Awaited<ReturnType<typeof openShard>>) {
  const [approved] = await createHarnessAccounts({
    count: 1,
    concurrency: 1,
    gameId: 0,
    identity: { url: required("IDENTITY_URL"), operatorToken: required("OPERATOR_TOKEN") },
    provider: admin,
    shard,
  });
  if (!approved) throw new Error("Self-check bot enrollment failed");
  return approved;
}

async function createCheckGame(
  launcher: Account,
  admin: HarnessProvider,
  manifest: NativeWorldManifest,
  stopped: AbortSignal,
): Promise<number> {
  const config = loadNativePresetConfiguration("madara.eternum", SELF_CHECK_PRESET_ID);
  const definition = buildNativePreset(config, SELF_CHECK_PRESET_ID);
  await registerNativePreset(
    launcher,
    SELF_CHECK_PRESET_ID,
    buildNativePresetRegistration(definition, SELF_CHECK_PRESET_ID, manifest),
  );
  stopped.throwIfAborted();
  const block = await admin.getBlock("latest");
  const params = buildNativeGameParams(config, {
    gameName: `check-${Date.now().toString(36)}`,
    presetId: SELF_CHECK_PRESET_ID,
    startMainAt: block.timestamp + 2,
    chainTimestamp: block.timestamp,
    durationSeconds: 3600,
    devModeOn: true,
    singleRealmMode: true,
    twoPlayerMode: false,
    useMapOverride: false,
  });
  const created = await createRegistrarGame(launcher, params, manifest, definition);
  stopped.throwIfAborted();
  if (!created.gameId) throw new Error("Self-check game not created");
  return created.gameId;
}

async function createModeCheckGame(
  mode: "blitz" | "frontier",
  presetId: number,
  launcher: Account,
  admin: HarnessProvider,
  manifest: NativeWorldManifest,
  actor: string,
  stopped: AbortSignal,
): Promise<number> {
  const config = loadNativePresetConfiguration(`madara.${mode}`, presetId);
  const definition = buildNativePreset(config, presetId);
  await registerNativePreset(launcher, presetId, buildNativePresetRegistration(definition, presetId, manifest));
  stopped.throwIfAborted();
  const block = await admin.getBlock("latest");
  const params = buildNativeGameParams(config, {
    gameName: `check-${mode}-${Date.now().toString(36)}`,
    presetId,
    startMainAt: block.timestamp,
    chainTimestamp: block.timestamp,
    durationSeconds: mode === "frontier" ? seasonSeconds(1, definition.rules.day_unit_seconds) : 3600,
    devModeOn: false,
    singleRealmMode: false,
    twoPlayerMode: false,
    useMapOverride: false,
  });
  const created = await createRegistrarGame(launcher, params, manifest, definition);
  if (!created.gameId) throw new Error("Mode self-check game not created");
  if (mode === "blitz") {
    // This is an unpaid throwaway seat, not a paid ledger registration or an identity lookup.
    const sent = await launcher.execute({
      contractAddress: manifest.world.address,
      entrypoint: "freeze_blitz_roster",
      calldata: CallData.compile({ game_id: created.gameId, players: [{ account: actor, wallet: actor }] }),
    });
    await launcher.waitForTransaction(sent.transaction_hash);
  }
  stopped.throwIfAborted();
  return created.gameId;
}

/** Mode-specific preflight gates require their real game prerequisites, never a tolerated admission revert. */
export function bindModeRoutes(
  routes: RouteCase[],
  launcher: Account,
  blitz: RouteCase["client"],
  bot: Account,
  frontier: RouteCase["client"],
): RouteCase[] {
  return routes.map((step) => {
    if (step.route === "SettleBlitzRoster")
      return {
        route: step.route,
        account: launcher,
        client: blitz,
        command: () => commandForRoute("SettleBlitzRoster"),
        verify: (store: RouteCase["client"]["setup"]["store"]) =>
          assert(store.require("GameRegistry", { game_id: blitz.gameId }).ready),
      };
    if (step.route === "WithdrawLords") {
      let before: string;
      return {
        route: step.route,
        account: bot,
        client: frontier,
        expectedRejection: "missing structure",
        command: () => {
          before = gameFacts(frontier.setup.store, frontier.gameId);
          return commandForRoute("WithdrawLords");
        },
        verify: (store: RouteCase["client"]["setup"]["store"]) => assert(gameFacts(store, frontier.gameId) === before),
      };
    }
    return step;
  });
}

async function checkConstructor(rpc: HarnessProvider, manifest: NativeWorldManifest, launcher: string): Promise<void> {
  const read = (entrypoint: string) =>
    rpc.callContract({ contractAddress: manifest.world.address, entrypoint, calldata: [] }, "latest");
  const [owner, installedLauncher, key, gas] = await Promise.all([
    read("owner"),
    read("launcher"),
    read("vrf_public_key"),
    read("l2_gas_bound"),
  ]);
  const point = (manifest as NativeWorldManifest & { shard: { vrfPublicKey: { x: string; y: string } } }).shard
    .vrfPublicKey;
  const bounds = readPlayBounds(manifest);
  assert(
    owner.length === 1 &&
      installedLauncher.length === 1 &&
      BigInt(owner[0]!) === BigInt(launcher) &&
      BigInt(installedLauncher[0]!) === BigInt(launcher),
  );
  assert(key.length === 2 && BigInt(key[0]!) === BigInt(point.x) && BigInt(key[1]!) === BigInt(point.y));
  assert(gas.length === 1 && BigInt(gas[0]!) === BigInt(bounds.l2GasBound));
}

export function buildRoutePlan(
  bot: Account,
  client: RouteCase["client"],
  launcher: Account,
  launcherClient: RouteCase["client"],
): RouteCase[] {
  const scope = checkScope(bot, client);
  const happy = [
    ...settlementChecks(scope),
    ...explorerChecks(scope),
    ...guildChecks(scope),
    bankCheck(launcher, launcherClient),
  ];
  return [...happy, ...domainRefusalChecks(scope, launcher, launcherClient, new Set(happy.map((step) => step.route)))];
}

type CheckScope = ReturnType<typeof checkScope>;
function checkScope(bot: Account, client: RouteCase["client"]) {
  const gameId = client.gameId;
  const store = client.setup.store;
  const own = BigInt(bot.address);
  const rows = <M extends NativeModelName>(model: M) => [...store.inGame(model, gameId)];
  const home = () => {
    const homes = rows("Structure").filter((row) => row.owner === own && row.base.category === StructureType.Realm);
    assert(homes.length === 1);
    return BigInt(homes[0]!.entity_id);
  };
  const army = () => {
    const armies = rows("ExplorerTroops").filter((row) => BigInt(row.owner) === home() && row.troops.count > 0n);
    assert(armies.length === 1);
    return BigInt(armies[0]!.explorer_id);
  };
  const position = () => {
    const positions = rows("TileOccupancy").filter((row) => BigInt(row.entity_id) === army());
    assert(positions.length === 1);
    return positions[0]!;
  };
  const applied = (
    route: NativeCommand["kind"],
    command: RouteCase["command"],
    verify: RouteCase["verify"],
  ): RouteCase => ({ route, command, verify, account: bot, client });
  return { bot, client, gameId, rows, home, army, position, applied, own };
}

function settlementChecks({ applied, home, rows, own }: CheckScope): RouteCase[] {
  return [
    applied(
      "SettleSeason",
      () => commandForRoute("SettleSeason"),
      () => {
        home();
        assert(rows("PlayerEntry").some((entry) => entry.player === own));
      },
    ),
    applied(
      "SetEntityName",
      () => ({
        kind: "SetEntityName",
        value: { entity_id: home(), name: shortString.encodeShortString("deployment-check") },
      }),
      () => {
        assert(
          rows("EntityName").some(
            (row) =>
              BigInt(row.entity_id) === home() &&
              row.name === BigInt(shortString.encodeShortString("deployment-check")),
          ),
        );
      },
    ),
  ];
}

function explorerChecks({ applied, home, rows, army, position }: CheckScope): RouteCase[] {
  let originalPosition: NativeRows["TileOccupancy"] | undefined;
  let expectedPosition: { alt: boolean; col: number; row: number } | undefined;
  let removedArmy: bigint | undefined;
  const occupied = (tile: { alt: boolean; col: number; row: number }) =>
    rows("TileOccupancy").some((row) => samePosition(row, tile));
  const revealed = (tile: { alt: boolean; col: number; row: number }) =>
    rows("TileOpt").some((row) => samePosition(row, tile) && isRevealed(row.data));
  return [
    applied(
      "CreateExplorer",
      () => {
        assert(
          rows("ExplorerTroops").filter((row) => BigInt(row.owner) === home() && row.troops.count > 0n).length === 0,
        );
        const amount = BigInt(EXPLORER_TROOP_COUNT) * BigInt(RESOURCE_PRECISION);
        const stocks = [ResourcesIds.Knight, ResourcesIds.Paladin, ResourcesIds.Crossbowman];
        const category = stocks.findIndex((resource) =>
          rows("ResourceBalance").some(
            (row) => BigInt(row.entity_id) === home() && row.resource_type === resource && row.balance >= amount,
          ),
        );
        assert(category >= 0);
        return { kind: "CreateExplorer", value: { structure_id: home(), category, tier: 0, amount, direction: 0 } };
      },
      () => {
        assert(army() > 0n);
      },
    ),
    applied(
      "Explore",
      () => {
        originalPosition = position();
        const neighbors = getNeighborHexes(originalPosition.col, originalPosition.row)
          .map((tile) => ({ ...tile, alt: originalPosition!.alt }))
          .filter((tile) => !occupied(tile));
        const target = neighbors.find((tile) => !revealed(tile)) ?? neighbors[0];
        assert(target);
        expectedPosition = { ...target!, alt: originalPosition.alt };
        return { kind: "Explore", value: { explorer_id: army(), direction: target!.direction } };
      },
      () => {
        assert(revealed(expectedPosition!));
        const current = position();
        if (samePosition(current, originalPosition!)) {
          // Surface discovery places its structure at the revealed destination and leaves the army where it was.
          assert(occupied(expectedPosition!));
        } else assert(samePosition(current, expectedPosition!));
      },
    ),
    applied(
      "Move",
      () => {
        const current = position();
        const neighbors = getNeighborHexes(current.col, current.row)
          .map((tile) => ({ ...tile, alt: current.alt }))
          .filter((tile) => revealed(tile) && !occupied(tile));
        const destination = neighbors.find((tile) => samePosition(tile, originalPosition!)) ?? neighbors[0];
        assert(destination);
        expectedPosition = destination;
        return { kind: "Move", value: { explorer_id: army(), directions: [destination!.direction] } };
      },
      () => {
        assert(samePosition(position(), expectedPosition!));
      },
    ),
    applied(
      "ManageTroops",
      () => {
        removedArmy = army();
        return { kind: "ManageTroops", value: { kind: "RemoveExplorer", value: removedArmy } };
      },
      () => {
        assert(!rows("ExplorerTroops").some((row) => BigInt(row.explorer_id) === removedArmy && row.troops.count > 0n));
        assert(!rows("TileOccupancy").some((row) => BigInt(row.entity_id) === removedArmy));
      },
    ),
  ];
}

function guildChecks({ applied, home, rows, own }: CheckScope): RouteCase[] {
  function assertMember(guild: bigint): void {
    const member = rows("GuildMember").find((row) => row.actor === own);
    assert((member?.guild_id ?? 0n) === guild);
  }
  return [
    applied(
      "CreateGuild",
      () => ({
        kind: "CreateGuild",
        value: { owned_structure_id: home(), public: false, name: shortString.encodeShortString("deployment-check") },
      }),
      () => {
        assert(rows("Guild").some((row) => row.guild_id === own && !row.public));
        assertMember(own);
      },
    ),
    applied(
      "SetGuildWhitelist",
      () => ({ kind: "SetGuildWhitelist", value: { player: own, owned_structure_id: home(), allowed: true } }),
      () => {
        assert(rows("GuildWhitelist").some((row) => row.guild_id === own && row.player === own && row.allowed));
      },
    ),
    applied(
      "RemoveGuildMember",
      () => ({ kind: "RemoveGuildMember", value: own }),
      () => {
        assertMember(0n);
      },
    ),
    applied(
      "JoinGuild",
      () => ({ kind: "JoinGuild", value: { owned_structure_id: home(), guild_id: own } }),
      () => {
        assertMember(own);
      },
    ),
    applied(
      "LeaveGuild",
      () => commandForRoute("LeaveGuild"),
      () => {
        assertMember(0n);
      },
    ),
  ];
}

function bankCheck(launcher: Account, client: RouteCase["client"]): RouteCase {
  return {
    route: "CreateBanks",
    account: launcher,
    client,
    command: () => commandForRoute("CreateBanks"),
    verify: (facts) => {
      assert(
        [...facts.inGame("Structure", client.gameId)].filter(
          (row) => row.owner === BigInt(launcher.address) && row.base.category === StructureType.Bank,
        ).length === 6,
      );
    },
  };
}

function domainRefusalChecks(
  { client, bot, gameId }: CheckScope,
  launcher: Account,
  launcherClient: RouteCase["client"],
  covered: Set<NativeCommand["kind"]>,
): RouteCase[] {
  const guarded = (Object.keys(nativeCommandBits) as NativeCommand["kind"][])
    .filter((route) => !covered.has(route))
    .map((route): RouteCase => {
      const selected = route === "SettleBlitzRoster" ? launcherClient : client;
      let before: string;
      return {
        route,
        client: selected,
        account: route === "SettleBlitzRoster" ? launcher : bot,
        expectedRejection: routeReasons[route],
        command: () => {
          // Missing-state vectors must actually be missing. This is a fresh, private game, not an existing public world.
          assert(
            ![...selected.setup.store.inGame("Structure", gameId)].some(
              (row) => BigInt(row.entity_id) === MISSING_ENTITY,
            ),
          );
          assert(
            ![...selected.setup.store.inGame("ExplorerTroops", gameId)].some(
              (row) => BigInt(row.explorer_id) === MISSING_ENTITY,
            ),
          );
          before = gameFacts(selected.setup.store, gameId);
          return commandForRoute(route);
        },
        verify: (facts) => {
          assert(gameFacts(facts, gameId) === before);
        },
      };
    });
  return guarded;
}

function samePosition(
  a: { alt: boolean; col: number; row: number },
  b: { alt: boolean; col: number; row: number },
): boolean {
  return a.alt === b.alt && a.col === b.col && a.row === b.row;
}

function isRevealed(data: bigint): boolean {
  return (data / BigInt(nativeTilePackingConstants.BIOME_SCALE)) % BigInt(nativeTilePackingConstants.BYTE_RANGE) !== 0n;
}

/** Compare real serialized facts, including creates/deletes, after Herald has applied a refused transaction. */
export function gameFacts(store: Store, gameId: number): string {
  const facts = bindings.models.flatMap(({ name }) =>
    [...store.inGame(name as NativeModelName, gameId)].map((row) => [name, row]),
  );
  return facts
    .map((fact) => JSON.stringify(fact, (_key, value) => (typeof value === "bigint" ? value.toString() : value)))
    .sort()
    .join("\n");
}

export default fixture;
