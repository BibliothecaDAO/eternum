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

async function main(): Promise<void> {
  const [action, data, account, txHash, name, preset] = process.argv.slice(2);
  if (!data || !account || !["handoff", "verify"].includes(action!)) throw new Error("Invalid launcher check inputs");
  const manifest = readShardManifest<NativeWorldManifest>(resolve(data, "native-world.json"));
  const rpcUrl = process.env.HARNESS_ADMIN_RPC_URL;
  if (!rpcUrl) throw new Error("Private launcher RPC is required");
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  await assertProviderChain(provider, manifest, "launcher check RPC");
  const identity = JSON.parse(readFileSync(resolve(data, "gameplay-contracts.json"), "utf8"));
  const read = (entrypoint: string, calldata: string[] = []) =>
    provider.callContract({ contractAddress: manifest.world.address, entrypoint, calldata }, "latest");
  const classHash = await provider.getClassHashAt(account, "latest");
  const guardian = await provider.getStorageAt(account, hash.starknetKeccak("guardian_public_key"), "latest");
  if (
    BigInt(classHash) !== BigInt(manifest.shard.accountClassHash) ||
    BigInt(guardian) !== BigInt(manifest.shard.guardianPublicKey) ||
    BigInt(account) === 0n ||
    BigInt(account) === BigInt(identity.operatorAccountAddress)
  )
    throw new Error("Worker launcher identity differs");
  const [installed] = await read("launcher");
  const needsHandoff = BigInt(installed!) !== BigInt(account);
  if (needsHandoff && (action !== "handoff" || BigInt(installed!) !== BigInt(identity.operatorAccountAddress)))
    throw new Error("Unexpected installed launcher");
  if (action === "handoff") {
    writeFileSync(
      resolve(data, "launcher-enrolment.json"),
      JSON.stringify({
        chainId: manifest.shard.chainId,
        world: manifest.world.address,
        launcherAccount: account,
      }),
      { mode: 0o600 },
    );
  }
  if (needsHandoff) {
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    if (!privateKey) throw new Error("Missing protected owner credential");
    const owner = createOperatorAccount(provider, identity.operatorAccountAddress, privateKey);
    const sent = await owner.execute(
      { contractAddress: manifest.world.address, entrypoint: "set_launcher", calldata: [account] },
      resolveRegistrarExecutionDetails(),
    );
    await waitForSuccess(provider, sent.transaction_hash);
  }
  const [confirmed] = await read("launcher");
  if (BigInt(confirmed!) !== BigInt(account)) throw new Error("Launcher handoff was not confirmed");
  if (action === "verify") {
    if (!txHash || !name || !preset) throw new Error("Worker creation proof missing");
    const receipt = await confirmedTransactionReceipt(provider, txHash);
    const tx = await provider.getTransactionByHash(txHash);
    assertWorkerCreation(tx, { account, world: manifest.world.address, name, preset: Number(preset) });
    const gameId = resolveCreatedGameId(receipt, manifest);
    const [named] = await read("game_id_by_name", [name]);
    if (!gameId || BigInt(named!) !== BigInt(gameId)) throw new Error("Worker game is missing from confirmed state");
  }
  console.log(JSON.stringify({ passed: true, launcher: account }));
}

if (import.meta.main) {
  main().catch(() => {
    console.error("Launcher check failed; directory remains pending");
    process.exitCode = 1;
  });
}
