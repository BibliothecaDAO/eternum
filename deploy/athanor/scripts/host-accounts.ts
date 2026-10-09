import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
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
  sequencingPrivateKey: string;
}

export function initializeHostAccounts(directory: string): void {
  const deployerPrivateKey = privateKey();
  const sequencingPrivateKey = privateKey();
  const publicKey = ec.starkCurve.getStarkKey(deployerPrivateKey);
  const deployerAddress = hash.calculateContractAddressFromHash("0x0", ACCOUNT_CLASS_HASH, [publicKey], "0x0");
  const keys: HostKeys = { deployerAddress, deployerPrivateKey, sequencingPrivateKey };
  writeFileSync(resolve(directory, "host-keys.json"), `${JSON.stringify(keys)}\n`, { mode: 0o600, flag: "wx" });
  const vrfPublicKey = ensureShardVrfKey(directory);
  writeFileSync(
    resolve(directory, "host-accounts.json"),
    `${JSON.stringify(
      {
        deployer: { address: deployerAddress, publicKey, classHash: ACCOUNT_CLASS_HASH },
        sequencingPublicKey: ec.starkCurve.getStarkKey(sequencingPrivateKey),
        vrfPublicKey,
      },
      null,
      2,
    )}\n`,
    { flag: "wx" },
  );
  console.log(JSON.stringify({ event: "host_accounts_initialized", deployerAddress }));
}

/** One local VRF scalar beside the host keys; never recover a missing registered key by drawing another. */
export function ensureShardVrfKey(directory: string): [string, string] {
  const hostFile = resolve(directory, "host-keys.json"),
    file = resolve(directory, "vrf-private.key"),
    publicFile = resolve(directory, "host-accounts.json");
  if ((statSync(hostFile).mode & 0o077) !== 0) throw new Error("Host keys must be private");
  const host: HostKeys = JSON.parse(readFileSync(hostFile, "utf8"));
  const published = existsSync(publicFile) ? JSON.parse(readFileSync(publicFile, "utf8")) : null;
  if (!existsSync(file)) {
    if (published?.vrfPublicKey)
      throw new Error("Missing previously registered VRF key; never regenerate it on restart");
    let key = privateKey();
    while (key === host.deployerPrivateKey || key === host.sequencingPrivateKey) key = privateKey();
    writeFileSync(file, key + "\n", { mode: 0o600, flag: "wx" });
  }
  if ((statSync(file).mode & 0o077) !== 0) throw new Error("VRF key file must be private");
  const key = readFileSync(file, "utf8").trim();
  if (key === host.deployerPrivateKey || key === host.sequencingPrivateKey)
    throw new Error("VRF key must be independent");
  let point: { x: bigint; y: bigint };
  try {
    const encoded = ec.starkCurve.getPublicKey(key, false);
    if (encoded.length !== 65 || encoded[0] !== 4) throw new Error();
    point = {
      x: BigInt("0x" + Buffer.from(encoded.slice(1, 33)).toString("hex")),
      y: BigInt("0x" + Buffer.from(encoded.slice(33)).toString("hex")),
    };
  } catch {
    throw new Error("Invalid local VRF key");
  }
  const publicKey: [string, string] = [`0x${point.x.toString(16)}`, `0x${point.y.toString(16)}`];
  if (
    published?.vrfPublicKey &&
    published.vrfPublicKey.some((value: string, index: number) => BigInt(value) !== BigInt(publicKey[index]!))
  )
    throw new Error("VRF private file differs from its published public key");
  if (published && !published.vrfPublicKey)
    writeFileSync(publicFile, JSON.stringify({ ...published, vrfPublicKey: publicKey }, null, 2) + "\n");
  return publicKey;
}

function privateKey(): string {
  return `0x${Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex")}`;
}

async function deployHostAccount(directory: string): Promise<void> {
  const keys: HostKeys = JSON.parse(readFileSync(resolve(directory, "host-keys.json"), "utf8"));
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

if (import.meta.main) {
  const [action, directory] = process.argv.slice(2);
  if (!directory || !["initialize", "initialize-vrf", "deploy"].includes(action))
    throw new Error("Usage: bun host-accounts.ts initialize|initialize-vrf|deploy RUN_DIRECTORY");
  if (action === "initialize") initializeHostAccounts(directory);
  else if (action === "initialize-vrf")
    console.log(JSON.stringify({ event: "shard_vrf_initialized", publicKey: ensureShardVrfKey(directory) }));
  else await deployHostAccount(directory);
}
