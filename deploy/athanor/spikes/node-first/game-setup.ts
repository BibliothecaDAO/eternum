import { resolve } from "node:path";
import { CallData, RpcProvider, CairoOption, CairoOptionVariant, shortString, hash, type RawArgs } from "starknet";
import { args, load, save, required, trialDirectory, presign, type Fixture } from "./common";
import { createMadaraAccount } from "../../../../config/deployer/clean/shared/madara-account";
import { declareClass, readClassArtifact, waitForSuccess } from "../../../../config/deployer/clean/shared/declare";
import { buildNativePreset } from "../../../../config/deployer/clean/config/native-preset";
import { loadNativePresetConfiguration } from "../../../../config/deployer/clean/registrar/native-preset";
import { mapWithConcurrency } from "../../harness/account-factory";
import { canonicalRealmTraits } from "../../../../config/deployer/clean/world/native/realm-catalogue";

async function main() {
  const a = args(["dir", "manifest", "fixture", "private-rpc", "preset", "amount", "prepare-explore"]);
  const dir = trialDirectory(required(a.dir, "dir"));
  const base = load<Fixture>(required(a.fixture, "fixture"));
  const manifest = load<{ world: { address: string }; shard: { chainId: string } }>(required(a.manifest, "manifest"));
  const rpc = required(a["private-rpc"], "private-rpc");
  const provider = new RpcProvider({ nodeUrl: rpc });
  if (
    BigInt(await provider.getChainId()) !== BigInt(base.chainId) ||
    BigInt(base.chainId) !== BigInt(manifest.shard.chainId)
  )
    throw new Error("Trial chain mismatch");
  const host = load<{ deployerAddress: string; deployerPrivateKey: string }>(resolve(dir, "host-keys.json"));
  const account = createMadaraAccount(provider, host.deployerAddress, host.deployerPrivateKey);
  const artifact = (name: string) =>
    readClassArtifact(
      resolve(import.meta.dir, `artifacts-game/node_first_game_${name}.contract_class.json`),
      resolve(import.meta.dir, `artifacts-game/node_first_game_${name}.compiled_contract_class.json`),
    );
  const games = artifact("Games"),
    troops = artifact("TroopsLogic"),
    map = artifact("MapLogic"),
    structures = artifact("StructuresLogic");
  const replacements = { troops: troops.classHash, map: map.classHash, structures: structures.classHash };
  for (const domain of [troops, map, structures]) await declareClass(account, domain, () => {});
  await declareClass(account, games, () => {});
  const [releaseId] = await provider.callContract({
    contractAddress: manifest.world.address,
    entrypoint: "current_release",
    calldata: [],
  });
  const old = await provider.callContract({
    contractAddress: manifest.world.address,
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
  if (old.length !== names.length + 1) throw new Error("Unexpected shipped release layout");
  const release = {
    classes: Object.fromEntries(
      names.map((name, i) => [name, replacements[name as keyof typeof replacements] ?? old[i]!]),
    ),
    migration: "0x0",
  };
  const codec = new CallData(games.sierra.abi);
  const constructorCalldata = codec.compile("constructor", {
    authority: host.deployerAddress,
    account_class: base.accountClassHash,
    release,
  });
  const salt = hash.starknetKeccak(`node-first-game:${Date.now()}`).toString();
  const contract = hash.calculateContractAddressFromHash(salt, games.classHash, constructorCalldata, 0);
  const deployed = await account.deployContract({
    classHash: games.classHash,
    salt,
    constructorCalldata,
    unique: false,
  });
  await waitForSuccess(provider, deployed.transaction_hash);
  const send = async (entrypoint: string, values: Record<string, unknown>) => {
    const tx = await account.execute(
      { contractAddress: contract, entrypoint, calldata: codec.compile(entrypoint, values as RawArgs) },
      { tip: 0 },
    );
    await waitForSuccess(provider, tx.transaction_hash);
  };
  const preset = Number(a.preset ?? 101);
  const config = loadNativePresetConfiguration("madara.frontier", preset);
  const definition = buildNativePreset(config, preset);
  await send("register_preset", { preset_id: preset, definition });
  const precision = 1_000_000_000n;
  const amount = BigInt(a.amount ?? 1000) * precision;
  const grants = definition.resources.resources.map((r) => ({
    resource_type: r.resource_type,
    amount: 1000000n * precision,
  }));
  const now = Number((await provider.getBlock("latest")).timestamp);
  const fixtures: Fixture[] = [];
  const tick = Number(definition.rules.tick_config.armies_tick_in_seconds);
  const scheduledStart = Math.ceil((now + 86400) / tick) * tick;
  for (const [index, arm] of ["X", "Y"].entries()) {
    const game = index + 1;
    await send("create_game", {
      params: {
        name: shortString.encodeShortString(`spike-${arm}`),
        preset_id: preset,
        start_settling_at: now + 1,
        start_main_at: scheduledStart,
        duration_seconds: 86400,
        end_grace_seconds: 0,
        dev_mode_on: true,
        roster: [],
        registration_start: now,
        biome_climate: definition.rules.biome_climate_config,
        map_override: new CairoOption(CairoOptionVariant.None),
        seed: "0x1234567",
      },
    });
    const callData: string[][] = [];
    for (let offset = 0; offset < base.players.length; offset += 8) {
      const rows = base.players.slice(offset, offset + 8);
      const [start] = await provider.callContract({
        contractAddress: contract,
        entrypoint: "entity_counter",
        calldata: [game],
      });
      const initial = Number(BigInt(start!));
      const calls = rows.map((player, i) => {
        const home = initial + i;
        callData[player.botId] = [String(game), String(home), "0", "0", amount.toString(), "0"];
        return {
          contractAddress: contract,
          entrypoint: "prepare_home",
          calldata: codec.compile("prepare_home", {
            game,
            actor: player.address,
            realm_id: offset + i + 1,
            packed_traits: canonicalRealmTraits[offset + i]!,
            grants,
            local_ids: arm === "Y",
          }),
        };
      });
      const tx = await account.execute(calls, { tip: 0 });
      await waitForSuccess(provider, tx.transaction_hash);
      console.log(JSON.stringify({ tier: 2, arm, homes: offset + rows.length, total: base.players.length }));
    }

    const [counter] = await provider.callContract({
      contractAddress: contract,
      entrypoint: "entity_counter",
      calldata: [game],
    });
    fixtures.push({
      ...base,
      contract,
      classHash: games.classHash,
      entrypoint: "create_explorer",
      playerCalldata: callData,
      simulationRpc: rpc,
      game: { id: game, arm: arm as "X" | "Y", kind: "CreateExplorer", initialCounter: Number(BigInt(counter!)) },
    });
  }
  for (const fixture of fixtures) {
    await send("start_now", { game: fixture.game!.id });
    if (a["prepare-explore"] === "true") await prepareExplore(provider, fixture, rpc);
  }
  // Keep both games in day zero after preparation; actual measured calls still use node block time.
  for (const fixture of fixtures) {
    await send("start_now", { game: fixture.game!.id });
    save(
      resolve(dir, `node-first-${fixture.game!.kind === "Explore" ? "explore" : "game"}-${fixture.game!.arm}.json`),
      fixture,
      true,
    );
  }
  console.log(
    JSON.stringify({
      tier: 2,
      contract,
      prepared: base.players.length,
      fixtures: fixtures.map(
        (fixture) => `node-first-${fixture.game!.kind === "Explore" ? "explore" : "game"}-${fixture.game!.arm}.json`,
      ),
    }),
  );
}
async function prepareExplore(provider: RpcProvider, fixture: Fixture, rpc: string) {
  const preparation = { ...fixture, entrypoint: "prepare_explorer" };
  await mapWithConcurrency(fixture.players, 32, async (player) => {
    const signed = await presign(preparation, player, provider, 0, 0, 1, 1);
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: signed.body,
    });
    const result = await response.json();
    if (result.error || !result.result?.transaction_hash) throw new Error("Army preparation refused");
    await waitForSuccess(provider, result.result.transaction_hash);
  });
  const callData: string[][] = [];
  await mapWithConcurrency(fixture.players, 32, async (player) => {
    const [id] = await provider.callContract(
      {
        contractAddress: fixture.contract,
        entrypoint: "last_entity",
        calldata: [fixture.game!.id, player.address],
      },
      "pre_confirmed",
    );
    if (!id || BigInt(id) === 0n) throw new Error("Missing prepared army");
    // The same direction as the spawn steps outward, beyond the already revealed home ring.
    callData[player.botId] = [String(fixture.game!.id), BigInt(id).toString(), "0"];
  });
  const [counter] = await provider.callContract(
    { contractAddress: fixture.contract, entrypoint: "entity_counter", calldata: [fixture.game!.id] },
    "pre_confirmed",
  );
  fixture.entrypoint = "explore";
  fixture.playerCalldata = callData;
  fixture.game = { ...fixture.game!, kind: "Explore", initialCounter: Number(BigInt(counter!)) };
  console.log(JSON.stringify({ tier: 2, arm: fixture.game.arm, preparedExplorers: fixture.players.length }));
}
main().catch(() => {
  console.error("tier2 setup failed; no credentials emitted");
  process.exitCode = 1;
});
