import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ec, hash, RpcProvider } from "starknet";
import { NativeProver, feltBytes } from "./native";
import { invokeHash, type Invoke } from "./transaction";
import { VRF_STAMP_TAG } from "./wire";
import { rpc, RpcRefusal } from "./rpc";
import { load, save, loopback, trialDirectory, presign, type Fixture } from "../spikes/node-first/common";
import { DeviceSigner, deviceKeyOf } from "../../../packages/core/src/account/realms-account";
import { createMadaraAccount } from "../../../config/deployer/clean/shared/madara-account";
import { declareClass, readClassArtifact, waitForSuccess } from "../../../config/deployer/clean/shared/declare";

async function main() {
  const [url, fixtureFile, keyFile, hostFile, output] = process.argv.slice(2);
  if (!url || !fixtureFile || !keyFile || !hostFile || !output) throw new Error("Missing probe inputs");
  loopback(url);
  const dir = trialDirectory(output),
    fixture = load<Fixture>(fixtureFile);
  if (!fixture.verifyProofs || !fixture.game || !fixture.players.length)
    throw new Error("Use a verified real-action fixture");
  const provider = new RpcProvider({ nodeUrl: url });
  if (BigInt(await provider.getChainId()) !== BigInt(fixture.chainId)) throw new Error("Probe chain mismatch");
  const player = fixture.players[0]!,
    signer = new DeviceSigner(deviceKeyOf(player.privateKey));
  const prover = new NativeProver(feltBytes(readFileSync(keyFile, "utf8").trim()));
  const other = new NativeProver(Buffer.from(ec.starkCurve.utils.randomPrivateKey()));
  const rows: Record<string, unknown>[] = [];
  const snapshot = () =>
    rpc(url, "starknet_call", [
      {
        contract_address: fixture.contract,
        entry_point_selector: hash.getSelectorFromName(
          fixture.game!.kind === "Settle"
            ? "settle_state"
            : fixture.game!.kind === "Explore"
              ? "explorer_snapshot"
              : "last_entity",
        ),
        calldata: [
          String(fixture.game!.id),
          fixture.game!.kind === "Explore" ? fixture.playerCalldata![player.botId]![1]! : player.address,
        ],
      },
      "pre_confirmed",
    ]);
  const make = async () =>
    JSON.parse((await presign(fixture, player, provider, 0, 1, 32, 256)).body).params[0] as Invoke;
  const prefix = async (tx: Invoke) => ({ ...tx, signature: await signer.signRaw(invokeHash(tx, fixture.chainId)) });
  const stamp = (tx: Invoke, source = prover) => ({
    ...tx,
    signature: [...tx.signature, VRF_STAMP_TAG, ...source.proofs([invokeHash(tx, fixture.chainId)])[0]!.slice(0, 5)],
  });
  async function submit(tx: Invoke) {
    const before = await snapshot(),
      seed = invokeHash(tx, fixture.chainId);
    let result: any;
    try {
      result = await rpc(url, "starknet_addInvokeTransaction", { invoke_transaction: tx });
    } catch (error) {
      if (!(error instanceof RpcRefusal)) throw error;
      return {
        status: "REJECTED",
        code: error.code,
        transactionHash: seed,
        unchanged: JSON.stringify(await snapshot()) === JSON.stringify(before),
        nonceConsumed: false,
      };
    }
    if (BigInt(result.transaction_hash) !== BigInt(seed)) throw new Error("Probe hash changed");
    const started = performance.now();
    let receipt: any;
    while (performance.now() - started < 180000) {
      try {
        receipt = await rpc(url, "starknet_getTransactionReceipt", [seed]);
        if (["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(receipt.finality_status)) break;
      } catch (error) {
        if (!(error instanceof RpcRefusal) || error.code !== 29) throw error;
      }
      await Bun.sleep(25);
    }
    if (!receipt || !["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(receipt.finality_status))
      throw new Error("Probe receipt not sealed");
    let gameWrites: number | null = null;
    try {
      const trace = await rpc(url, "starknet_traceTransaction", [seed]);
      gameWrites = (trace.state_diff?.storage_diffs ?? [])
        .filter((row: any) => BigInt(row.address ?? row.contract_address) === BigInt(fixture.contract))
        .reduce((count: number, row: any) => count + (row.storage_entries ?? []).length, 0);
    } catch (error) {
      if (!(error instanceof RpcRefusal)) throw error;
    }
    const rejected = (receipt.events ?? []).some((event: any) =>
      event.keys.some((key: string) => BigInt(key) === BigInt(hash.getSelectorFromName("GameplayRejected"))),
    );
    const nonce = await rpc(url, "starknet_getNonce", ["pre_confirmed", player.address]);
    return {
      status: receipt.execution_status,
      transactionHash: seed,
      rejected,
      unchanged: JSON.stringify(await snapshot()) === JSON.stringify(before),
      gameWrites,
      nonceConsumed: BigInt(nonce) === BigInt(tx.nonce) + 1n,
      gas: receipt.execution_resources,
    };
  }
  async function refusal(name: string, tx: Invoke) {
    const result = await submit(tx);
    const passed =
      result.status !== "SUCCEEDED" &&
      result.unchanged &&
      ("gameWrites" in result && result.gameWrites !== null ? result.gameWrites === 0 : true);
    rows.push({ name, ...result, passed });
    if (!passed) throw new Error("Proof refusal probe failed");
  }
  try {
    if (prover.publicKey().some((value, i) => BigInt(value) !== BigInt(fixture.vrfPublicKey![i]!)))
      throw new Error("Probe key mismatch");
    await refusal("unstamped_before_roll", await make());
    for (let field = 0; field < 5; field++) {
      const tx = stamp(await make());
      tx.signature[field + 4] = `0x${(BigInt(tx.signature[field + 4]!) ^ 1n).toString(16)}`;
      await refusal(`forged_field_${field}`, tx);
    }
    await refusal("proof_from_other_key", stamp(await make(), other));
    const wrongSeed = await make();
    wrongSeed.signature.push(VRF_STAMP_TAG, ...prover.proofs(["0xdeadbeef"])[0]!.slice(0, 5));
    await refusal("proof_from_other_transaction", wrongSeed);
    for (const [name, value] of [
      ["zero", 0n],
      ["maximum", (1n << 251n) + 17n * (1n << 192n)],
    ] as const) {
      const tx = await make();
      tx.signature.push(VRF_STAMP_TAG, ...Array(5).fill(`0x${value.toString(16)}`));
      await refusal(`all_${name}_felts`, tx);
    }
    const offCurve = stamp(await make());
    offCurve.signature[4] = "0x0";
    offCurve.signature[5] = "0x0";
    await refusal("off_curve_gamma", offCurve);
    const low = await make();
    low.resource_bounds.l2_gas.max_amount = "0x1000000";
    await refusal("insufficient_bound_before_roll", stamp(await prefix(low)));
    const multi = await make();
    multi.calldata = ["0x2", ...multi.calldata.slice(1), ...multi.calldata.slice(1)];
    await refusal("stamped_multicall", stamp(await prefix(multi)));
    // This predicate does not depend on the draw. The caught library failure must roll back all effects.
    const invalid = await make();
    if (fixture.game.kind === "Settle") invalid.calldata[5] = "0x0";
    else if (fixture.game.kind === "CreateExplorer") invalid.calldata[8] = "0x0";
    else invalid.calldata[5] = "0x0";
    const rejected = await submit(stamp(await prefix(invalid)));
    const recorded =
      rejected.status === "SUCCEEDED" && "rejected" in rejected && rejected.rejected && rejected.unchanged;
    rows.push({ name: "root_independent_gameplay_refusal_recorded", ...rejected, passed: recorded });
    if (!recorded) throw new Error("Gameplay refusal was not recorded");
    const valid = stamp(await make()),
      applied = await submit(valid);
    const validPassed =
      applied.status === "SUCCEEDED" && !("rejected" in applied && applied.rejected) && !applied.unchanged;
    rows.push({ name: "valid_proof_applied", ...applied, passed: validPassed });
    if (!validPassed) throw new Error("Valid action did not apply");
    const repeat = await submit(valid);
    rows.push({ name: "consumed_nonce_replay", ...repeat, passed: repeat.status !== "SUCCEEDED" && repeat.unchanged });
    if (repeat.status === "SUCCEEDED" || !repeat.unchanged) throw new Error("Replay applied");
    const host = load<{ deployerAddress: string; deployerPrivateKey: string }>(hostFile);
    const admin = createMadaraAccount(provider, host.deployerAddress, host.deployerPrivateKey);
    const stem = resolve(import.meta.dir, "../spikes/node-first/artifacts-game/node_first_game_DrawProbe");
    const artifact = readClassArtifact(`${stem}.contract_class.json`, `${stem}.compiled_contract_class.json`);
    await declareClass(admin, artifact, () => {});
    const deployment = await admin.deployContract(
      { classHash: artifact.classHash, constructorCalldata: [], unique: true },
      { tip: 0 },
    );
    await waitForSuccess(provider, deployment.transaction_hash);
    const witness = prover.proofs([invokeHash(valid, fixture.chainId)])[0]!,
      rawRoot = BigInt(witness[5]!);
    const vectors: string[][] = [];
    for (const clock of [0n, 360n, 86400n, (1n << 64n) - 1n])
      vectors.push(
        await rpc(url, "starknet_call", [
          {
            contract_address: deployment.contract_address,
            entry_point_selector: hash.getSelectorFromName("vector"),
            calldata: [
              `0x${(rawRoot % (1n << 128n)).toString(16)}`,
              `0x${(rawRoot >> 128n).toString(16)}`,
              `0x${clock.toString(16)}`,
            ],
          },
          "latest",
        ]),
      );
    const same = vectors.every((value) => JSON.stringify(value) === JSON.stringify(vectors[0]));
    rows.push({ name: "fixed_root_draws_at_four_clocks", passed: same });
    if (!same) throw new Error("Clock changed draw");
  } finally {
    prover.close();
    other.close();
    save(resolve(dir, "probes-public.json"), {
      rows,
      traceRequirement: "null gameWrites means trace unavailable; do not call full storage invariance measured",
      crashDurability: "requires ops drill separately",
    });
  }
  console.log(JSON.stringify({ report: resolve(dir, "probes-public.json"), passed: rows.length }));
}
if (import.meta.main)
  main().catch(() => {
    console.error("VRF probes failed; private inputs withheld");
    process.exitCode = 1;
  });
