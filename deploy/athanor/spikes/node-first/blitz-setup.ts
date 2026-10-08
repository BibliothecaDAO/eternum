// Throwaway four-game fixture. Every game uses the shipped Blitz preset and genuine roster settlement.
import { resolve } from "node:path";
import { RpcProvider, CallData, CairoOption, CairoOptionVariant, hash, shortString, type RawArgs } from "starknet";
import { args, load, save, required, trialDirectory, invokeBounds, type Fixture } from "./common";
import { createMadaraAccount } from "../../../../config/deployer/clean/shared/madara-account";
import { declareClass, readClassArtifact, waitForSuccess } from "../../../../config/deployer/clean/shared/declare";
import { loadNativePresetConfiguration } from "../../../../config/deployer/clean/registrar/native-preset";
import { buildNativePreset } from "../../../../config/deployer/clean/config/native-preset";
import { SetupFailure } from "./provision";

type BlitzFixture = Fixture & { destroyCalldata: string[][] };
type Sender = (entrypoint: string, values: Record<string, unknown>) => Promise<void>;
type Definition = ReturnType<typeof buildNativePreset>;

async function deployBlitzHost(dir: string, base: Fixture, provider: RpcProvider, world: string) {
  const host = load<{ deployerAddress: string; deployerPrivateKey: string }>(resolve(dir, "host-keys.json"));
  const account = createMadaraAccount(provider, host.deployerAddress, host.deployerPrivateKey);
  const artifact = readClassArtifact(
    resolve(import.meta.dir, "artifacts-blitz/node_first_game_BlitzGames.contract_class.json"),
    resolve(import.meta.dir, "artifacts-blitz/node_first_game_BlitzGames.compiled_contract_class.json"),
  );
  await declareClass(account, artifact, () => {});
  const [releaseId] = await provider.callContract({
    contractAddress: world,
    entrypoint: "current_release",
    calldata: [],
  });
  const values = await provider.callContract({
    contractAddress: world,
    entrypoint: "release",
    calldata: [releaseId!],
  });
  const names = [
    "season",
    "map",
    "placement",
    "construction",
    "production",
    "structures",
    "troops",
    "settlement",
    "resources",
    "economy",
    "prizes",
    "registry",
    "combat",
    "raid",
    "bridge",
    "relics",
    "movement",
  ];
  if (values.length !== names.length + 1) throw new SetupFailure("Release layout mismatch");
  const release = { classes: Object.fromEntries(names.map((name, i) => [name, values[i]!])), migration: "0x0" };
  const codec = new CallData(artifact.sierra.abi);
  const constructorCalldata = codec.compile("constructor", {
    authority: host.deployerAddress,
    account_class: base.accountClassHash,
    release,
  });
  const salt = hash.starknetKeccak(`spike-blitz:${Date.now()}`).toString();
  const contract = hash.calculateContractAddressFromHash(salt, artifact.classHash, constructorCalldata, 0);
  const deployed = await account.deployContract({
    classHash: artifact.classHash,
    salt,
    constructorCalldata,
    unique: false,
  });
  await waitForSuccess(provider, deployed.transaction_hash);
  const send = async (entrypoint: string, values: Record<string, unknown>) => {
    const tx = await account.execute(
      { contractAddress: contract, entrypoint, calldata: codec.compile(entrypoint, values as RawArgs) },
      {
        nonce: await provider.getNonceForAddress(account.address, "pre_confirmed"),
        tip: 0,
        resourceBounds: invokeBounds,
      },
    );
    await waitForSuccess(provider, tx.transaction_hash);
  };
  return { send, codec, contract, classHash: artifact.classHash };
}

async function createBlitzGame(
  send: Sender,
  provider: RpcProvider,
  definition: Definition,
  game: number,
  players: Fixture["players"],
) {
  const timestamp = Number((await provider.getBlock("latest")).timestamp);
  await send("create_game", {
    params: {
      name: shortString.encodeShortString(`spike-blitz-${game}`),
      preset_id: 2,
      start_settling_at: timestamp - 1,
      start_main_at: timestamp,
      registration_start: timestamp - 2,
      duration_seconds: 86400,
      end_grace_seconds: 0,
      dev_mode_on: false,
      roster: players.map((p) => ({ account: p.address })),
      biome_climate: definition.rules.biome_climate_config,
      map_override: new CairoOption(CairoOptionVariant.None),
      seed: "0x1234567",
    },
  });
}

async function settleBlitzRoster(
  send: Sender,
  game: number,
  players: Fixture["players"],
  grants: { resource_type: number; amount: bigint }[],
) {
  for (let n = 0; n < 24; n++) await send("prepare_roster", { game });
  for (const player of players) await send("prepare_actor", { game, actor: player.address, grants });
}

async function readBlitzFixture(
  provider: RpcProvider,
  codec: CallData,
  base: Fixture,
  contract: string,
  classHash: string,
  game: number,
  players: Fixture["players"],
): Promise<BlitzFixture> {
  const playerCalldata: string[][] = [],
    destroyCalldata: string[][] = [];
  for (const player of players) {
    const [home] = await provider.callContract(
      { contractAddress: contract, entrypoint: "home", calldata: [game, player.address] },
      "pre_confirmed",
    );
    if (!home || BigInt(home) === 0n) throw new SetupFailure("Blitz home missing");
    playerCalldata[player.botId] = codec.compile("create_building", {
      game,
      command: { structure_id: home, directions: [0], category: 1, use_simple: true },
    });
    destroyCalldata[player.botId] = codec.compile("destroy_building", {
      game,
      command: { structure_id: home, coord: { alt: false, x: 11, y: 10 } },
    });
  }
  return {
    ...base,
    players,
    contract,
    classHash,
    entrypoint: "create_building",
    game: { id: game, arm: "Y", kind: "Blitz", initialCounter: 0 },
    playerCalldata,
    destroyCalldata,
  };
}

async function main() {
  const a = args(["dir", "fixture", "manifest", "private-rpc"]);
  const dir = trialDirectory(required(a.dir, "dir"));
  const base = load<Fixture>(required(a.fixture, "fixture"));
  if (base.players.length !== 96 || new Set(base.players.map((p) => p.address)).size !== 96)
    throw new SetupFailure("Four Blitz rosters require 96 distinct accounts");
  const provider = new RpcProvider({ nodeUrl: required(a["private-rpc"], "private-rpc") });
  if (BigInt(await provider.getChainId()) !== BigInt(base.chainId)) throw new SetupFailure("Trial chain mismatch");
  const manifest = load<{ world: { address: string } }>(required(a.manifest, "manifest"));
  const host = await deployBlitzHost(dir, base, provider, manifest.world.address);
  const definition = buildNativePreset(loadNativePresetConfiguration("madara.blitz", 2), 2);
  await host.send("register_preset", { preset_id: 2, definition });
  const grants = definition.resources.resources.map((r) => ({
    resource_type: r.resource_type,
    amount: 1000000n * 1000000000n,
  }));
  const fixtures: BlitzFixture[] = [];
  for (let game = 1; game <= 4; game++) {
    const players = base.players.slice((game - 1) * 24, game * 24).map((player, botId) => ({ ...player, botId }));
    await createBlitzGame(host.send, provider, definition, game, players);
    await settleBlitzRoster(host.send, game, players, grants);
    fixtures.push(await readBlitzFixture(provider, host.codec, base, host.contract, host.classHash, game, players));
    console.log(JSON.stringify({ game, preset: 2, players: 24, rosterReady: true, perHomeIds: true }));
  }
  save(resolve(dir, "blitz-private.json"), { chainId: base.chainId, fixtures }, true);
  console.log(
    JSON.stringify({
      contract: host.contract,
      games: 4,
      players: 96,
      mode: "genuine alternating build/demolish on per-home cell11,10; fixture grants outside measurements",
    }),
  );
}
main().catch(() => {
  console.error("Blitz fixture failed; no credentials emitted");
  process.exitCode = 1;
});
