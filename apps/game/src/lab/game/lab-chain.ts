import { useAccountStore } from "@/hooks/store/use-account-store";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import type { AccountInterface } from "starknet";

import { FRONTIER_PRESET_ID } from "../../../../../config/source/common/native-preset-modes";
import {
  nativeFactModels,
  nativeFactSchemaIdentity,
  type NativeModelName,
} from "../../../../../contracts/l3/world-native/schema/client.gen";

/** The lab game's shard: listed in the tab's directory, served by the tab's Herald, never reached on the network. */
export const LAB_GAME = {
  chainId: "0x1ab9",
  gameId: 1,
  presetId: FRONTIER_PRESET_ID,
  url: "https://herald.lab.invalid",
} as const;
/** The lab game's end: a month of chain seconds, so a session never sees it close. */
export const LAB_GAME_ENDS_AT = 30 * 86_400;

/** A fact as Herald carries it: its model, its key, its wire value (null deletes the row). */
export type LabFact = { model: string; key: string; value: unknown };

/** A command the game signed, as the lab read it off the play call: its variant and its fields, in ABI order. */
export type LabCommand = { kind: string; fields: Record<string, string>; calldata: string[] };

export interface LabScenario {
  /** The game the route opens on: every fact Herald's snapshot carries. */
  store: NativeFactStore;
  /** The chain clock's first second; it runs on with the wall clock from there. */
  startsAt: number;
  /** The player the lab's account signs as. */
  player: string;
  /** The tile the map opens on, as the doorway opens it on the player's site (contract coordinates). */
  opensOn: { col: number; row: number };
  /** The facts the chain writes for a command, as the game's contract would apply it; none for one it ignores. */
  answer: (command: LabCommand, chain: NativeFactStore, now: number) => LabFact[];
}

interface LabChainRecord {
  /** Every command the game signed, in order, with the facts the lab answered it with. */
  sent: { hash: string; command: LabCommand; answered: LabFact[] }[];
}

declare global {
  interface Window {
    __labChain?: LabChainRecord;
  }
}

const wire = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));

const rowsOf = (store: NativeFactStore): LabFact[] =>
  (Object.keys(nativeFactModels) as NativeModelName[]).flatMap((model) =>
    [...store.entries(model)].map(([key, value]) => ({ model, key, value: wire(value) })),
  );

/**
 * Plays the game route on a fixture, in this tab only: the directory lists the lab shard, its Herald's socket is
 * answered here (the snapshot, the player's scope, a head each second), and the player's account is one whose signed
 * commands are recorded and answered by the scenario as the chain would apply them. Everything past the network is the
 * game's own: its client, scenes, input and HUD. Installed once for the tab's life; a reload starts from the lab again.
 */
export const installLabChain = async (scenario: LabScenario): Promise<LabChainRecord> => {
  if (window.__labChain) return window.__labChain;
  const record: LabChainRecord = { sent: [] };
  window.__labChain = record;
  const { nativeBindings } = await import("@/runtime/world/native-bindings");
  // The chain's own state, keyed as its Herald serves each row: the snapshot, the scope and every answer agree.
  const chain = new NativeFactStore();
  chain.applyFacts(rowsOf(scenario.store) as never);
  const startedAt = Date.now();
  const now = () => scenario.startsAt + Math.floor((Date.now() - startedAt) / 1000);
  const herald = new LabHerald(chain, now);
  answerDirectory(now);
  answerHeraldSocket(herald);
  seatPlayer(labAccount(scenario, chain, nativeBindings, record, herald, now));
  return record;
};

/**
 * The tab's directory and the lab shard's own reads (its manifest, its games): the lab shard alone, with the one
 * Frontier game on it, ending a month into the season. Any other read the shard is asked fails as an offline shard's.
 */
const answerDirectory = (now: () => number) => {
  const network = window.fetch.bind(window);
  const manifest = {
    version: 1,
    chainId: LAB_GAME.chainId,
    releaseSchemas: { "1": nativeFactSchemaIdentity },
    rpcUrl: "https://rpc.lab.invalid",
    accountClassHash: "0x2",
    contracts: { games: "0x1ab" },
    guardianPublicKey: "0x3",
    l2GasBound: "0x47868c00",
  };
  const game = {
    game_id: LAB_GAME.gameId,
    name: "lab",
    mode: "frontier",
    status: "Live",
    ready: true,
    dev_mode_on: false,
    expedition: { day_unit_seconds: 3600, seed: "1" },
    clock: { start_settling_at: 1, start_main_at: 100, end_at: LAB_GAME_ENDS_AT, end_grace_seconds: 0 },
    player_count: 1,
    player_state: { registered: true, settled: true, roster_wallet: null, structures: [] },
    roster_count: 0,
    preset_id: LAB_GAME.presetId,
    registration: null,
    settled_realms_count: 1,
    settled_villages_count: 0,
    settlement: null,
  };
  const json = (body: unknown) =>
    Promise.resolve(
      new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }),
    );
  const shard = new URL(LAB_GAME.url);
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (url.pathname === "/api/directory")
      return json({
        shards: [{ url: LAB_GAME.url, chainId: LAB_GAME.chainId, status: "active", games: [game], manifest }],
      });
    if (url.host !== shard.host) return network(input, init);
    if (url.pathname === "/manifest") return json(manifest);
    if (url.pathname === "/games")
      return json({ chain: LAB_GAME.chainId, world_address: "0x1ab", confirmed_block: now(), games: [game] });
    return Promise.reject(new TypeError(`The lab shard does not serve ${url.pathname}`));
  };
};

/** The lab shard's Herald socket is the tab's own; every other socket opens as before. */
const answerHeraldSocket = (herald: LabHerald) => {
  const Network = window.WebSocket;
  const host = new URL(LAB_GAME.url).host;
  window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
    return new URL(String(url)).host === host ? herald.open() : new Network(url, protocols);
  } as unknown as typeof WebSocket;
};

/**
 * The lab's account is the player for the tab's life: the game route would let go of an account it did not join itself
 * (it joins one through a sign-in and the shard's node, neither of which the lab has), so the lab takes that setter.
 */
const seatPlayer = (account: AccountInterface) =>
  useAccountStore.setState({ account, owner: "lab", provisioningError: null, setGameplayAccount: () => undefined });

/**
 * The player's account: it signs nothing, it reads each play call's command, records it, and has the lab's Herald
 * report it pre-confirmed with the facts the scenario answers it with, as the chain would.
 */
const labAccount = (
  scenario: LabScenario,
  chain: NativeFactStore,
  bindings: NativeWorldBindings,
  record: LabChainRecord,
  herald: LabHerald,
  now: () => number,
): AccountInterface => {
  let nonce = 0n;
  const account = {
    address: scenario.player,
    getNonce: async () => `0x${nonce.toString(16)}`,
    getChainId: async () => LAB_GAME.chainId,
    getTransactionStatus: async () => ({ finality_status: "PRE_CONFIRMED" }),
    execute: async (calls: { calldata: string[] } | { calldata: string[] }[]) => {
      const call = Array.isArray(calls) ? calls[0] : calls;
      const command = readCommand(bindings, call.calldata.map(String));
      nonce += 1n;
      const hash = `0x1ab${record.sent.length.toString(16).padStart(4, "0")}`;
      const answered = scenario.answer(command, chain, now());
      record.sent.push({ hash, command, answered });
      // The answer lands a moment later, as a block would; a lab answer that fails says so in the console.
      setTimeout(() => {
        try {
          herald.apply(hash, answered);
        } catch (error) {
          console.error("[lab chain] the answer to", command.kind, "could not apply", error);
        }
      }, 300);
      return { transaction_hash: hash };
    },
  };
  return account as unknown as AccountInterface;
};

type AbiItem = {
  type: string;
  name: string;
  members?: { name: string; type: string }[];
  variants?: { name: string; type: string }[];
};

/** A play call's command, as native-submission builds it: game, release, commitment, the span's length, the span. */
const readCommand = (bindings: NativeWorldBindings, calldata: string[]): LabCommand => {
  const span = calldata.slice(4);
  const abi = bindings.commandAbi as unknown as AbiItem[];
  const commands = abi.find((item) => item.type === "enum" && item.name === "world_native::commands::Command");
  const variant = commands?.variants?.[Number(span[0])];
  if (!variant) throw new Error(`The lab cannot read command ${span[0]}`);
  // Flat commands (each field one felt) read field by field; anything else keeps its raw span.
  const members = abi.find((item) => item.name === variant.type)?.members ?? [];
  const fields =
    members.length === span.length - 1
      ? Object.fromEntries(members.map((member, index) => [member.name, BigInt(span[index + 1]).toString()]))
      : {};
  return { kind: variant.name, fields, calldata };
};

/** The lab shard's Herald, answering the game's one stream socket with Herald's own messages. */
class LabHerald {
  private socket: LabSocket | null = null;
  private seq = 0;
  private block = 1;
  private heads: number | undefined;
  private readonly epoch = "lab";

  constructor(
    private readonly chain: NativeFactStore,
    private readonly now: () => number,
  ) {}

  open(): LabSocket {
    this.socket?.close();
    const socket = new LabSocket(this);
    this.socket = socket;
    setTimeout(() => {
      socket.onopen?.();
      this.send({
        type: "hello",
        epoch: this.epoch,
        seq: 0,
        confirmed_block: this.block,
        confirmed_timestamp: this.now(),
        preconfirmed_block: null,
      });
    }, 0);
    return socket;
  }

  closed(socket: LabSocket) {
    if (this.socket !== socket) return;
    this.socket = null;
    window.clearInterval(this.heads);
  }

  receive(message: { type: string; actor?: string | null; visit?: string | null }) {
    if (message.type === "resume") {
      this.seq = 0;
      const byModel = new Map<string, LabFact[]>();
      for (const row of rowsOf(this.chain)) byModel.set(row.model, [...(byModel.get(row.model) ?? []), row]);
      for (const [model, rows] of byModel)
        this.send({
          type: "snapshot",
          epoch: this.epoch,
          seq: 0,
          model,
          rows: rows.map(({ key, value }) => ({ key, value })),
        });
      this.send({ type: "snapshot_end", epoch: this.epoch, seq: 0 });
      window.clearInterval(this.heads);
      this.heads = window.setInterval(
        () => this.sequenced({ type: "head", block: ++this.block, timestamp: this.now() }),
        1000,
      );
    } else if (message.type === "select_actor") {
      // The actor's scope: the lab's game is all the player's to see, so it carries every row.
      this.send({
        type: "scope",
        epoch: this.epoch,
        seq: this.seq,
        // Herald names only the selection it serves: no actor for a spectator, no visit when none.
        ...(message.actor ? { actor: message.actor } : {}),
        ...(message.visit ? { visit: message.visit } : {}),
        expedition: true,
        set: rowsOf(this.chain),
      });
    }
  }

  /** A command's facts land pre-confirmed in the next block, then its status. */
  apply(hash: string, facts: LabFact[]) {
    this.chain.applyFacts(facts as never);
    const block = ++this.block;
    this.sequenced({
      type: "diff",
      block,
      preconfirmed: true,
      transaction_hash: hash,
      set: facts.filter((fact) => fact.value !== null),
      del: facts.filter((fact) => fact.value === null).map(({ model, key }) => ({ model, key })),
    });
    this.sequenced({ type: "tx", hash, status: "PRE_CONFIRMED", block });
  }

  private sequenced(message: Record<string, unknown>) {
    this.send({ ...message, epoch: this.epoch, seq: ++this.seq });
  }

  private send(message: Record<string, unknown>) {
    this.socket?.onmessage?.({ data: JSON.stringify(message) });
  }
}

/** The stream socket as the game's transport uses it: open, messages, close. */
class LabSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;

  constructor(private readonly herald: LabHerald) {}

  send(data: string) {
    this.herald.receive(JSON.parse(data));
  }

  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.herald.closed(this);
    this.onclose?.();
  }
}
