import { resolve } from "node:path";
import { CallData, RpcProvider, CairoOption, CairoOptionVariant, shortString, hash, type RawArgs } from "starknet";
import {
  args,
  load,
  save,
  required,
  trialDirectory,
  presign,
  invokeBounds,
  storageSlot,
  now as monotonicNow,
  ms,
  type Fixture,
} from "./common";
import { createMadaraAccount } from "../../../../config/deployer/clean/shared/madara-account";
import { declareClass, readClassArtifact, waitForSuccess } from "../../../../config/deployer/clean/shared/declare";
import { buildNativePreset } from "../../../../config/deployer/clean/config/native-preset";
import { loadNativePresetConfiguration } from "../../../../config/deployer/clean/registrar/native-preset";
import { mapWithConcurrency } from "../../harness/account-factory";
import { provisioningWindow, preconfirmedSuccess, SetupFailure } from "./provision";
import { canonicalRealmTraits } from "../../../../config/deployer/clean/world/native/realm-catalogue";

async function main() {
  const setupStarted = monotonicNow();
  const a = args(["dir", "manifest", "fixture", "private-rpc", "preset", "amount", "prepare-explore", "window"]);
  const dir = trialDirectory(required(a.dir, "dir"));
  const base = load<Fixture>(required(a.fixture, "fixture"));
  const manifest = load<{ world: { address: string }; shard: { chainId: string } }>(required(a.manifest, "manifest"));
  const rpc = required(a["private-rpc"], "private-rpc");
  const window = Number(a.window ?? 16);
  if (!Number.isInteger(window) || window < 1 || window > 32) throw new SetupFailure("Setup window must be 1..32");
  if (
    new Set(base.players.map((player) => player.address.toLowerCase())).size !== base.players.length ||
    new Set(base.players.map((player) => player.botId)).size !== base.players.length ||
    base.players.some(
      (player) => !Number.isInteger(player.botId) || player.botId < 0 || player.botId >= base.players.length,
    ) ||
    base.players.length > canonicalRealmTraits.length
  )
    throw new SetupFailure("Player/realm fixture has gaps or duplicates");
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
    const callData = await provisionHomes(account, provider, codec, contract, base, game, arm, grants, amount, window);

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
      setupMs: ms(monotonicNow() - setupStarted),
      fixtures: fixtures.map(
        (fixture) => `node-first-${fixture.game!.kind === "Explore" ? "explore" : "game"}-${fixture.game!.arm}.json`,
      ),
    }),
  );
}
async function provisionHomes(
  account: ReturnType<typeof createMadaraAccount>,
  provider: RpcProvider,
  codec: CallData,
  contract: string,
  base: Fixture,
  game: number,
  arm: string,
  grants: { resource_type: number; amount: bigint }[],
  amount: bigint,
  window: number,
) {
  const started = monotonicNow();
  const [first] = await provider.callContract(
    { contractAddress: contract, entrypoint: "entity_counter", calldata: [game] },
    "pre_confirmed",
  );
  const initial = Number(BigInt(first!));
  if (initial !== 1) throw new SetupFailure(`Fresh game ${game} already has entities`);
  const startNonce = BigInt(await provider.getNonceForAddress(account.address, "pre_confirmed"));
  const batches = Array.from({ length: Math.ceil(base.players.length / 8) }, (_, batch) =>
    base.players.slice(batch * 8, batch * 8 + 8).map((player, index) => ({
      contractAddress: contract,
      entrypoint: "prepare_home",
      calldata: codec.compile("prepare_home", {
        game,
        actor: player.address,
        realm_id: batch * 8 + index + 1,
        packed_traits: canonicalRealmTraits[batch * 8 + index]!,
        grants,
        local_ids: arm === "Y",
      }),
    })),
  );
  await provisioningWindow(
    batches.length,
    startNonce,
    window,
    async (index, nonce) =>
      (await account.execute(batches[index]!, { nonce, tip: 0, resourceBounds: invokeBounds })).transaction_hash,
    (tx) => preconfirmedSuccess(provider, tx),
    (completed) =>
      console.log(
        JSON.stringify({
          tier: 2,
          arm,
          homes: Math.min(completed * 8, base.players.length),
          total: base.players.length,
          phase: "preconfirmed",
          window,
        }),
      ),
  );
  const provisioned = monotonicNow();
  const finalNonce = BigInt(await provider.getNonceForAddress(account.address, "pre_confirmed"));
  if (finalNonce !== startNonce + BigInt(batches.length))
    throw new SetupFailure(`Game ${game}: provisioning nonce gap`);
  const [last] = await provider.callContract(
    { contractAddress: contract, entrypoint: "entity_counter", calldata: [game] },
    "pre_confirmed",
  );
  if (BigInt(last!) !== BigInt(initial + base.players.length))
    throw new SetupFailure(`Game ${game}: final home count gap`);
  const callData: string[][] = [];
  await mapWithConcurrency(base.players, 32, async (player, index) => {
    const home = initial + index;
    try {
      const [valid] = await provider.callContract(
        {
          contractAddress: contract,
          entrypoint: "verify_home",
          calldata: codec.compile("verify_home", {
            game,
            actor: player.address,
            home,
            realm: index + 1,
            packed_traits: canonicalRealmTraits[index]!,
            grants,
          }),
        },
        "pre_confirmed",
      );
      const scope = await provider.getStorageAt(
        contract,
        storageSlot("spike_id_home", game, player.address),
        "pre_confirmed",
      );
      if (BigInt(valid!) !== 1n || BigInt(scope) !== BigInt(arm === "Y" ? home : 0))
        throw new SetupFailure("Home mismatch");
    } catch {
      throw new SetupFailure(`Game ${game}: home ${home} state, allocator or chain verification failed`);
    }
    callData[player.botId] = [String(game), String(home), "0", "0", amount.toString(), "0"];
  });
  console.log(
    JSON.stringify({
      tier: 2,
      arm,
      verifiedHomes: base.players.length,
      finalNonce: finalNonce.toString(),
      provisioningMs: ms(provisioned - started),
      verificationMs: ms(monotonicNow() - provisioned),
      totalMs: ms(monotonicNow() - started),
      window,
    }),
  );
  return callData;
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
main().catch((error: unknown) => {
  console.error(error instanceof SetupFailure ? error.message : "tier2 setup failed; no credentials emitted");
  process.exitCode = 1;
});
