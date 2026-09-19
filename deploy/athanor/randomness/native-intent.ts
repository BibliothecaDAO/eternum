import { encodeNativeCommand, frameNativeIntent, type NativeCommand } from "../../../packages/provider/src/native-command";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ec, hash, RpcProvider } from "starknet";

export interface NativeFixture {
  rpc: string;
  chain: string;
  execution: { address: string };
  actor: string;
  game: string;
  nativeSource: string;
}

const hex = (value: string | number | bigint) => `0x${BigInt(value).toString(16)}`;

export function readFixture(path: string): NativeFixture {
  const fixture = JSON.parse(readFileSync(path, "utf8")) as NativeFixture;
  assert(["127.0.0.1", "localhost"].includes(new URL(fixture.rpc).hostname), "Fixture RPC must be isolated loopback");
  assert(fixture.nativeSource, "Expected a native gameplay fixture");
  return fixture;
}

export function commandArguments(fixture: NativeFixture, command: NativeCommand): string[] {
  const bindings = JSON.parse(
    readFileSync(resolve(fixture.nativeSource, "contracts/l3/world-native/schema/bindings.json"), "utf8"),
  );
  return encodeNativeCommand(bindings.commandAbi, command);
}

export async function admissionFor(provider: RpcProvider, fixture: NativeFixture) {
  const admission = await provider.callContract(
    {
      contractAddress: fixture.execution.address,
      entrypoint: "get_admission",
      calldata: [fixture.game, fixture.actor],
    },
    "pre_confirmed",
  );
  assert.equal(admission.length, 6);
  return admission;
}

export function signedRequest(fixture: NativeFixture, admission: string[], arguments_: string[], privateKey: string) {
  const [, rules, , nonce, order, timestamp] = admission;
  const intent = frameNativeIntent({
    chain: fixture.chain,
    deployment: fixture.execution.address,
    gameId: fixture.game,
    actor: fixture.actor,
    nonce,
    rules,
    validFrom: BigInt(timestamp) - 300n,
    validUntil: BigInt(timestamp) + 60n,
    lastOrder: BigInt(order) + 100n,
    arguments: arguments_,
  });
  const action = hash.computePoseidonHashOnElements(intent);
  const signature = ec.starkCurve.sign(action, privateKey);
  return { action, intent, r: hex(signature.r), s: hex(signature.s), public_key: ec.starkCurve.getStarkKey(privateKey) };
}
