import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Account, ec, hash, RpcProvider, legacyDeployer, shortString } from "starknet";
import { DeviceSigner, deviceKeyOf, joinRealmsAccount } from "@bibliothecadao/eternum";
import { deviceChangeHash } from "../../../packages/identity/src/account";
import { declareClass, readClassArtifact, waitForSuccess } from "../../../config/deployer/clean/shared/declare";
import { feltBytes, NativeProver } from "./native";
import { invokeHash, type Invoke } from "./transaction";

const [rpcUrl, dataDirectory, output] = process.argv.slice(2);
if (!rpcUrl || !dataDirectory || !output) throw new Error("Usage: bun gas.ts ISOLATED_RPC SPIKE_DATA OUTPUT_JSON");
const url = new URL(rpcUrl);
if (!["127.0.0.1", "localhost", "madara"].includes(url.hostname))
  throw new Error("Use the isolated trial's private RPC");
const data = resolve(dataDirectory);
const bootstrap = JSON.parse(readFileSync(join(data, "host-keys.json"), "utf8")) as {
  deployerAddress: string;
  deployerPrivateKey: string;
};
const manifest = JSON.parse(readFileSync(join(data, "native-world.json"), "utf8")) as {
  shard: { chainId: string; accountClassHash: string };
};
const provider = new RpcProvider({ nodeUrl: rpcUrl });
const chain = await provider.getChainId();
if (!/^OPS_(?:SPIKE|NODE_FIRST)_/.test(shortString.decodeShortString(chain)))
  throw new Error("Refusing a chain outside the isolated spike namespace");
if (BigInt(chain) !== BigInt(manifest.shard.chainId)) throw new Error("Fixture chain does not match isolated RPC");
const admin = new Account({
  provider,
  address: bootstrap.deployerAddress,
  signer: bootstrap.deployerPrivateKey,
  deployer: legacyDeployer,
});
const target = resolve(import.meta.dir, "../../../contracts/l3/spike-vrf/target/dev");
const artifacts = Object.fromEntries(
  ["SpikeVerifier", "SpikeBaseline", "SpikeVectors", "VrfSpikeAccount"].map((name) => {
    const prefix = join(target, `node_first_vrf_${name}`);
    return [name, readClassArtifact(`${prefix}.contract_class.json`, `${prefix}.compiled_contract_class.json`)];
  }),
);
for (const artifact of Object.values(artifacts)) await declareClass(admin, artifact, () => {});

const randomKey = () => `0x${Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex")}`;
const secret = randomKey();
const prover = new NativeProver(feltBytes(secret));
const publicKey = prover.publicKey();
const fixtureProver = new NativeProver(feltBytes("190")); // Public upstream vector, isolated vector contract only.
async function deploy(name: string, calldata: string[]): Promise<string> {
  const tx = await admin.deployContract(
    { classHash: artifacts[name].classHash, constructorCalldata: calldata, unique: true },
    { tip: 0 },
  );
  await waitForSuccess(provider, tx.transaction_hash);
  return tx.contract_address;
}
async function actor(classHash: string, label: string) {
  const guardian = randomKey();
  const device = deviceKeyOf(randomKey());
  const account = await joinRealmsAccount({
    provider,
    shard: { chainId: chain, accountClassHash: classHash, guardianPublicKey: ec.starkCurve.getStarkKey(guardian) },
    realmsId: `0x${hash.starknetKeccak(`SPIKE_VRF_${label}_${Date.now()}`).toString(16)}`,
    device,
    approve: async (change) => {
      const signature = ec.starkCurve.sign(deviceChangeHash(change), guardian);
      return [String(signature.r), String(signature.s)];
    },
  });
  return { account, signer: new DeviceSigner(device) };
}
async function rpc(method: string, params: unknown): Promise<any> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await response.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? "Trial RPC refused request");
  return body.result;
}
async function receipt(transactionHash: string) {
  const started = performance.now();
  while (performance.now() - started < 30_000) {
    try {
      return await rpc("starknet_getTransactionReceipt", [transactionHash]);
    } catch {
      await Bun.sleep(20);
    }
  }
  throw new Error("Trial receipt unavailable after30s");
}
function transaction(sender: string, nonce: string, destination: string, selector: string, args: string[]): Invoke {
  return {
    type: "INVOKE",
    version: "0x3",
    sender_address: sender,
    nonce,
    tip: "0x0",
    signature: [],
    calldata: ["0x1", destination, hash.getSelectorFromName(selector), String(args.length), ...args].map(
      (value) => `0x${BigInt(value).toString(16)}`,
    ),
    resource_bounds: {
      l1_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
      l1_data_gas: { max_amount: "0x0", max_price_per_unit: "0x0" },
      l2_gas: { max_amount: "0x47868c00", max_price_per_unit: "0xde0b6b3a7640000" },
    },
    paymaster_data: [],
    account_deployment_data: [],
    nonce_data_availability_mode: "L1",
    fee_data_availability_mode: "L1",
  };
}
async function send(
  who: Awaited<ReturnType<typeof actor>>,
  destination: string,
  selector: string,
  args: string[],
  stamp: boolean,
  corrupt = false,
) {
  const nonce = await rpc("starknet_getNonce", ["pre_confirmed", who.account.address]);
  const tx = transaction(who.account.address, nonce, destination, selector, args);
  const seed = invokeHash(tx, chain);
  tx.signature = await who.signer.signRaw(seed);
  let expectedRoot: string | undefined;
  if (stamp) {
    const witness = prover.proofs([seed])[0];
    expectedRoot = witness[5];
    const proof = witness.slice(0, 5);
    if (corrupt) proof[2] = `0x${(BigInt(proof[2]) + 1n).toString(16)}`;
    tx.signature.push(...proof);
  }
  const result = await rpc("starknet_addInvokeTransaction", { invoke_transaction: tx });
  if (BigInt(result.transaction_hash) !== BigInt(seed)) throw new Error("Stamped hash changed");
  const resultReceipt = await receipt(seed);
  const after = await rpc("starknet_getNonce", ["pre_confirmed", who.account.address]);
  if (BigInt(after) !== BigInt(nonce) + 1n)
    throw new Error("Included action did not consume exactly one account nonce");
  let trace: any = null;
  let traceUnavailable: string | undefined;
  try {
    trace = await rpc("starknet_traceTransaction", [seed]);
  } catch (error) {
    traceUnavailable = String(error);
  }
  if (trace && expectedRoot && !corrupt && resultReceipt.execution_status === "SUCCEEDED") {
    const actual = trace.execute_invocation?.calls?.[0]?.result?.[0];
    if (actual === undefined || BigInt(actual) !== BigInt(expectedRoot)) throw new Error("Node VRF root mismatch");
  }
  return {
    transactionHash: seed,
    status: resultReceipt.execution_status,
    l2Gas: resultReceipt.execution_resources?.l2_gas,
    trace,
    traceUnavailable,
    expectedRoot,
  };
}

try {
  const verifier = await deploy("SpikeVerifier", publicKey);
  const baseline = await deploy("SpikeBaseline", publicKey);
  const vectors = await deploy("SpikeVectors", fixtureProver.publicKey());
  const patched = await actor(artifacts.VrfSpikeAccount.classHash, "patched");
  const original = await actor(manifest.shard.accountClassHash, "original");
  const vector = fixtureProver.proofs(["42"])[0];
  const known = await send(original, vectors, "check", ["42", ...vector.slice(0, 5)], false);
  if (known.status !== "SUCCEEDED") throw new Error("Known-answer vector failed");
  const knownRoot = (
    await rpc("starknet_call", [
      {
        contract_address: vectors,
        entry_point_selector: hash.getSelectorFromName("check"),
        calldata: ["0x2a", ...vector.slice(0, 5)],
      },
      "pre_confirmed",
    ])
  )[0];
  if (knownRoot === undefined || BigInt(knownRoot) !== BigInt(vector[5]))
    throw new Error("Known-answer node root mismatch");
  let originalRejected = false;
  try {
    await send(original, verifier, "verify", [], true);
  } catch (error) {
    originalRejected = /validat|signature/i.test(String(error));
  }
  if (!originalRejected)
    throw new Error("Original account unexpectedly accepts the suffix or failed for another reason");
  const valid = await send(patched, verifier, "verify", [], true);
  const control = await send(patched, baseline, "verify", [], true);
  const invalid = await send(patched, verifier, "verify", [], true, true);
  if (valid.status !== "SUCCEEDED" || control.status !== "SUCCEEDED" || invalid.status !== "REVERTED")
    throw new Error("Valid/control/invalid proof statuses disagree");
  if (typeof valid.l2Gas !== "number" || typeof control.l2Gas !== "number") throw new Error("Node supplied no L2 gas");
  const result = {
    kind: "throwaway-node-vrf",
    chain,
    originalRejected,
    knownAnswerRoot: knownRoot,
    verifier,
    accountClassHash: artifacts.VrfSpikeAccount.classHash,
    gasScope:
      "node transaction L2 gas; marginal=verifier minus matched proof_to_hash baseline, including public-key reads",
    verifierL2Gas: valid.l2Gas,
    baselineL2Gas: control.l2Gas,
    marginalL2Gas: valid.l2Gas - control.l2Gas,
    valid,
    invalid,
    control,
  };
  writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify({
      result: output,
      originalRejected,
      valid: valid.status,
      invalid: invalid.status,
      verifierL2Gas: valid.l2Gas,
      marginalL2Gas: valid.l2Gas - control.l2Gas,
    }),
  );
} finally {
  prover.close();
  fixtureProver.close();
}
