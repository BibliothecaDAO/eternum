import { assertPublicRpcBoundary } from "./public-rpc-check";
import { readFileSync, existsSync } from "node:fs";
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
const host: { deployer: { address: string; publicKey: string; classHash: string } } = readJson("host-accounts.json");
const identity: { operatorAccountAddress: string } = readJson("gameplay-contracts.json");
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
  const operator = identity.operatorAccountAddress;
  equal(await provider.getClassHashAt(operator, "latest"), manifest.shard.accountClassHash, "operator class");
  equal(await storage(operator, "guardian_public_key"), manifest.shard.guardianPublicKey, "operator guardian");
  const [device] = await provider.callContract(
    {
      contractAddress: operator,
      entrypoint: "is_device",
      calldata: [host.deployer.publicKey],
    },
    "latest",
  );
  equal(device, "0x1", "operator device");
  if (BigInt(host.deployer.publicKey) === BigInt(manifest.shard.guardianPublicKey))
    throw new Error("Shard signing key cannot be guardian key");
}

async function readRoleHolders(): Promise<Array<{ role: string; address: string }>> {
  const read = (entrypoint: string) =>
    provider.callContract({ contractAddress: manifest.world.address, entrypoint, calldata: [] }, "latest");
  const [auth, owner, launcher, ledger, key, bound] = await Promise.all([
    read("authentication"),
    read("owner"),
    read("launcher"),
    read("ledger_operator"),
    read("vrf_public_key"),
    read("l2_gas_bound"),
  ]);
  if (auth.length !== 2) throw new Error("Authentication shape differs");
  equal(auth[0]!, manifest.shard.accountClassHash, "account class");
  equal(auth[1]!, manifest.shard.guardianPublicKey, "guardian");
  for (const [name, value] of [
    ["owner", owner],
    ["launcher", launcher],
    ["ledger operator", ledger],
  ] as const) {
    if (value.length !== 1) throw new Error("Role view shape differs");
    if (name === "launcher" && existsSync(resolve(directory, "launcher-enrolment.json"))) {
      const enrolled = readJson<{ chainId: string; world: string; launcherAccount: string }>("launcher-enrolment.json");
      equal(enrolled.chainId, manifest.shard.chainId, "launcher chain");
      equal(enrolled.world, manifest.world.address, "launcher world");
      const current = BigInt(value[0]!);
      if (current !== BigInt(enrolled.launcherAccount) && current !== BigInt(identity.operatorAccountAddress))
        throw new Error("Launcher is neither the bootstrap account nor its recorded Worker handoff");
    } else equal(value[0]!, identity.operatorAccountAddress, name);
  }
  if (key.length !== 2 || bound.length !== 1) throw new Error("VRF configuration shape differs");
  equal(key[0]!, manifest.shard.vrfPublicKey.x, "VRF x");
  equal(key[1]!, manifest.shard.vrfPublicKey.y, "VRF y");
  equal(bound[0]!, manifest.shard.l2GasBound, "L2 gas bound");
  if (BigInt(key[0]!) === BigInt(host.deployer.publicKey)) throw new Error("VRF key must be separate from signing key");
  return [
    { role: "deployer", address: host.deployer.address },
    ...[
      ["Games owner", owner],
      ["Games launcher", launcher],
      ["Games ledger operator", ledger],
    ].map(([role, values]) => ({ role: role as string, address: (values as string[])[0]! })),
  ];
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
