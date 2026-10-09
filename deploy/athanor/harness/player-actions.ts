import { setTimeout as sleep } from "node:timers/promises";
import { byteArray, hash, type Account } from "starknet";
import type { NativeSubmission } from "@bibliothecadao/provider";
import type { GameClient, CreateGameClientInput } from "@bibliothecadao/eternum";
import { buildPlayCall, signPlayerInvoke, type PlayBounds } from "./player-invoke";
import type { HarnessProvider } from "./provider";
import type { NativeWorldBindings } from "@bibliothecadao/types";

export type ActionReceipt =
  | { state: "pending" }
  | { state: "applied"; block: number; batchRemaining?: string }
  | { state: "rejected"; block: number; reason: string; statusClass?: string };
interface ReceiptEvent {
  from_address: string;
  keys: string[];
  data: string[];
}
export interface PlayReceipt {
  execution_status: string;
  block_number?: number;
  revert_reason?: string;
  events?: ReceiptEvent[];
}
export interface ReceiptScope {
  gameId: number;
  actor: string;
  games: string;
  hash: string;
}
const same = (a: string | number, b: string | number) => BigInt(a) === BigInt(b);

/** Decode the published Games events, including a library rejection inside a successful invoke. */
export function classifyPlayReceipt(receipt: PlayReceipt, scope: ReceiptScope): ActionReceipt {
  if (receipt.block_number === undefined) return { state: "pending" };
  if (receipt.execution_status === "REVERTED")
    return { state: "rejected", block: receipt.block_number, reason: receipt.revert_reason ?? "Transaction reverted" };
  if (receipt.execution_status !== "SUCCEEDED") return { state: "pending" };
  let batchRemaining: string | undefined;
  for (const event of receipt.events ?? []) {
    if (!same(event.from_address, scope.games)) continue;
    if (same(event.keys[0] ?? 0, hash.getSelectorFromName("GameplayRejected"))) {
      if (
        event.keys.length !== 5 ||
        !same(event.keys[1]!, 1) ||
        !same(event.keys[2]!, scope.gameId) ||
        !same(event.keys[3]!, scope.actor) ||
        !same(event.keys[4]!, scope.hash)
      )
        throw new Error("Malformed GameplayRejected identity");
      const words = Number(BigInt(event.data[1]!));
      if (!Number.isSafeInteger(words) || words < 0 || event.data.length !== words + 4)
        throw new Error("Malformed GameplayRejected reason");
      const reason = byteArray.stringFromByteArray({
        data: event.data.slice(2, 2 + words),
        pending_word: event.data[2 + words]!,
        pending_word_len: Number(BigInt(event.data[3 + words]!)),
      });
      return { state: "rejected", block: receipt.block_number, reason, statusClass: event.data[0]! };
    }
    if (same(event.keys[0] ?? 0, hash.getSelectorFromName("BatchProgress")) && same(event.keys[1]!, scope.gameId)) {
      if (event.data.length !== 3 || !same(event.data[0]!, scope.actor) || !same(event.data[1]!, scope.hash))
        throw new Error("Malformed BatchProgress identity");
      batchRemaining = BigInt(event.data[2]!).toString();
    }
  }
  return { state: "applied", block: receipt.block_number, batchRemaining };
}

const PLAYER_REJECTION = "Player action rejected: ";
/** Persisted driver errors retain this one marker for a successful invoke whose gameplay was refused. */
export function playerRejectionReason(message: string): string | undefined {
  const index = message.indexOf(PLAYER_REJECTION);
  return index < 0 ? undefined : message.slice(index + PLAYER_REJECTION.length);
}

const outcomes = new WeakMap<GameClient["setup"]["network"]["provider"], (hash: string) => Promise<ActionReceipt>>();
export async function waitForPlayerAction(client: GameClient, transactionHash: string): Promise<void> {
  const wait = outcomes.get(client.setup.network.provider);
  if (!wait) throw new Error("Player action receipt port is not installed");
  const receipt = await wait(transactionHash);
  if (receipt.state === "rejected")
    throw new Error(receipt.statusClass === undefined ? receipt.reason : `${PLAYER_REJECTION}${receipt.reason}`);
  if (receipt.state !== "applied") throw new Error("Player action is still pending");
}

/** Installs one signed invoke per account, with the next nonce blocked until its own facts have arrived. */
export function playerActions(options: {
  gameId: number;
  actor: string;
  games: string;
  rpcUrl: string;
  provider: HarnessProvider;
  bounds: PlayBounds;
  commandAbi: NativeWorldBindings["commandAbi"];
}): Extract<CreateGameClientInput["native"], { configure: unknown }>["configure"] {
  return (setup, runtime, release) => {
    const controller = new AbortController();
    const pending = new Map<string, Promise<ActionReceipt>>();
    let inFlight: string | undefined;
    const wait = (transactionHash: string) => {
      const receipt = pending.get(transactionHash);
      if (!receipt) throw new Error("Unknown player action hash");
      return receipt;
    };
    const observe = async (transactionHash: string): Promise<ActionReceipt> => {
      const herald = runtime.waitForTransaction(transactionHash);
      void herald.catch(() => {});
      while (!controller.signal.aborted) {
        let receipt: PlayReceipt;
        try {
          receipt = (await options.provider.getTransactionReceipt(transactionHash)) as PlayReceipt;
        } catch {
          await sleep(250, undefined, { signal: controller.signal });
          continue;
        }
        const outcome = classifyPlayReceipt(receipt, {
          gameId: options.gameId,
          actor: options.actor,
          games: options.games,
          hash: transactionHash,
        });
        if (outcome.state !== "pending") {
          if (outcome.state === "applied") await herald;
          inFlight = undefined;
          return outcome;
        }
        await sleep(250, undefined, { signal: controller.signal });
      }
      throw new Error("Player action observation disposed");
    };
    const submit: NativeSubmission = async (signer, calls) => {
      if (inFlight) throw new Error("Account already has a pending player action");
      if (!same(signer.address, options.actor)) throw new Error("Player account differs from its Herald subscription");
      const batch = Array.isArray(calls) ? calls : [calls];
      if (batch.length !== 1) throw new Error("Player invoke accepts exactly one command");
      const call = batch[0]!;
      if (!same(call.contractAddress, options.games) || !Array.isArray(call.calldata))
        throw new Error("Invalid play target");
      const [gameId, ...command] = call.calldata as string[];
      const commands = options.commandAbi.find(
        (entry) => entry.type === "enum" && entry.name === "world_native::commands::Command",
      );
      if (!commands || commands.variants[Number(command[0])]?.name !== call.entrypoint)
        throw new Error("Invalid play command discriminant");
      if (!same(gameId!, options.gameId) || command.length === 0) throw new Error("Invalid play scope");
      inFlight = "signing";
      let signed: Awaited<ReturnType<typeof signPlayerInvoke>>;
      try {
        await release.ready();
        const pin = setup.store.require("GameRelease", { game_id: options.gameId });
        signed = await signPlayerInvoke(
          signer as Account,
          buildPlayCall(options.games, options.gameId, pin.release_id, pin.preset_commitment, command),
          options.bounds,
        );
      } catch (error) {
        inFlight = undefined;
        throw error;
      }
      inFlight = signed.hash;
      try {
        await sendSignedInvoke(options.rpcUrl, signed);
      } catch (error) {
        inFlight = undefined;
        throw error;
      }
      runtime.recordSubmittedTransaction(signed.hash);
      const observed = observe(signed.hash);
      void observed.catch(() => {});
      pending.set(signed.hash, observed);
      return { transaction_hash: signed.hash };
    };
    outcomes.set(setup.network.provider, wait);
    setup.network.provider.setNativeSubmission(submit, options.commandAbi, (actor) => {
      const ids = [...setup.store.structuresOwnedBy(options.gameId, BigInt(actor))].map((row) => row.entity_id);
      if (!ids.length) throw new Error("Action requires an owned structure in the current game");
      return Math.min(...ids);
    });
    setup.network.provider.setTransactionStreamWaiter(async (transactionHash) => {
      const receipt = await wait(transactionHash);
      if (receipt.state === "pending") throw new Error("Player action is pending");
      return {
        hash: transactionHash,
        block: receipt.block,
        status: receipt.state === "applied" ? "ACCEPTED_ON_L2" : "REVERTED",
        revertReason: receipt.state === "rejected" ? receipt.reason : undefined,
        batchRemaining: receipt.state === "applied" ? receipt.batchRemaining : undefined,
      };
    });
    return () => {
      controller.abort();
      outcomes.delete(setup.network.provider);
    };
  };
}

async function sendSignedInvoke(url: string, signed: Awaited<ReturnType<typeof signPlayerInvoke>>): Promise<void> {
  let response: Response;
  let result: { error?: { code: number } };
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: signed.body,
      signal: AbortSignal.timeout(10_000),
    });
    result = await response.json();
  } catch {
    return;
  }
  if (result.error && [-32700, -32600, -32601, -32005].includes(result.error.code))
    throw new Error(`Player invoke refused by proxy (${result.error.code}, HTTP ${response.status})`);
  // An ambiguous response may have been accepted. Observe the precomputed hash; never send a new nonce.
}
