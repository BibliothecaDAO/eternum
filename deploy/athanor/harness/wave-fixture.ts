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
import { createHarnessGame } from "./harness-game";
import { createHarnessAdminProvider } from "./game-setup";
import { launchFrontierSeason } from "./frontier";
import { readPlayBounds } from "./player-invoke";
import { HarnessProvider } from "./provider";
import type { WaveFixturePort, WaveGame, WavePlayer } from "./burst";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} required for wave setup`);
  return value;
};

/** Fresh real-contract fixtures: 2,000 open-season settlements. */
const fixture: WaveFixturePort = {
  async createGame(players) {
    if (players !== 2000) throw new Error("Wave fixture requires 2000 players");
    const manifest = readShardManifest<NativeWorldManifest>(required("NATIVE_WORLD_MANIFEST"));
    const bounds = readPlayBounds(manifest);
    const shard = await openShard(required("HERALD_URL"), bindings.schemaIdentity);
    const provider = new HarnessProvider(shard.rpcUrl);
    const privateProvider = createHarnessAdminProvider();
    let clients: Awaited<ReturnType<typeof connectActorClients>> | undefined;
    // The fixture's run: disposing it ends the reconciliation of every send its players made.
    const run = new AbortController();
    const dispose = () => {
      run.abort();
      clients?.forEach(({ client }) => client.dispose());
      provider.dispose();
      privateProvider.dispose();
    };
    try {
      await assertProviderChain(provider, manifest, "public wave RPC");
      const name = `wave-${Date.now().toString(36)}`;
      const approved = await createHarnessAccounts({
        count: players,
        concurrency: 6,
        gameId: 0,
        identity: { url: required("IDENTITY_URL"), operatorToken: required("OPERATOR_TOKEN") },
        provider: privateProvider,
        shard,
        stopped: run.signal,
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
          run.signal,
        ),
      }));
      const game = await launchFrontierSeason(privateProvider, name, 10, 5);
      clients = await connectActorClients(
        accounts.map(({ address }) => address),
        6,
        (actor) => connectHarnessGameClient({ actor, gameId: game.gameId, shard }),
      );
      await createHarnessGame(clients.get(actorKey(accounts[0]!.address))!.client).waitUntilPlaying();
      const wavePlayers: WavePlayer[] = accounts.map((player) => {
        const own = clients!.get(actorKey(player.address))!;
        return {
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
        };
      });
      return {
        gameId: game.gameId,
        kind: "SettleSeason",
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

export default fixture;
