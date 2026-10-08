import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { RpcProvider, hash } from "starknet";
import { createHarnessAccounts, mapWithConcurrency } from "../../harness/account-factory";
import { createOperatorAccount } from "../../../../config/deployer/clean/shared/madara-account";
import { readClassArtifact, declareClass, waitForSuccess } from "../../../../config/deployer/clean/shared/declare";
import { args, load, save, loopback, required, trialDirectory, normalize, type Fixture } from "./common";

async function main() {
  const a = args(["dir", "manifest", "private-rpc", "public-rpc", "count"]);
  const dir = trialDirectory(required(a.dir, "dir"));
  const manifest = load<{ shard: { chainId: string; accountClassHash: string; guardianPublicKey: string } }>(
    required(a.manifest, "manifest"),
  );
  const provider = new RpcProvider({ nodeUrl: loopback(required(a["public-rpc"], "public-rpc")) });
  const privateProvider = new RpcProvider({ nodeUrl: required(a["private-rpc"], "private-rpc") });
  if (
    BigInt(await provider.getChainId()) !== BigInt(manifest.shard.chainId) ||
    BigInt(await privateProvider.getChainId()) !== BigInt(manifest.shard.chainId)
  )
    throw new Error("Trial chain mismatch");
  const count = Number(a.count ?? 2000);
  if (!Number.isInteger(count) || count < 1 || count > 2000) throw new Error("Invalid account count");
  const output = resolve(dir, "node-first-private.json");
  let fixture: Fixture;
  if (existsSync(output)) {
    fixture = load<Fixture>(output);
    if (BigInt(fixture.chainId) !== BigInt(manifest.shard.chainId)) throw new Error("Saved chain mismatch");
  } else {
    const artifact = readClassArtifact(
      resolve(import.meta.dir, "artifacts/node_first_NodeFirstProbe.contract_class.json"),
      resolve(import.meta.dir, "artifacts/node_first_NodeFirstProbe.compiled_contract_class.json"),
    );
    const operator = createOperatorAccount(
      privateProvider,
      required(process.env.DEPLOYER_ACCOUNT_ADDRESS, "DEPLOYER_ACCOUNT_ADDRESS"),
      required(process.env.DEPLOYER_PRIVATE_KEY, "DEPLOYER_PRIVATE_KEY"),
    );
    await declareClass(operator, artifact, () => {});
    const salt = hash.starknetKeccak(`node-first:${manifest.shard.chainId}`).toString();
    const contract = hash.calculateContractAddressFromHash(salt, artifact.classHash, [], 0);
    try {
      await privateProvider.getClassHashAt(contract);
    } catch {
      const deployed = await operator.deployContract({
        classHash: artifact.classHash,
        salt,
        constructorCalldata: [],
        unique: false,
      });
      await waitForSuccess(privateProvider, deployed.transaction_hash);
    }
    fixture = { ...manifest.shard, contract, classHash: artifact.classHash, players: [] };
    save(output, fixture, true);
  }
  while (fixture.players.length < count) {
    const start = fixture.players.length;
    // Account deployment is outside the timed burst; use the existing harness path through the same shard guardian.
    const deployed = await createHarnessAccounts({
      count: Math.min(12, count - start),
      gameId: 1,
      concurrency: 12,
      provider: privateProvider,
      shard: manifest.shard,
      identity: {
        url: required(process.env.IDENTITY_URL, "IDENTITY_URL"),
        operatorToken: required(process.env.OPERATOR_TOKEN, "OPERATOR_TOKEN"),
      },
    });
    fixture.players.push(
      ...deployed.map((p, i) => ({
        address: p.address,
        privateKey: p.privateKey,
        publicKey: p.publicKey,
        botId: start + i,
      })),
    );
    save(output, fixture, true);
    console.log(JSON.stringify({ accounts: fixture.players.length, total: count }));
  }
  await mapWithConcurrency(fixture.players, 16, async (player) => {
    if (normalize(await privateProvider.getClassHashAt(player.address)) !== normalize(fixture.accountClassHash))
      throw new Error("Player class mismatch");
  });
  console.log(JSON.stringify({ prepared: count, contract: fixture.contract, fixture: output }));
}
main().catch(() => {
  console.error("node-first setup failed; no credentials are emitted");
  process.exitCode = 1;
});
