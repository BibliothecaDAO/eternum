import { Account, shortString } from "starknet";
import { DeviceSigner, deviceKeyOf } from "@bibliothecadao/eternum";
import { configureGameplayAccountSubmits, openShard } from "@bibliothecadao/eternum/game-client";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";
import { assertProviderChain } from "../../../packages/chain/chain-guard.js";
import { createHarnessAccounts } from "./account-factory";
import { connectActorClients, actorKey } from "./game-client";
import { connectHarnessGameClient } from "./game-client";
import { createHarnessGame, EXPLORER_TROOP_COUNT } from "./harness-game";
import { launchHarnessGame } from "./game-setup";
import { launchFrontierSeason } from "./frontier";
import { readPlayBounds } from "./player-invoke";
import { HarnessProvider } from "./provider";
import type { WaveFixturePort, WaveGame, WavePlayer } from "./burst";
import { TroopTier, RESOURCE_PRECISION } from "@bibliothecadao/types";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} required for wave setup`);
  return value;
};

/** Fresh real-contract fixtures: 2,000 open-season settlements or 24 independently owned explorer creations. */
const fixture: WaveFixturePort = {
  async createGame(players) {
    if (![24, 2000].includes(players)) throw new Error("Wave fixture supports 24 or 2000 players");
    const manifest = readShardManifest<NativeWorldManifest>(required("NATIVE_WORLD_MANIFEST"));
    const bounds = readPlayBounds(manifest);
    const shard = await openShard(required("HERALD_URL"), bindings.schemaIdentity);
    const provider = new HarnessProvider(shard.rpcUrl);
    const privateProvider = new HarnessProvider(required("HARNESS_ADMIN_RPC_URL"));
    let clients: Awaited<ReturnType<typeof connectActorClients>> | undefined;
    const dispose = () => {
      clients?.forEach(({ client }) => client.dispose());
      provider.dispose();
      privateProvider.dispose();
    };
    try {
      await Promise.all([
        assertProviderChain(provider, manifest, "public wave RPC"),
        assertProviderChain(privateProvider, manifest, "HARNESS_ADMIN_RPC_URL"),
      ]);
      const approved = await createHarnessAccounts({
        count: players,
        concurrency: 6,
        gameId: 0,
        identity: { url: required("IDENTITY_URL"), operatorToken: required("OPERATOR_TOKEN") },
        provider: privateProvider,
        shard,
      });
      const accounts = approved.map((player) => ({
        ...player,
        account: configureGameplayAccountSubmits(
          new Account({
            provider,
            address: player.address,
            signer: new DeviceSigner(deviceKeyOf(player.privateKey)),
            cairoVersion: "1",
          }),
          shard,
        ),
      }));
      const name = `wave-${Date.now().toString(36)}`;
      const game =
        players === 24
          ? await launchHarnessGame({
              gameName: name,
              gameType: "blitz",
              minutes: 10,
              presetId: 2,
              rosterAccounts: accounts.map(({ address }) => address),
              shard,
              publicProvider: provider,
            })
          : await launchFrontierSeason(privateProvider, name, 10, 5);
      clients = await connectActorClients(
        accounts.map(({ address }) => address),
        6,
        (actor) => connectHarnessGameClient({ actor, gameId: game.gameId, shard }),
      );
      await createHarnessGame(clients.get(actorKey(accounts[0]!.address))!.client).waitUntilPlaying();
      const wavePlayers: WavePlayer[] = accounts.map((player) => {
        const own = clients!.get(actorKey(player.address))!;
        return players === 2000
          ? {
              account: player.account,
              client: own.client,
              heraldConfirmations: own.heraldConfirmations,
              command: () => ({
                kind: "SettleSeason",
                value: {
                  name: shortString.encodeShortString(`bot-${player.botId}`),
                  selected_realm: { kind: "None", value: undefined },
                },
              }),
              verify: (store) => {
                if ([...store.structuresOwnedBy(game.gameId, BigInt(player.address))].length !== 1)
                  throw new Error("Settlement did not create the player's one home");
              },
            }
          : explorerPlayer(player.account, own, game.gameId);
      });
      return {
        gameId: game.gameId,
        kind: players === 24 ? "CreateExplorer" : "SettleSeason",
        rpcUrl: shard.rpcUrl,
        bounds,
        provider,
        games: shard.worldAddress,
        classHash: manifest.world.class_hash,
        nodeImage: required("SHARD_NODE_IMAGE"),
        players: wavePlayers,
        verify: async () => {
          for (const player of wavePlayers) await player.verify(player.client.setup.store);
        },
        dispose,
      } satisfies WaveGame;
    } catch (error) {
      dispose();
      throw error;
    }
  },
};

function explorerPlayer(
  account: Account,
  own: Awaited<ReturnType<typeof connectHarnessGameClient>>,
  gameId: number,
): WavePlayer {
  const game = createHarnessGame(own.client, own.heraldConfirmations);
  const homes = game.settlementStructureIds(account.address);
  if (!homes?.length) throw new Error("Explorer fixture has no settled home");
  const home = homes[0]!;
  const troop = game.startingTroopType(home);
  if (troop === undefined || game.explorersOf(home).length !== 0)
    throw new Error("Explorer fixture is not funded and empty");
  return {
    account,
    client: own.client,
    heraldConfirmations: own.heraldConfirmations,
    command: () => ({
      kind: "CreateExplorer",
      value: {
        structure_id: home,
        category: troop,
        tier: TroopTier.T1,
        amount: BigInt(EXPLORER_TROOP_COUNT) * BigInt(RESOURCE_PRECISION),
        direction: 0,
      },
    }),
    verify: () => {
      const explorers = game.explorersOf(home);
      if (explorers.length !== 1) throw new Error("Explorer creation did not produce exactly one army");
      const troops = own.client.setup.store.require("ExplorerTroops", { game_id: gameId, explorer_id: explorers[0]! });
      if (BigInt(troops.owner) !== BigInt(home)) throw new Error("Created explorer belongs to another player");
    },
  };
}
export default fixture;
