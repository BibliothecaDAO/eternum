import { encodeNativeCommand, frameNativeIntent, type NativeCommand } from "../../packages/provider/src/native-command";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ec, hash, RpcProvider, shortString } from "starknet";

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
  assert.equal(admission.length, 7);
  return admission;
}

export function signedRequest(fixture: NativeFixture, admission: string[], arguments_: string[]) {
  const [, rules, , nonce, order, , timestamp] = admission;
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
  const signature = ec.starkCurve.sign(action, "0x3039");
  return { action, intent, r: hex(signature.r), s: hex(signature.s), public_key: fixture.playerPublicKey };
}

export function exploreArguments(fixture: NativeFixture, nonce: string) {
  assert(fixture.explorers && fixture.firstExploreNonce !== undefined, "Prepare explorers before running the fixture");
  const index = Number(BigInt(nonce) - BigInt(fixture.firstExploreNonce));
  const explorer = fixture.explorers[index];
  assert(explorer !== undefined, "Fresh explorer pool exhausted; preserve this deployment and prepare a new fixture");
  return commandArguments(fixture, { kind: "Explore", value: { explorer_id: explorer, direction: 0 } });
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
      const event = events.find(
        (event) =>
          BigInt(event.from_address) === BigInt(fixture.execution.address) &&
          event.keys.at(-1) === hash.getSelectorFromName("ExecutionRecorded"),
      );
      if (!event) throw new Error("Accepted transaction has no execution event");
      const [game, actor, nonce, consumed, order, outcome, reason] = event.data;
      assert.equal(event.data.length, 7);
      assert.equal(BigInt(game), BigInt(fixture.game));
      assert.equal(BigInt(actor), BigInt(fixture.actor));
      return {
        nonce,
        nonceConsumed: BigInt(consumed) === 1n,
        order,
        status: outcome,
        reason,
        transactionHash: status.transaction_hash as string,
      };
    }
  }
  throw new Error("Accepted ticket remains pending; preserve its journal");
}

interface JournalTicket {
  ticket_order: number;
  intent: string;
  envelope: string;
  binding: string;
  transactions: string[];
}

function journalFelts(bytes: string): string[] {
  assert.match(bytes, /^(?:[0-9a-f]{64})+$/i, "Malformed journal field encoding");
  return bytes.match(/.{64}/g)!.map((value) => `0x${value}`);
}

function retainedTicket(fixture: NativeFixture, ticket: JournalTicket) {
  const intent = journalFelts(ticket.intent);
  const envelope = journalFelts(ticket.envelope);
  assert.equal(envelope.length, 10);
  assert.equal(BigInt(envelope[0]), BigInt(shortString.encodeShortString("ETERNUM_ENTROPY")));
  assert.equal(BigInt(envelope[1]), 2n);
  assert.equal(BigInt(envelope[2]), BigInt(hash.computePoseidonHashOnElements(intent)));
  assert.equal(BigInt(envelope[3]), BigInt(ticket.ticket_order));
  const binding = hash.computePoseidonHashOnElements(envelope);
  assert.equal(BigInt(binding), BigInt(`0x${ticket.binding}`));
  assert.equal(BigInt(intent[3]), BigInt(fixture.execution.address));
  return { intent, envelope, binding };
}

function receiptProgress(
  receipt: Awaited<ReturnType<RpcProvider["getTransactionReceipt"]>>,
  fixture: NativeFixture,
  retained: ReturnType<typeof retainedTicket>,
) {
  if ("execution_status" in receipt && receipt.execution_status === "REVERTED") return null;
  const events = ("events" in receipt ? receipt.events : []).filter(
    (event) =>
      BigInt(event.from_address) === BigInt(fixture.execution.address) &&
      event.keys.length === 2 &&
      BigInt(event.keys[0]) === BigInt(hash.getSelectorFromName("RecordingEvent")) &&
      BigInt(event.keys[1]) === BigInt(hash.getSelectorFromName("ExecutionRecorded")),
  );
  assert.equal(events.length, 1, "Successful submission must contain exactly one execution event");
  const fields = events[0].data.map(BigInt);
  assert.equal(fields.length, 7);
  const [game, actor, nonce, consumed, order, status, reason] = fields;
  const { intent, envelope, binding } = retained;
  assert.deepEqual(
    [game, actor, nonce, order],
    [BigInt(intent[4]), BigInt(intent[5]), BigInt(intent[6]), BigInt(envelope[3])],
  );
  assert(consumed === 0n || consumed === 1n);
  assert((status === 1n && reason === 0n) || (status === 2n && reason !== 0n));
  const state = hash.computePoseidonHashOnElements([envelope[4], binding, status, reason, consumed]);
  return [hex(status), binding, status === 2n ? hex(reason) : state, state];
}

export async function recoveryProgress(
  provider: Pick<RpcProvider, "getTransactionReceipt">,
  fixture: NativeFixture,
  ticket: JournalTicket,
) {
  const retained = retainedTicket(fixture, ticket);
  for (const transaction of ticket.transactions) {
    let receipt;
    try {
      receipt = await provider.getTransactionReceipt(`0x${transaction}`);
    } catch (error) {
      if ((error as { baseError?: { code?: number } }).baseError?.code === 29) continue;
      throw error;
    }
    const progress = receiptProgress(receipt, fixture, retained);
    if (progress) return progress;
  }
  return ["0x0", "0x0", "0x0", "0x0"];
}

if (import.meta.main) {
  const { fixture, ticket } = await Bun.stdin.json();
  assert.equal(fixture.rpc, "http://127.0.0.1:15050/rpc/v0_9_0");
  console.log(JSON.stringify(await recoveryProgress(new RpcProvider({ nodeUrl: fixture.rpc }), fixture, ticket)));
}
