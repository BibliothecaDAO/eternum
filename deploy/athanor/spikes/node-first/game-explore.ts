// Convert a completed CreateExplorer wave into its first-reveal Explore fixture.
import { resolve } from "node:path";
import { CallData, RpcProvider } from "starknet";
import { args, load, save, required, trialDirectory, presign, normalize, type Fixture, type Player } from "./common";
import { readClassArtifact } from "../../../../config/deployer/clean/shared/declare";
import { mapWithConcurrency } from "../../harness/account-factory";
import { SetupFailure } from "./provision";

interface CreateResult {
  status: string;
  completed: number;
  contract: string;
  chainId: string;
  game?: { id: number; arm: string; kind: string };
  actions: { executionStatus: string; submitError: unknown }[];
}
async function main() {
  const a = args(["fixture", "result", "out", "private-rpc"]);
  const fixture = load<Fixture>(required(a.fixture, "fixture"));
  const result = load<CreateResult>(required(a.result, "result"));
  const out = required(a.out, "out");
  trialDirectory(out);
  assertCreatedWave(fixture, result);
  const rpc = required(a["private-rpc"], "private-rpc");
  const provider = new RpcProvider({ nodeUrl: rpc });
  if (BigInt(await provider.getChainId()) !== BigInt(fixture.chainId)) throw new SetupFailure("Trial chain mismatch");
  if (BigInt(await provider.getClassHashAt(fixture.contract, "pre_confirmed")) !== BigInt(fixture.classHash))
    throw new SetupFailure("Fixture host class changed");
  const deployed = await provider.getClassAt(fixture.contract, "pre_confirmed");
  const methods = typeof deployed.abi === "string" ? deployed.abi : JSON.stringify(deployed.abi);
  if (!methods.includes('"explore"'))
    throw new SetupFailure("Original CreateExplorer-only host has no Explore entrypoint; use a new fast fixture");
  const hasReadiness = methods.includes('"explore_ready"');
  const artifact = readClassArtifact(
    resolve(import.meta.dir, "artifacts-game/node_first_game_Games.contract_class.json"),
    resolve(import.meta.dir, "artifacts-game/node_first_game_Games.compiled_contract_class.json"),
  );
  const codec = new CallData(artifact.sierra.abi);
  const calldata: string[][] = [];
  const calls = await mapWithConcurrency(fixture.players, 32, (player) =>
    readExploreCall(fixture, player, provider, codec, rpc, hasReadiness),
  );
  fixture.players.forEach((player, index) => {
    calldata[player.botId] = calls[index]!;
  });

  const [counter] = await provider.callContract(
    { contractAddress: fixture.contract, entrypoint: "entity_counter", calldata: [fixture.game!.id] },
    "pre_confirmed",
  );
  save(
    out,
    {
      ...fixture,
      entrypoint: "explore",
      playerCalldata: calldata,
      simulationRpc: rpc,
      game: { ...fixture.game!, kind: "Explore", initialCounter: Number(BigInt(counter!)) },
    },
    true,
  );
  console.log(
    JSON.stringify({
      arm: fixture.game!.arm,
      readyExplorers: fixture.players.length,
      verification: hasReadiness ? "chain view" : "private simulation",
      fixture: out,
    }),
  );
}
async function readExploreCall(
  fixture: Fixture,
  player: Player,
  provider: RpcProvider,
  codec: CallData,
  rpc: string,
  hasReadiness: boolean,
) {
  const original = fixture.playerCalldata![player.botId]!;
  const [id] = await provider.callContract(
    { contractAddress: fixture.contract, entrypoint: "last_entity", calldata: [fixture.game!.id, player.address] },
    "pre_confirmed",
  );
  if (!id || BigInt(id) === 0n) throw new SetupFailure(`Actor ${player.botId}: missing army`);
  const call = [String(fixture.game!.id), BigInt(id).toString(), original[5]!];
  const calldata: string[][] = [];
  calldata[player.botId] = call;
  if (hasReadiness) {
    const [ready] = await provider.callContract(
      {
        contractAddress: fixture.contract,
        entrypoint: "explore_ready",
        calldata: codec.compile("explore_ready", {
          game: fixture.game!.id,
          actor: player.address,
          home: original[1]!,
          explorer: id,
          amount: original[4]!,
          direction: original[5]!,
        }),
      },
      "pre_confirmed",
    );
    if (BigInt(ready!) !== 1n)
      throw new SetupFailure(`Actor ${player.botId}: expired, changed or already-explored army`);
  } else {
    // The earlier Explore host lacks the new read-only gate. Simulation verifies the same actual signed call.
    const candidate = { ...fixture, entrypoint: "explore", playerCalldata: calldata };
    const signed = await presign(candidate, player, provider, 0, 0, 1, 1);
    const tx = JSON.parse(signed.body).params[0];
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: player.botId,
        method: "starknet_simulateTransactions",
        params: ["pre_confirmed", [tx], ["SKIP_FEE_CHARGE"]],
      }),
    });
    const simulation = await response.json();
    const invocation = simulation.result?.[0]?.transaction_trace?.execute_invocation;
    if (simulation.error || !invocation || "revert_reason" in invocation)
      throw new SetupFailure(`Actor ${player.botId}: Explore simulation failed`);
  }
  return call;
}
export function assertCreatedWave(fixture: Fixture, result: CreateResult) {
  if (
    fixture.game?.kind !== "CreateExplorer" ||
    fixture.entrypoint !== "create_explorer" ||
    !fixture.playerCalldata ||
    result.status !== "finished" ||
    result.completed !== fixture.players.length ||
    result.actions.length !== fixture.players.length ||
    result.actions.some((action) => action.executionStatus !== "SUCCEEDED" || action.submitError) ||
    normalize(result.contract) !== normalize(fixture.contract) ||
    BigInt(result.chainId) !== BigInt(fixture.chainId) ||
    result.game?.id !== fixture.game.id ||
    result.game.arm !== fixture.game.arm ||
    result.game.kind !== "CreateExplorer"
  )
    throw new SetupFailure("Create wave incomplete or from another fixture; no Explore fixture published");
}
if (import.meta.main)
  main().catch((error: unknown) => {
    console.error(error instanceof SetupFailure ? error.message : "Explore conversion failed; no credentials emitted");
    process.exitCode = 1;
  });
