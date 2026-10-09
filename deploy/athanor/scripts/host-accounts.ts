import { readPrivateJson, writePrivateJsonOnce } from "./private-file";
import { createShardVrfKey, readShardVrfPoint } from "../vrf/key-file";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ec, hash, RpcProvider } from "starknet";
import { assertProviderChain } from "../../../packages/chain/chain-guard.js";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";
import { createMadaraAccount } from "../../../config/deployer/clean/shared/madara-account";
import { deployedClass, waitForSuccess } from "../../../config/deployer/clean/shared/declare";

// AccountUpgradeable declared by the pinned upstream Madara 802086d genesis, including with zero accounts.
const ACCOUNT_CLASS_HASH = "0xe2eb8f5672af4e6a4e8a8f1b44989685e668489b0a25437733756c5a34a1d6";

interface HostKeys {
  deployerAddress: string;
  deployerPrivateKey: string;
}

function initializeHostAccounts(directory: string): void {
  const keyPath = resolve(directory, "host-keys.json");
  const publicPath = resolve(directory, "host-accounts.json");
  if (existsSync(publicPath) && (!existsSync(keyPath) || !existsSync(resolve(directory, "vrf-key.json"))))
    throw new Error("Existing host identity is missing credentials; restore the same shard backup before retrying");
  const existing = existsSync(keyPath) ? readPrivateJson<HostKeys>(keyPath) : undefined;
  const deployerPrivateKey = existing?.deployerPrivateKey ?? privateKey();
  const vrfPublicKey = existsSync(resolve(directory, "vrf-key.json")) ? readShardVrfPoint(directory) : createShardVrfKey(directory);
  const publicKey = ec.starkCurve.getStarkKey(deployerPrivateKey);
  const deployerAddress = hash.calculateContractAddressFromHash("0x0", ACCOUNT_CLASS_HASH, [publicKey], "0x0");
  const keys: HostKeys = { deployerAddress, deployerPrivateKey };
  if (existing && BigInt(existing.deployerAddress) !== BigInt(deployerAddress)) throw new Error("Host key and recorded deployer identity differ");
  if (!existing) writePrivateJsonOnce(keyPath, keys);
  const host = { deployer: { address: deployerAddress, publicKey, classHash: ACCOUNT_CLASS_HASH }, vrfPublicKey };
  if (!existsSync(publicPath)) writePrivateJsonOnce(publicPath, host);
  else {
    const recorded = JSON.parse(readFileSync(publicPath, "utf8"));
    if (BigInt(recorded.deployer.address) !== BigInt(deployerAddress) || BigInt(recorded.deployer.publicKey) !== BigInt(publicKey))
      throw new Error("Host key and public identity differ; restore the same shard backup before retrying");
  }
  console.log(JSON.stringify({ event: "host_accounts_initialized", deployerAddress }));
}

function privateKey(): string {
  return `0x${Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex")}`;
}

async function deployHostAccount(directory: string): Promise<void> {
  const keys = readPrivateJson<HostKeys>(resolve(directory, "host-keys.json"));
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("RPC_URL is required");
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  await assertProviderChain(provider, readShardManifest(process.env.NATIVE_WORLD_MANIFEST), "RPC_URL");
  // A first initialization that stopped after this step reruns it: the deployed account is kept, never redeployed.
  const deployed = await deployedClass(provider, keys.deployerAddress);
  if (deployed !== null) {
    if (BigInt(deployed) !== BigInt(ACCOUNT_CLASS_HASH))
      throw new Error("The host deployer address holds another class");
    console.log(JSON.stringify({ event: "host_account_present", address: keys.deployerAddress }));
    return;
  }
  const account = createMadaraAccount(provider, keys.deployerAddress, keys.deployerPrivateKey);
  const result = await account.deployAccount(
    {
      classHash: ACCOUNT_CLASS_HASH,
      constructorCalldata: [ec.starkCurve.getStarkKey(keys.deployerPrivateKey)],
      addressSalt: "0x0",
      contractAddress: keys.deployerAddress,
    },
    { tip: 0 },
  );
  await waitForSuccess(provider, result.transaction_hash);
  console.log(
    JSON.stringify({
      event: "host_account_deployed",
      address: keys.deployerAddress,
      transaction: result.transaction_hash,
    }),
  );
}

const [action, directory] = process.argv.slice(2);
if (!directory || !["initialize", "deploy", "verify-vrf"].includes(action)) {
  throw new Error("Usage: bun host-accounts.ts initialize|deploy|verify-vrf RUN_DIRECTORY");
}
if (action === "initialize") initializeHostAccounts(directory);
else if (action === "verify-vrf") {
  const expected = JSON.parse(readFileSync(resolve(directory, "host-accounts.json"), "utf8")).vrfPublicKey;
  const actual = readShardVrfPoint(directory);
  if (!expected || BigInt(expected.x) !== BigInt(actual.x) || BigInt(expected.y) !== BigInt(actual.y))
    throw new Error("Shard VRF credential and recorded identity differ");
  console.log(JSON.stringify({ event: "shard_vrf_key_verified" }));
} else await deployHostAccount(directory);
