import { sourceProvenance } from "./source-provenance";
import { runMeasuredSlice } from "./measured-slice";
import { resolve } from "node:path";
import { Account, CallData, RpcProvider, uint256, type Call } from "starknet";
import { createGameClient } from "@bibliothecadao/eternum";
import { buildWorldDeployment } from "@bibliothecadao/eternum/game-client";
import { createMicrotaskGameSyncScheduler } from "@bibliothecadao/eternum/game-sync";
import { resolveGameTransactionResourceBounds, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { getConfigFromNetwork } from "../../../../config/utils/utils";
import { observeActions } from "./action-evidence";
import { discoveryFixture } from "./root-fixture";

const provenance = await sourceProvenance(true);
const root = resolve(import.meta.dir, "../../../..");
const lab = resolve(root, "deploy/madara-lab/.lab");
if (!process.env.GAME_MANIFEST_PATH) throw new Error("GAME_MANIFEST_PATH must identify the Dojo baseline");
const manifest = await Bun.file(process.env.GAME_MANIFEST_PATH).json();
const identity = await Bun.file(resolve(lab, "gameplay-contracts.json")).json();
const setup = await Bun.file(resolve(lab, "dojo-slice-setup.json")).json();
if (setup.world !== manifest.world.address) throw new Error("Fixture and baseline deployment differ");
const records: { address: string; privateKey: string }[] = await Bun.file(
  resolve(lab, "native-history-accounts.private.json"),
).json();
const rpcUrl = "http://127.0.0.1:5050/rpc/v0_10_2";
const provider = new RpcProvider({ nodeUrl: rpcUrl });
const players = records.map((record) => new Account({ provider, address: record.address, signer: record.privateKey }));
let timestamp = (await provider.getBlock("pre_confirmed")).timestamp;
let confirmedTimestamp = 0;
const discovery = discoveryFixture(setup.gameId, () => timestamp);
const roots: { command: string; root: string; timestamp: number }[] = [];
const fixtureCodec = new CallData(setup.fixture.abi);
for (const player of players) {
  let nonce = BigInt(await provider.getNonceForAddress(player.address, "latest"));
  const execute = player.execute.bind(player);
  player.execute = async (calls, details) => {
    const batch = Array.isArray(calls) ? calls : [calls];
    const random = batch.find(
      (call) =>
        call.entrypoint === "attack_explorer_vs_explorer" ||
        (call.entrypoint === "explorer_move" && Number((call.calldata as string[]).at(-1)) === 1),
    );
    const raw = random?.entrypoint === "explorer_move" ? discovery.read().root : 1n;
    if (random) roots.push({ command: random.entrypoint, root: raw.toString(), timestamp: timestamp - 1 });
    const prefix: Call[] = random
      ? [
          {
            contractAddress: setup.fixture.address,
            entrypoint: "prepare_root",
            calldata: fixtureCodec.compile("prepare_root", {
              game_id: setup.gameId,
              raw_root: uint256.bnToUint256(raw),
            }),
          },
        ]
      : [];
    const transaction = await execute([...prefix, ...batch], { ...details, nonce });
    nonce++;
    return transaction;
  };
}
const evidence = observeActions();
const client = await connectClient();
setBlockTimestampSource(() => timestamp);
const movement = manifest.contracts.find((contract: { tag: string }) => contract.tag === "s2-troop_movement_systems");
if (!movement) throw new Error("Missing Dojo movement system");
await runMeasuredSlice(
  {
    client,
    players,
    homes: setup.homes,
    time: () => confirmedTimestamp,
    prepareExplore: discovery.prepare,
    claim: () =>
      client.setup.network.provider.executeAndCheckTransaction(players[0], {
        contractAddress: setup.fixture.address,
        entrypoint: "claim",
        calldata: [setup.gameId, setup.homes[0]],
      }),
    explore: (bot, explorerId, direction) =>
      client.setup.network.provider.executeAndCheckTransaction(players[bot], {
        contractAddress: movement.address,
        entrypoint: "explorer_move",
        calldata: [explorerId, [direction], 1],
      }),
  },
  provider,
  evidence,
  resolve(lab, `dojo-slice-${setup.gameId}.json`),
  { provenance, gameId: setup.gameId, world: manifest.world.address, poolOverrides: false, roots },
);

async function connectClient() {
  return createGameClient({
    world: buildWorldDeployment({
      id: "dojo-baseline",
      chain: "madara",
      manifest,
      heraldBaseUrl: "http://127.0.0.1:3003",
      rpcUrl,
      browserFacing: false,
      ...identity,
    }),
    gameId: setup.gameId,
    presetId: 1,
    dojoConfig: { manifest, rpcUrl },
    setupEnvironment: {
      vrfProviderAddress: "0x0",
      executionResourceBounds: resolveGameTransactionResourceBounds("madara"),
    },
    scheduler: createMicrotaskGameSyncScheduler(),
    socketFactory: evidence.socketFactory,
    resolveGameConfig: () => getConfigFromNetwork("madara", "eternum"),
    observer: {
      ...evidence.observer,
      onSetupCompleted: () => console.log("client_setup_complete"),
      onSubscriptionActive: () => console.log("client_subscribed"),
      onSnapshotPhaseCompleted: (phase, ms) => console.log(JSON.stringify({ phase, ms })),
      onHead: (head) => {
        timestamp = Math.max(timestamp, head.timestamp);
        if (!head.preconfirmed) confirmedTimestamp = head.timestamp;
      },
    },
  });
}
