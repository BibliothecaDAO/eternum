import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CallData, CairoCustomEnum, ec, hash, RpcProvider, shortString } from "starknet";

export interface NativeFixture {
  scope: string;
  rpc: string;
  chain: string;
  authority: { address: string };
  execution: { address: string };
  actor: string;
  owner: string;
  game: string;
  nativeSource: string;
  provision: { realmCount: number; realmIds: number[]; layers?: ("surface" | "ethereal")[] };
  geometry?: {
    realm: { alt: boolean; x: number; y: number };
    explorer: { alt: boolean; x: number; y: number };
    spire?: { alt: boolean; x: number; y: number };
  }[];
  explorers?: number[];
  firstExploreNonce?: string;
}

export const hex = (value: string | number | bigint) => `0x${BigInt(value).toString(16)}`;

export function readFixture(path: string): NativeFixture {
  const fixture = JSON.parse(readFileSync(path, "utf8")) as NativeFixture;
  assert.equal(fixture.rpc, "http://127.0.0.1:15050/rpc/v0_9_0");
  assert(fixture.nativeSource, "Expected a native gameplay fixture");
  return fixture;
}

export function commandArguments(fixture: NativeFixture, variant: string, value: object): string[] {
  const bindings = JSON.parse(
    readFileSync(resolve(fixture.nativeSource, "contracts/l3/world-native/schema/bindings.json"), "utf8"),
  );
  return new CallData(bindings.commandAbi).compile("command_commitment", {
    command: new CairoCustomEnum({ [variant]: value }),
  });
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
  assert.equal(admission.length, 8);
  return admission;
}

export function signedRequest(fixture: NativeFixture, admission: string[], arguments_: string[]) {
  const [, rules, , nonce, order, , , timestamp] = admission;
  const command = hash.computePoseidonHashOnElements([
    shortString.encodeShortString("ETERNUM_COMMAND"),
    1,
    ...arguments_,
  ]);
  const intent = [
    shortString.encodeShortString("ETERNUM_ACTION"),
    "0x1",
    fixture.chain,
    fixture.execution.address,
    fixture.game,
    fixture.actor,
    nonce,
    command,
    rules,
    hex(BigInt(timestamp) - 300n),
    hex(BigInt(timestamp) + 60n),
    hex(BigInt(order) + 100n),
    hex(arguments_.length),
    ...arguments_,
  ].map(hex);
  const action = hash.computePoseidonHashOnElements(intent);
  const signature = ec.starkCurve.sign(action, "0x3039");
  return { action, intent, r: hex(signature.r), s: hex(signature.s) };
}

export function exploreArguments(fixture: NativeFixture, nonce: string) {
  assert(fixture.explorers && fixture.firstExploreNonce !== undefined, "Prepare explorers before running the fixture");
  const index = Number(BigInt(nonce) - BigInt(fixture.firstExploreNonce));
  const explorer = fixture.explorers[index];
  assert(explorer !== undefined, "Fresh explorer pool exhausted; preserve this deployment and prepare a new fixture");
  return commandArguments(fixture, "Explore", { explorer_id: explorer, direction: 0 });
}
