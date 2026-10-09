import { ensureShardVrfKey } from "../scripts/host-accounts";
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { ec, hash, RpcProvider } from "starknet";
import { joinRealmsAccount, deviceKeyOf } from "../../../packages/core/src/account/realms-account";
import { deviceChangeHash } from "../../../packages/identity/src/account";
import { createMadaraAccount } from "../../../config/deployer/clean/shared/madara-account";
import { declareClass, readClassArtifact, waitForSuccess } from "../../../config/deployer/clean/shared/declare";
import { mapWithConcurrency } from "../harness/account-factory";
import { load, save, loopback, trialDirectory, normalize, type Fixture } from "../spikes/node-first/common";
import { NativeProver, feltBytes } from "./native";

const [rpc, originalFixture, hostDirectory, outputDirectory] = process.argv.slice(2);
if (!rpc || !originalFixture || !hostDirectory || !outputDirectory)
  throw new Error("Usage: bun part2-setup.ts PRIVATE_RPC ORIGINAL_FIXTURE HOST_DATA_DIR OUT_DIR");
loopback(rpc);
const directory = trialDirectory(outputDirectory);
mkdirSync(directory, { recursive: true, mode: 0o700 });
const original = load<Fixture>(originalFixture);
const provider = new RpcProvider({ nodeUrl: rpc });
if (BigInt(await provider.getChainId()) !== BigInt(original.chainId)) throw new Error("Part2 fixture chain mismatch");
const root = trialDirectory(hostDirectory);
const generatedKey = ensureShardVrfKey(root);
const keyFile = join(root, "vrf-private.key");
const host = load<{ deployerAddress: string; deployerPrivateKey: string }>(join(root, "host-keys.json"));
const admin = createMadaraAccount(provider, host.deployerAddress, host.deployerPrivateKey);
const artifactRoot = resolve(import.meta.dir, "artifacts");
const artifact = (name: string) =>
  readClassArtifact(
    join(artifactRoot, `node_first_vrf_${name}.contract_class.json`),
    join(artifactRoot, `node_first_vrf_${name}.compiled_contract_class.json`),
  );
const accountClass = artifact("VrfSpikeAccount");
const probeClass = artifact("VrfYProbe");
await declareClass(admin, accountClass, () => {});
await declareClass(admin, probeClass, () => {});

const guardianFile = join(directory, "part2-guardian.key");
if (!existsSync(guardianFile)) {
  const key = `0x${Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex")}`;
  writeFileSync(guardianFile, key + "\n", { mode: 0o600, flag: "wx" });
}
if ((statSync(guardianFile).mode & 0o077) !== 0) throw new Error("Fixture guardian file must be private");
const guardian = readFileSync(guardianFile, "utf8").trim();
const guardianPublicKey = ec.starkCurve.getStarkKey(guardian);
const prover = new NativeProver(feltBytes(readFileSync(keyFile, "utf8").trim()));
try {
  const key = prover.publicKey();
  if (key.some((value, index) => BigInt(value) !== BigInt(generatedKey[index]!)))
    throw new Error("Shard key implementations disagree");
  const addresses: string[] = [];
  for (const verify of [false, true]) {
    const salt = `0x${hash.starknetKeccak(`part2:${original.chainId}:${key.join(":")}:${verify}`).toString(16)}`;
    const calldata = [...key, verify ? "0x1" : "0x0"];
    const address = hash.calculateContractAddressFromHash(salt, probeClass.classHash, calldata, 0);
    try {
      await provider.getClassHashAt(address);
    } catch {
      const tx = await admin.deployContract(
        { classHash: probeClass.classHash, salt, constructorCalldata: calldata, unique: false },
        { tip: 0 },
      );
      await waitForSuccess(provider, tx.transaction_hash);
    }
    addresses.push(address);
  }
  const privateFixture = join(directory, "part2-private.json");
  const fixture: Fixture = existsSync(privateFixture)
    ? load<Fixture>(privateFixture)
    : {
        chainId: original.chainId,
        accountClassHash: accountClass.classHash,
        guardianPublicKey,
        contract: addresses[0],
        classHash: probeClass.classHash,
        players: [],
      };
  if (
    normalize(fixture.accountClassHash) !== normalize(accountClass.classHash) ||
    normalize(fixture.guardianPublicKey) !== normalize(guardianPublicKey) ||
    BigInt(fixture.chainId) !== BigInt(original.chainId)
  )
    throw new Error("Part2 saved fixture identity changed");
  const byId = new Map(fixture.players.map((player) => [player.botId, player]));
  for (let start = 0; start < original.players.length; start += 12) {
    const missing = original.players.slice(start, start + 12).filter((player) => !byId.has(player.botId));
    const deployed = await mapWithConcurrency(missing, 12, async (player) => {
      const account = await joinRealmsAccount({
        provider,
        shard: { chainId: original.chainId, accountClassHash: accountClass.classHash, guardianPublicKey },
        realmsId: `0x${hash.starknetKeccak(`part2:${player.address}`).toString(16)}`,
        device: deviceKeyOf(player.privateKey),
        approve: async (change) => {
          const signature = ec.starkCurve.sign(deviceChangeHash(change), guardian);
          return [`0x${signature.r.toString(16)}`, `0x${signature.s.toString(16)}`];
        },
      });
      return { ...player, address: account.address };
    });
    for (const player of deployed) byId.set(player.botId, player);
    fixture.players = [...byId.values()].sort((a, b) => a.botId - b.botId);
    save(privateFixture, fixture, true);
    console.log(JSON.stringify({ prepared: fixture.players.length, total: original.players.length }));
  }
  await mapWithConcurrency(fixture.players, 16, async (player) => {
    if (normalize(await provider.getClassHashAt(player.address)) !== normalize(accountClass.classHash))
      throw new Error("Part2 player class mismatch");
  });
  save(
    join(directory, "part2-baseline-private.json"),
    { ...fixture, contract: addresses[0], verifyProofs: false, vrfPublicKey: key },
    true,
  );
  save(
    join(directory, "part2-verified-private.json"),
    { ...fixture, contract: addresses[1], verifyProofs: true, vrfPublicKey: key },
    true,
  );
  save(join(directory, "part2-public.json"), {
    chainId: original.chainId,
    accountClassHash: accountClass.classHash,
    probeClassHash: probeClass.classHash,
    baseline: addresses[0],
    verified: addresses[1],
    publicKey: key,
    accounts: fixture.players.length,
  });
  console.log(
    JSON.stringify({ publicFixture: join(directory, "part2-public.json"), accounts: fixture.players.length }),
  );
} finally {
  prover.close();
}
