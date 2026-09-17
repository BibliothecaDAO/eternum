import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ec, hash, RpcProvider, uint256 } from "starknet";
import { createMadaraAccount } from "../../../../config/deployer/clean/shared/madara-account";
import {
  declareClass,
  readClassArtifact,
  rpcErrorCode,
  waitForSuccess,
} from "../../../../config/deployer/clean/shared/declare";

// Public local fixture credential; roots are supplied through the recorded envelope.
const SIGNING_KEY = "0xd431";
const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const root = resolve(import.meta.dir, "../../../..");
const output = resolve(root, "deploy/madara-lab/.lab/native-sequencer.json");
const provider = new RpcProvider({ nodeUrl: "http://127.0.0.1:5050/rpc/v0_10_2" });
const adminAddress = process.env.NATIVE_ACCOUNT_ADDRESS;
const adminKey = process.env.NATIVE_PRIVATE_KEY;
if (!adminAddress || !adminKey) throw new Error("NATIVE_ACCOUNT_ADDRESS and NATIVE_PRIVATE_KEY are required");
const admin = createMadaraAccount(provider, adminAddress, adminKey);
const transactions: string[] = [];
const seed = process.argv[2];
if (!seed) throw new Error("Usage: bun prepare-authority.ts SEED [NATIVE_MANIFEST]");
const prefix = resolve(root, "contracts/l3/world-native/target/dev/world_native_SequencingAccount");
const artifact = readClassArtifact(`${prefix}.contract_class.json`, `${prefix}.compiled_contract_class.json`);
const constructorCalldata = [admin.address, ec.starkCurve.getStarkKey(SIGNING_KEY)];
const salt = hash.starknetKeccak(`${seed}:sequencing-authority`).toString();
const address = hash.calculateContractAddressFromHash(salt, artifact.classHash, constructorCalldata, 0);

await prepareAccount();
await fundAccount();
if (process.argv[3]) await bindWorld(process.argv[3]);
await writeFile(
  output,
  `${JSON.stringify({ address, classHash: artifact.classHash, seed, signingKey: SIGNING_KEY, transactions }, null, 2)}\n`,
  { mode: 0o600 },
);
console.log(JSON.stringify({ event: "native_lab_authority", address, transactions, output }));

async function prepareAccount() {
  await declareClass(admin, artifact, (transaction) => transactions.push(transaction));
  try {
    const actual = await provider.getClassHashAt(address, "latest");
    if (BigInt(actual) !== BigInt(artifact.classHash)) throw new Error("Authority class differs");
    return;
  } catch (error) {
    if (rpcErrorCode(error) !== 20) throw error;
  }
  const transaction = await admin.deployContract(
    { classHash: artifact.classHash, salt, constructorCalldata, unique: false },
    { tip: 0 },
  );
  await record(transaction.transaction_hash);
}

async function fundAccount() {
  const [low, high] = await provider.callContract(
    { contractAddress: STRK, entrypoint: "balanceOf", calldata: [address] },
    "latest",
  );
  const balance = BigInt(low) + (BigInt(high) << 128n);
  const minimum = 10n ** 18n;
  if (balance >= minimum) return;
  const amount = uint256.bnToUint256(minimum - balance);
  const transaction = await admin.execute(
    { contractAddress: STRK, entrypoint: "transfer", calldata: [address, amount.low, amount.high] },
    { tip: 0 },
  );
  await record(transaction.transaction_hash);
}

async function bindWorld(path: string) {
  const manifest = JSON.parse(await readFile(path, "utf8"));
  if (!manifest.native) throw new Error("Expected a native manifest");
  // The pinned account stores this immutable peer under its named storage slot.
  const current = BigInt(await provider.getStorageAt(address, hash.starknetKeccak("deployment"), "latest"));
  if (current === BigInt(manifest.world.address)) return;
  if (current !== 0n) throw new Error("Authority is already bound to another world");
  const transaction = await admin.execute(
    { contractAddress: address, entrypoint: "configure", calldata: [manifest.world.address] },
    { tip: 0 },
  );
  await record(transaction.transaction_hash);
}

async function record(transaction: string) {
  transactions.push(transaction);
  await waitForSuccess(provider, transaction);
}
