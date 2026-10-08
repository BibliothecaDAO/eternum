// Throwaway fresh-game day reset, outside every measured wave.
import { resolve } from "node:path";
import { RpcProvider } from "starknet";
import { args, load, required, trialDirectory, type Fixture } from "./common";
import { createMadaraAccount } from "../../../../config/deployer/clean/shared/madara-account";
import { waitForSuccess } from "../../../../config/deployer/clean/shared/declare";

async function main() {
  const a = args(["dir", "fixture", "private-rpc"]);
  const dir = trialDirectory(required(a.dir, "dir"));
  const fixture = load<Fixture>(required(a.fixture, "fixture"));
  if (!fixture.game) throw new Error("Real game fixture required");
  const provider = new RpcProvider({ nodeUrl: required(a["private-rpc"], "private-rpc") });
  if (BigInt(await provider.getChainId()) !== BigInt(fixture.chainId)) throw new Error("Trial chain mismatch");
  const keys = load<{ deployerAddress: string; deployerPrivateKey: string }>(resolve(dir, "host-keys.json"));
  const owner = createMadaraAccount(provider, keys.deployerAddress, keys.deployerPrivateKey);
  const tx = await owner.execute(
    { contractAddress: fixture.contract, entrypoint: "start_now", calldata: [fixture.game.id] },
    { tip: 0 },
  );
  await waitForSuccess(provider, tx.transaction_hash);
  const day = await provider.callContract(
    { contractAddress: fixture.contract, entrypoint: "day", calldata: [fixture.game.id] },
    "pre_confirmed",
  );
  console.log(JSON.stringify({ arm: fixture.game.arm, day: day.map((v) => BigInt(v).toString()) }));
}
main().catch(() => {
  console.error("spike day reset failed; no credentials emitted");
  process.exitCode = 1;
});
