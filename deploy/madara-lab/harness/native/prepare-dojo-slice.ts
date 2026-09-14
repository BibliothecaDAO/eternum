import { setTimeout as sleep } from "node:timers/promises";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CallData, RpcProvider, hash, type Call, type RawArgs } from "starknet";
import { createMadaraAccount } from "../../../../config/deployer/clean/shared/madara-account";
import { readClassArtifact, declareClass, waitForSuccess } from "../../../../config/deployer/clean/shared/declare";
import { resourceSelector, byteArrayHash } from "../../../../config/deployer/clean/world/artifacts";
import {
  createRegistrarGame,
  registerPreset,
  isRegistrarAlreadyRegisteredError,
} from "../../../../config/deployer/clean/registrar/calls";
import { buildCreateGameParams, buildPresetRegistration } from "../../../../config/deployer/clean/registrar/preset";
import { getConfigFromNetwork } from "../../../../config/utils/utils";
import { resolveGameTransactionResourceBounds } from "@bibliothecadao/eternum";

const root = resolve(import.meta.dir, "../../../..");
const lab = resolve(root, "deploy/madara-lab/.lab");
const path = process.env.GAME_MANIFEST_PATH;
if (!path) throw new Error("GAME_MANIFEST_PATH must point to the local Dojo baseline manifest");
const manifest = await Bun.file(path).json();
const provider = new RpcProvider({ nodeUrl: "http://127.0.0.1:5050/rpc/v0_10_2" });
const profile = Bun.TOML.parse(await readFile(resolve(root, "contracts/l3/game/dojo_madara.toml"), "utf8")) as {
  env: { account_address: string; private_key: string };
};
const admin = createMadaraAccount(provider, profile.env.account_address, profile.env.private_key);
const artifactBase = resolve(lab, "native-oracle/contracts/l3/game/target/dev/eternum_lab_slice_systems");
const artifact = readClassArtifact(
  `${artifactBase}.contract_class.json`,
  `${artifactBase}.compiled_contract_class.json`,
);
const codec = new CallData(manifest.world.abi);
const resource = resourceSelector("s2", "lab_slice_systems");
const transactions: { action: string; hash: string }[] = [];

const address = await installFixture();
const game = await createGame();
const accounts: { address: string }[] = await Bun.file(resolve(lab, "native-history-accounts.private.json")).json();
const helperCodec = new CallData(artifact.sierra.abi);
const fixture = (entrypoint: string, args: RawArgs): Call => ({
  contractAddress: address,
  entrypoint,
  calldata: helperCodec.compile(entrypoint, args),
});
const homes = await provisionHomes();
await send("provision_producer", fixture("producer", { game_id: game.gameId, id: homes[0], output: "300000000000" }));
await send(
  "provision_spire",
  fixture("spire", { game_id: game.gameId, coord: { alt: false, x: 2147483628, y: 2147483627 } }),
);
await writeFile(
  resolve(lab, "dojo-slice-setup.json"),
  JSON.stringify(
    {
      world: manifest.world.address,
      gameId: game.gameId,
      homes,
      fixture: { address, classHash: artifact.classHash, abi: artifact.sierra.abi },
      transactions,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ gameId: game.gameId, homes, transactions }));

async function installFixture() {
  await declareClass(admin, artifact, (hash) => transactions.push({ action: "declare_fixture", hash }));
  const before = await provider.callContract(world("resource", { selector: resource }));
  if (Number(before[0]) === 5)
    await send(
      "register_fixture",
      world("register_contract", { namespace: "s2", salt: resource, class_hash: artifact.classHash }),
    );
  const state = await provider.callContract(world("resource", { selector: resource }));
  if (Number(state[0]) !== 2) throw new Error("Lab fixture did not register as a contract");
  const address = state[1];
  if (BigInt(await provider.getClassHashAt(address)) !== BigInt(artifact.classHash))
    await send("upgrade_fixture", world("upgrade_contract", { namespace: "s2", class_hash: artifact.classHash }));
  await send("grant_fixture_writer", world("grant_writer", { resource: byteArrayHash("s2"), contract: address }));
  const initialized = await provider.getEvents({
    address: manifest.world.address,
    from_block: { block_number: 0 },
    to_block: "latest",
    keys: [[hash.getSelectorFromName("ContractInitialized")], [resource]],
    chunk_size: 10,
  });
  if (initialized.events.length === 0)
    await send("initialize_fixture", world("init_contract", { selector: resource, init_calldata: [] }));
  return address;
}

async function createGame() {
  const now = (await provider.getBlock("pre_confirmed")).timestamp;
  const config = getConfigFromNetwork("madara", "eternum");
  try {
    const registered = await registerPreset(admin, buildPresetRegistration(config, 1), manifest);
    transactions.push({ action: "register_preset", hash: registered.transactionHash });
  } catch (error) {
    if (!isRegistrarAlreadyRegisteredError(error)) throw error;
  }
  const params = buildCreateGameParams(config, {
    gameName: `native_parity_${now}`,
    presetId: 1,
    startMainAt: now - 10000,
    durationSeconds: 86400,
    devModeOn: true,
    singleRealmMode: true,
    twoPlayerMode: false,
    useMapOverride: false,
  });
  params.seed = 1;
  const game = process.argv[2]
    ? { gameId: Number(process.argv[2]), transactionHash: undefined }
    : await createRegistrarGame(admin, params, manifest);
  if (!game.gameId) throw new Error("Registrar did not return a game id");
  if (game.transactionHash) transactions.push({ action: "create_game", hash: game.transactionHash });
  return { ...game, gameId: game.gameId };
}

async function provisionHomes() {
  const homes: number[] = [];
  for (let bot = 0; bot < 2; bot++) {
    let id = await realmId(bot);
    if (!id)
      await send(
        "provision_realm",
        fixture("bootstrap", {
          game_id: game.gameId,
          actor: accounts[bot].address,
          coord: { alt: false, x: 2147483626 + bot * 3, y: 2147483626 },
          grants: [
            [26, "1000000000000"],
            [35, "5000000000000"],
            [36, "5000000000000"],
            [38, "100000000000"],
          ],
        }),
      );
    const deadline = Date.now() + 30000;
    while (!id && Date.now() < deadline) {
      await sleep(250);
      id = await realmId(bot);
    }
    if (!id) throw new Error("Provisioned realm did not reach Herald");
    homes.push(id);
  }
  return homes;
}

function world(entrypoint: string, args: RawArgs): Call {
  return { contractAddress: manifest.world.address, entrypoint, calldata: codec.compile(entrypoint, args) };
}
async function send(action: string, call: Call): Promise<string> {
  const tx = await admin.execute(call, { tip: 0, resourceBounds: resolveGameTransactionResourceBounds("madara") });
  await waitForSuccess(admin, tx.transaction_hash);
  transactions.push({ action, hash: tx.transaction_hash });
  return tx.transaction_hash;
}

async function realmId(bot: number): Promise<number | undefined> {
  const response = await fetch(`http://127.0.0.1:3003/madara/games/${game.gameId}/snapshot?models=Structure`);
  if (!response.ok) throw new Error(`Herald fixture lookup failed: ${response.status}`);
  const snapshot = (await response.json()) as { models: { rows: { value: { owner: string; entity_id: string } }[] }[] };
  const row = snapshot.models[0].rows.find((row) => BigInt(row.value.owner) === BigInt(accounts[bot].address));
  return row ? Number(BigInt(row.value.entity_id)) : undefined;
}
