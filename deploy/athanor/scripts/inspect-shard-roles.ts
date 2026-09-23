import { assertPublicRpcBoundary } from "./public-rpc-check";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ec, hash, RpcProvider } from "starknet";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import { assertProviderChain } from "../../../packages/chain/chain-guard.js";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";

if (process.argv[2] === "--public-rpc") {
  if (process.argv.length < 4) throw new Error("Supply at least one public RPC URL");
  for (const url of process.argv.slice(3)) console.log(JSON.stringify(await assertPublicRpcBoundary(url)));
  process.exit(0);
}

const [directory, rpcUrl] = process.argv.slice(2);
if (!directory || !rpcUrl) throw new Error("Usage: bun inspect-shard-roles.ts RUN_DIRECTORY RPC_URL");
const provider = new RpcProvider({ nodeUrl: rpcUrl });
const manifest = readShardManifest<NativeWorldManifest>(resolve(directory, "native-world.json"));
const host: { deployer: { address: string; publicKey: string; classHash: string }; sequencingPublicKey: string } =
  readJson("host-accounts.json");
const identity: { operatorAccountAddress: string } = readJson("gameplay-contracts.json");
const authority: { address: string } = readJson("authority.json");

await assertProviderChain(provider, manifest, "RPC_URL");
await assertGenesisHasNoAccounts();
await assertHostKeys();
const roles = await readRoleHolders();
const devnet = devnetAddresses();
for (const role of roles) {
  if (BigInt(role.address) === 0n || devnet.has(BigInt(role.address))) {
    throw new Error(`${role.role} is zero or a seeded devnet address: ${role.address}`);
  }
}
console.log(JSON.stringify({ passed: true, chainId: manifest.shard.chainId, genesisAccounts: 0, roles }, null, 2));

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(directory, name), "utf8"));
}

function equal(actual: string, expected: string, role: string): void {
  if (BigInt(actual) !== BigInt(expected)) throw new Error(`${role} differs from the host's account`);
}

async function storage(address: string, key: string): Promise<string> {
  return provider.getStorageAt(address, hash.starknetKeccak(key), "latest");
}

async function assertGenesisHasNoAccounts(): Promise<void> {
  const block = await provider.getBlock(0);
  equal(block.sequencer_address, host.deployer.address, "block sequencer");
  const genesis = await provider.getStateUpdate(0);
  const systemContracts = new Set([
    0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bfn,
    0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938dn,
    0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7n,
  ]);
  const addresses = genesis.state_diff.deployed_contracts.map(({ address }) => BigInt(address));
  if (addresses.length !== systemContracts.size || addresses.some((address) => !systemContracts.has(address))) {
    throw new Error("Genesis must contain only the UDC and fee tokens, with no predeployed accounts");
  }
}

async function assertHostKeys(): Promise<void> {
  equal(await provider.getClassHashAt(host.deployer.address, "latest"), host.deployer.classHash, "deployer class");
  equal(await storage(host.deployer.address, "Account_public_key"), host.deployer.publicKey, "deployer key");
  const [sequencingKey] = await provider.callContract(
    {
      contractAddress: authority.address,
      entrypoint: "get_public_key",
      calldata: [],
    },
    "latest",
  );
  equal(sequencingKey, host.sequencingPublicKey, "sequencing key");
  const operator = identity.operatorAccountAddress;
  equal(await provider.getClassHashAt(operator, "latest"), manifest.shard.accountClassHash, "operator class");
  equal(await storage(operator, "guardian_public_key"), host.deployer.publicKey, "operator guardian");
  const [device] = await provider.callContract(
    {
      contractAddress: operator,
      entrypoint: "is_device",
      calldata: [host.deployer.publicKey],
    },
    "latest",
  );
  equal(device, "0x1", "operator device");
  if (
    [host.deployer.publicKey, host.sequencingPublicKey].some(
      (key) => BigInt(key) === BigInt(manifest.shard.guardianPublicKey),
    )
  ) {
    throw new Error("A shard key must not be the identity service guardian key");
  }
}

async function readRoleHolders(): Promise<Array<{ role: string; address: string }>> {
  const [submitter, accountClass] = await provider.callContract(
    { contractAddress: manifest.world.address, entrypoint: "authentication", calldata: [] },
    "latest",
  );
  equal(submitter, authority.address, "admission submitter");
  equal(accountClass, manifest.shard.accountClassHash, "authentication account class");
  const block = await provider.getBlock("latest");
  equal(block.sequencer_address, host.deployer.address, "current block sequencer");
  const administrator = await storage(submitter, "administrator");
  equal(administrator, host.deployer.address, "sequencing administrator");
  const roles = [
    { role: "deployer", address: host.deployer.address },
    { role: "block sequencer", address: block.sequencer_address },
    { role: "sequencing account", address: submitter },
    { role: "sequencing administrator", address: administrator },
    { role: "operator", address: identity.operatorAccountAddress },
  ];
  for (const [name, domain] of Object.entries(manifest.native.domains)) {
    const [address] = await provider.callContract(
      {
        contractAddress: domain.address,
        entrypoint: "domain_state",
        calldata: [],
      },
      "latest",
    );
    equal(address, identity.operatorAccountAddress, `${name} shard authority`);
    roles.push({ role: `${name} shard authority`, address });
  }
  return roles;
}

function devnetAddresses(): Set<bigint> {
  // Upstream 802086d's fixed seed and ten default accounts; never used to submit a transaction.
  return new Set(
    Array.from({ length: 10 }, (_, index) => {
      const key = hash.computePoseidonHash("0x1278b36872363a1276387", 31n ^ ((1n << 64n) - 1n - BigInt(index)));
      const publicKey = ec.starkCurve.getStarkKey(key);
      return BigInt(hash.calculateContractAddressFromHash("0x0", host.deployer.classHash, [publicKey], "0x0"));
    }),
  );
}
