import { RpcProvider } from "starknet";
import { mapWithConcurrency } from "../harness/account-factory";
import { load, save, loopback, presign, type Fixture } from "../spikes/node-first/common";

const [fixtureFile, rpc, output, work = "32:256"] = process.argv.slice(2);
if (!fixtureFile || !rpc || !output)
  throw new Error("Usage: bun part2-presign.ts PRIVATE_FIXTURE PRIVATE_RPC PRIVATE_TXS_JSON [writes:hashes]");
const fixture = load<Fixture>(fixtureFile);
const provider = new RpcProvider({ nodeUrl: loopback(rpc) });
if (BigInt(await provider.getChainId()) !== BigInt(fixture.chainId)) throw new Error("Part2 presign chain mismatch");
const [writes, hashes] = work.split(":").map(Number);
const signed = await mapWithConcurrency(fixture.players, 16, (player) =>
  presign(fixture, player, provider, Date.now(), 1, writes, hashes),
);
save(
  output,
  signed.map((entry) => JSON.parse(entry.body).params[0]),
  true,
);
console.log(JSON.stringify({ transactions: signed.length, output }));
