import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ec, hash, RpcProvider } from "starknet";
import { assertProviderChain } from "../../../packages/chain/chain-guard.js";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";
import { createMadaraAccount } from "../../../config/deployer/clean/shared/madara-account";
import { waitForSuccess } from "../../../config/deployer/clean/shared/declare";

// AccountUpgradeable declared by the pinned upstream Madara 802086d genesis, including with zero accounts.
const ACCOUNT_CLASS_HASH = "0xe2eb8f5672af4e6a4e8a8f1b44989685e668489b0a25437733756c5a34a1d6";

interface HostKeys {
  deployerAddress: string;
  deployerPrivateKey: string;
  sequencingPrivateKey: string;
}

function initializeHostAccounts(directory: string): void {
  const deployerPrivateKey = privateKey();
  const sequencingPrivateKey = privateKey();
  const publicKey = ec.starkCurve.getStarkKey(deployerPrivateKey);
  const deployerAddress = hash.calculateContractAddressFromHash("0x0", ACCOUNT_CLASS_HASH, [publicKey], "0x0");
  const keys: HostKeys = { deployerAddress, deployerPrivateKey, sequencingPrivateKey };
  writeFileSync(resolve(directory, "host-keys.json"), `${JSON.stringify(keys)}\n`, { mode: 0o600, flag: "wx" });
  writeFileSync(
    resolve(directory, "host-accounts.json"),
    `${JSON.stringify(
      {
        deployer: { address: deployerAddress, publicKey, classHash: ACCOUNT_CLASS_HASH },
        sequencingPublicKey: ec.starkCurve.getStarkKey(sequencingPrivateKey),
      },
      null,
      2,
    )}\n`,
    { flag: "wx" },
  );
  console.log(JSON.stringify({ event: "host_accounts_initialized", deployerAddress }));
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
if (!directory || !["initialize", "deploy"].includes(action)) {
  throw new Error("Usage: bun host-accounts.ts initialize|deploy RUN_DIRECTORY");
}
if (action === "initialize") initializeHostAccounts(directory);
else await deployHostAccount(directory);
