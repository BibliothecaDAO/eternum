import { frameNativeIntent } from "../../packages/provider/src/native-command";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CallData, CairoCustomEnum, ec, hash, RpcProvider } from "starknet";

export interface NativeFixture {
  scope: string;
  rpc: string;
  chain: string;
  authority: { address: string };
  execution: { address: string };
  actor: string;
  playerPublicKey: string;
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
  assert.equal(admission.length, 7);
  return admission;
}

export function signedRequest(fixture: NativeFixture, admission: string[], arguments_: string[]) {
  const [, rules, , nonce, order, , timestamp] = admission;
  const intent = frameNativeIntent({
    chain: fixture.chain, deployment: fixture.execution.address, gameId: fixture.game, actor: fixture.actor,
    nonce, rules, validFrom: BigInt(timestamp) - 300n, validUntil: BigInt(timestamp) + 60n,
    lastOrder: BigInt(order) + 100n, arguments: arguments_,
  });
  const action = hash.computePoseidonHashOnElements(intent);
  const signature = ec.starkCurve.sign(action, "0x3039");
  return { action, intent, r: hex(signature.r), s: hex(signature.s), public_key: fixture.playerPublicKey };
}

export function exploreArguments(fixture: NativeFixture, nonce: string) {
  assert(fixture.explorers && fixture.firstExploreNonce !== undefined, "Prepare explorers before running the fixture");
  const index = Number(BigInt(nonce) - BigInt(fixture.firstExploreNonce));
  const explorer = fixture.explorers[index];
  assert(explorer !== undefined, "Fresh explorer pool exhausted; preserve this deployment and prepare a new fixture");
  return commandArguments(fixture, "Explore", { explorer_id: explorer, direction: 0 });
}

export async function waitForOutcome(provider: RpcProvider, fixture: NativeFixture, endpoint: string, action: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const response = await fetch(`${endpoint}/${action}`, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Action status failed: ${response.status}`);
    const status = await response.json();
    if (status.transaction_hash) {
      const receipt = await provider.getTransactionReceipt(status.transaction_hash);
      const events = "events" in receipt ? receipt.events : [];
      const event = events.find((event) => BigInt(event.from_address) === BigInt(fixture.execution.address)
        && event.keys.at(-1) === hash.getSelectorFromName("ExecutionRecorded"));
      if (!event) throw new Error("Accepted transaction has no execution event");
      const [game, actor, nonce, consumed, order, outcome, reason] = event.data;
      assert.equal(event.data.length, 7);
      assert.equal(BigInt(game), BigInt(fixture.game));
      assert.equal(BigInt(actor), BigInt(fixture.actor));
      return { nonce, nonceConsumed: BigInt(consumed) === 1n, order, status: outcome, reason,
        transactionHash: status.transaction_hash as string };
    }
  }
  throw new Error("Accepted ticket remains pending; preserve its journal");
}
