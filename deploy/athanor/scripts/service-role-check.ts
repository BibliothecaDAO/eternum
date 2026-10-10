import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hash, RpcProvider } from "starknet";
import { assertProviderChain } from "../../../packages/chain/chain-guard";
import { readShardManifest } from "../../../packages/chain/shard-manifest";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import { createOperatorAccount } from "../../../config/deployer/clean/shared/madara-account";
import { waitForSuccess } from "../../../config/deployer/clean/shared/declare";
import { assertNativeOwnerSigner } from "../../../config/deployer/clean/shared/native-owner";
import { resolveRegistrarExecutionDetails } from "../../../config/deployer/clean/registrar/transaction-details";

interface ServiceRoleContext {
  directory: string;
  manifest: NativeWorldManifest;
  provider: RpcProvider;
  bootstrap: string;
}

interface ServiceRoleCheck extends ServiceRoleContext {
  account: string;
  role: "launcher" | "ledger_operator";
}

async function main(): Promise<void> {
  const [action, directory, role, account, ...extra] = process.argv.slice(2);
  if (!directory || extra.length || !["state", "handoff"].includes(action!))
    throw new Error("Invalid service role check inputs");
  const context = loadServiceRoleContext(directory);
  await assertProviderChain(context.provider, context.manifest, "service role check RPC");
  if (action === "state") {
    const state = await readRoleHandoffState({
      provider: context.provider,
      world: context.manifest.world.address,
      bootstrap: context.bootstrap,
    });
    console.log(JSON.stringify({ passed: true, ...state }));
    return;
  }
  if (!account || !["launcher", "ledger_operator"].includes(role!))
    throw new Error("Invalid service role check inputs");
  const check: ServiceRoleCheck = { ...context, account, role: role as ServiceRoleCheck["role"] };
  await assertWorkerIdentity(check);
  await confirmRole(check);
  console.log(JSON.stringify({ passed: true, role, account }));
}

function loadServiceRoleContext(directory: string): ServiceRoleContext {
  const manifest = readShardManifest<NativeWorldManifest>(resolve(directory, "native-world.json"));
  const rpcUrl = process.env.HARNESS_ADMIN_RPC_URL;
  if (!rpcUrl) throw new Error("Private role RPC is required");
  const identity = JSON.parse(readFileSync(resolve(directory, "gameplay-contracts.json"), "utf8"));
  return {
    directory,
    manifest,
    provider: new RpcProvider({ nodeUrl: rpcUrl }),
    bootstrap: identity.operatorAccountAddress,
  };
}

async function assertWorkerIdentity({ provider, manifest, account, bootstrap }: ServiceRoleCheck): Promise<void> {
  const classHash = await provider.getClassHashAt(account, "latest");
  const guardian = await provider.getStorageAt(account, hash.starknetKeccak("guardian_public_key"), "latest");
  if (
    BigInt(classHash) !== BigInt(manifest.shard.accountClassHash) ||
    BigInt(guardian) !== BigInt(manifest.shard.guardianPublicKey) ||
    BigInt(account) === 0n ||
    BigInt(account) === BigInt(bootstrap)
  )
    throw new Error("Worker role identity differs");
}

async function installedRole(
  provider: Pick<RpcProvider, "callContract">,
  world: string,
  role: string,
): Promise<string> {
  const values = await provider.callContract({ contractAddress: world, entrypoint: role, calldata: [] }, "latest");
  if (values.length !== 1 || typeof values[0] !== "string" || !/^0x[0-9a-fA-F]+$/.test(values[0]))
    throw new Error("Invalid installed role");
  return values[0];
}

export async function readRoleHandoffState({
  provider,
  world,
  bootstrap,
}: {
  provider: Pick<RpcProvider, "callContract">;
  world: string;
  bootstrap: string;
}): Promise<{ handedOff: boolean }> {
  const roles = await Promise.all(
    ["owner", "launcher", "ledger_operator"].map((role) => installedRole(provider, world, role)),
  );
  return { handedOff: roles.some((installed) => BigInt(installed) !== BigInt(bootstrap)) };
}

export async function confirmRole(check: ServiceRoleCheck): Promise<void> {
  const { provider, manifest, account } = check;
  const read = () => installedRole(provider, manifest.world.address, check.role);
  const installed = await read();
  const needsHandoff = BigInt(installed!) !== BigInt(account);
  if (needsHandoff) await sendRoleHandoff(check);
  const confirmed = await read();
  if (BigInt(confirmed!) !== BigInt(account)) throw new Error("Role handoff was not confirmed");
}

async function sendRoleHandoff({ provider, manifest, bootstrap, account, role }: ServiceRoleCheck): Promise<void> {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing protected owner credential");
  const owner = createOperatorAccount(provider, bootstrap, privateKey);
  await assertNativeOwnerSigner(owner, manifest.world.address);
  const sent = await owner.execute(
    {
      contractAddress: manifest.world.address,
      entrypoint: role === "launcher" ? "set_launcher" : "set_ledger_operator",
      calldata: [account],
    },
    await resolveRegistrarExecutionDetails(owner, manifest.world.address),
  );
  await waitForSuccess(provider, sent.transaction_hash);
}

if (import.meta.main) {
  main().catch(() => {
    console.error("Service role check failed; directory remains pending");
    process.exitCode = 1;
  });
}
