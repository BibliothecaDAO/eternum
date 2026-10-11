import { assertPublicRpcBoundary } from "./public-rpc-check";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { ec, hash, RpcProvider } from "starknet";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import { assertProviderChain } from "../../../packages/chain/chain-guard.js";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";

interface HostIdentity {
  deployer: { address: string; publicKey: string; classHash: string };
}
interface RoleInspection {
  provider: Pick<RpcProvider, "getClassHashAt" | "getStorageAt" | "callContract">;
  manifest: NativeWorldManifest;
  host: HostIdentity;
  bootstrap: string;
  initialized: boolean;
}

async function main(): Promise<void> {
  if (process.argv[2] === "--public-rpc") {
    if (process.argv.length < 4) throw new Error("Supply at least one public RPC URL");
    for (const url of process.argv.slice(3)) console.log(JSON.stringify(await assertPublicRpcBoundary(url)));
    return;
  }
  const [directory, rpcUrl] = process.argv.slice(2);
  if (!directory || !rpcUrl) throw new Error("Usage: bun inspect-shard-roles.ts RUN_DIRECTORY RPC_URL");
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const manifest = readShardManifest<NativeWorldManifest>(resolve(directory, "native-world.json"));
  const readJson = <T>(name: string): T => JSON.parse(readFileSync(resolve(directory, name), "utf8"));
  const host = readJson<HostIdentity>("host-accounts.json");
  const { operatorAccountAddress: bootstrap } = readJson<{ operatorAccountAddress: string }>("gameplay-contracts.json");
  await assertProviderChain(provider, manifest, "RPC_URL");
  await assertGenesisHasNoAccounts(provider, host);
  const roles = await inspectGameRoles({
    provider,
    manifest,
    host,
    bootstrap,
    initialized: existsSync(resolve(directory, "initialized.json")),
  });
  console.log(JSON.stringify({ passed: true, chainId: manifest.shard.chainId, genesisAccounts: 0, roles }, null, 2));
}

function equal(actual: string, expected: string, role: string): void {
  if (BigInt(actual) !== BigInt(expected)) throw new Error(`${role} differs from its pinned identity`);
}

async function assertGenesisHasNoAccounts(provider: RpcProvider, host: HostIdentity): Promise<void> {
  const block = await provider.getBlock(0);
  equal(block.sequencer_address, host.deployer.address, "block sequencer");
  const genesis = await provider.getStateUpdate(0);
  const systemContracts = new Set([
    0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bfn,
    0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938dn,
    0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7n,
  ]);
  const addresses = genesis.state_diff.deployed_contracts.map(({ address }) => BigInt(address));
  if (addresses.length !== systemContracts.size || addresses.some((address) => !systemContracts.has(address)))
    throw new Error("Genesis must contain only the UDC and fee tokens, with no predeployed accounts");
}

export async function inspectGameRoles({ provider, manifest, host, bootstrap, initialized }: RoleInspection) {
  equal(await provider.getClassHashAt(host.deployer.address, "latest"), host.deployer.classHash, "deployer class");
  const storage = (address: string, name: string) =>
    provider.getStorageAt(address, hash.starknetKeccak(name), "latest");
  equal(await storage(host.deployer.address, "Account_public_key"), host.deployer.publicKey, "deployer key");
  equal(await provider.getClassHashAt(bootstrap, "latest"), manifest.shard.accountClassHash, "bootstrap class");
  equal(await storage(bootstrap, "guardian_public_key"), manifest.shard.guardianPublicKey, "bootstrap guardian");
  if (!initialized) {
    const [device] = await provider.callContract(
      { contractAddress: bootstrap, entrypoint: "is_device", calldata: [host.deployer.publicKey] },
      "latest",
    );
    equal(device!, "0x1", "bootstrap device");
  }
  if (BigInt(host.deployer.publicKey) === BigInt(manifest.shard.guardianPublicKey))
    throw new Error("Shard signing key cannot be guardian key");
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
  const roles = [{ role: "deployer", address: host.deployer.address }];
  for (const [name, value] of [
    ["Games owner", owner],
    ["Games launcher", launcher],
    ["Games ledger operator", ledger],
  ] as const) {
    if (value.length !== 1) throw new Error("Role view shape differs");
    if (!initialized) equal(value[0]!, bootstrap, name);
    roles.push({ role: name, address: value[0]! });
  }
  if (key.length !== 2 || bound.length !== 1) throw new Error("VRF configuration shape differs");
  equal(key[0]!, manifest.shard.vrfPublicKey.x, "VRF x");
  equal(key[1]!, manifest.shard.vrfPublicKey.y, "VRF y");
  equal(bound[0]!, manifest.shard.l2GasBound, "L2 gas bound");
  if (BigInt(key[0]!) === BigInt(host.deployer.publicKey)) throw new Error("VRF key must be separate from signing key");
  const seeded = devnetAddresses(host);
  for (const role of roles)
    if (BigInt(role.address) === 0n || seeded.has(BigInt(role.address)))
      throw new Error(`${role.role} is zero or a seeded devnet address`);
  return roles;
}

function devnetAddresses(host: HostIdentity): Set<bigint> {
  return new Set(
    Array.from({ length: 10 }, (_, index) => {
      const key = hash.computePoseidonHash("0x1278b36872363a1276387", 31n ^ ((1n << 64n) - 1n - BigInt(index)));
      const publicKey = ec.starkCurve.getStarkKey(key);
      return BigInt(hash.calculateContractAddressFromHash("0x0", host.deployer.classHash, [publicKey], "0x0"));
    }),
  );
}

if (import.meta.main) await main();
