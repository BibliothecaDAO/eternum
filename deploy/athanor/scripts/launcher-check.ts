import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hash, RpcProvider } from "starknet";
import { assertProviderChain } from "../../../packages/chain/chain-guard";
import { readShardManifest } from "../../../packages/chain/shard-manifest";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import { createOperatorAccount } from "../../../config/deployer/clean/shared/madara-account";
import { waitForSuccess } from "../../../config/deployer/clean/shared/declare";
import { confirmedTransactionReceipt } from "../../../config/deployer/clean/shared/transaction";
import { resolveCreatedGameId } from "../../../config/deployer/clean/registrar/calls";
import { resolveRegistrarExecutionDetails } from "../../../config/deployer/clean/registrar/transaction-details";

export function assertWorkerCreation(
  tx: { type: string; sender_address?: string; calldata?: string[] },
  expected: { account: string; world: string; name: string; preset: number },
): void {
  const data = tx.calldata ?? [];
  if (
    tx.type !== "INVOKE" ||
    BigInt(tx.sender_address ?? 0) !== BigInt(expected.account) ||
    data.length < 6 ||
    BigInt(data[0]!) !== 1n ||
    BigInt(data[1]!) !== BigInt(expected.world) ||
    BigInt(data[2]!) !== BigInt(hash.getSelectorFromName("create_game")) ||
    BigInt(data[3]!) !== BigInt(data.length - 4) ||
    BigInt(data[4]!) !== BigInt(expected.name) ||
    BigInt(data[5]!) !== BigInt(expected.preset)
  )
    throw new Error("Worker check must be its own single Games.create_game invoke");
}

interface LauncherCheck {
  directory: string;
  manifest: NativeWorldManifest;
  provider: RpcProvider;
  bootstrap: string;
  account: string;
}

async function main(): Promise<void> {
  const [action, directory, account, txHash, name, preset] = process.argv.slice(2);
  if (!directory || !account || !["handoff", "verify"].includes(action!))
    throw new Error("Invalid launcher check inputs");
  const check = loadLauncherCheck(directory, account);
  await assertProviderChain(check.provider, check.manifest, "launcher check RPC");
  await assertWorkerIdentity(check);
  await confirmLauncher(check, action!);
  if (action === "verify") {
    if (!txHash || !name || !preset) throw new Error("Worker creation proof missing");
    await verifyWorkerGame(check, { txHash, name, preset: Number(preset) });
  }
  console.log(JSON.stringify({ passed: true, launcher: account }));
}

function loadLauncherCheck(directory: string, account: string): LauncherCheck {
  const manifest = readShardManifest<NativeWorldManifest>(resolve(directory, "native-world.json"));
  const rpcUrl = process.env.HARNESS_ADMIN_RPC_URL;
  if (!rpcUrl) throw new Error("Private launcher RPC is required");
  const identity = JSON.parse(readFileSync(resolve(directory, "gameplay-contracts.json"), "utf8"));
  return {
    directory,
    manifest,
    provider: new RpcProvider({ nodeUrl: rpcUrl }),
    bootstrap: identity.operatorAccountAddress,
    account,
  };
}

async function assertWorkerIdentity({ provider, manifest, account, bootstrap }: LauncherCheck): Promise<void> {
  const classHash = await provider.getClassHashAt(account, "latest");
  const guardian = await provider.getStorageAt(account, hash.starknetKeccak("guardian_public_key"), "latest");
  if (
    BigInt(classHash) !== BigInt(manifest.shard.accountClassHash) ||
    BigInt(guardian) !== BigInt(manifest.shard.guardianPublicKey) ||
    BigInt(account) === 0n ||
    BigInt(account) === BigInt(bootstrap)
  )
    throw new Error("Worker launcher identity differs");
}

async function confirmLauncher(check: LauncherCheck, action: string): Promise<void> {
  const { provider, manifest, bootstrap, account } = check;
  const read = () =>
    provider.callContract({ contractAddress: manifest.world.address, entrypoint: "launcher", calldata: [] }, "latest");
  const [installed] = await read();
  const needsHandoff = BigInt(installed!) !== BigInt(account);
  if (needsHandoff && (action !== "handoff" || BigInt(installed!) !== BigInt(bootstrap)))
    throw new Error("Unexpected installed launcher");
  if (action === "handoff") recordLauncherIntent(check);
  if (needsHandoff) await sendLauncherHandoff(check);
  const [confirmed] = await read();
  if (BigInt(confirmed!) !== BigInt(account)) throw new Error("Launcher handoff was not confirmed");
}

function recordLauncherIntent({ directory, manifest, account }: LauncherCheck): void {
  writeFileSync(
    resolve(directory, "launcher-enrolment.json"),
    JSON.stringify({
      chainId: manifest.shard.chainId,
      world: manifest.world.address,
      launcherAccount: account,
    }),
    { mode: 0o600 },
  );
}

async function sendLauncherHandoff({ provider, manifest, bootstrap, account }: LauncherCheck): Promise<void> {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing protected owner credential");
  const owner = createOperatorAccount(provider, bootstrap, privateKey);
  const sent = await owner.execute(
    { contractAddress: manifest.world.address, entrypoint: "set_launcher", calldata: [account] },
    resolveRegistrarExecutionDetails(),
  );
  await waitForSuccess(provider, sent.transaction_hash);
}

async function verifyWorkerGame(
  { provider, manifest, account }: LauncherCheck,
  { txHash, name, preset }: { txHash: string; name: string; preset: number },
): Promise<void> {
  const receipt = await confirmedTransactionReceipt(provider, txHash);
  const tx = await provider.getTransactionByHash(txHash);
  assertWorkerCreation(tx, { account, world: manifest.world.address, name, preset });
  const gameId = resolveCreatedGameId(receipt, manifest);
  const [named] = await provider.callContract(
    { contractAddress: manifest.world.address, entrypoint: "game_id_by_name", calldata: [name] },
    "latest",
  );
  if (!gameId || BigInt(named!) !== BigInt(gameId)) throw new Error("Worker game is missing from confirmed state");
}

if (import.meta.main) {
  main().catch(() => {
    console.error("Launcher check failed; directory remains pending");
    process.exitCode = 1;
  });
}
