import { SeatRefused, type SeatResult } from "./seat-pipeline";
import type { SlotChain, SlotGame } from "./slot-launch";

type Queued = { kind: "create"; game: SlotGame } | { kind: "seat"; gameId: number };

export interface ShardFaults {
  /** Seat nonces the RPC refuses once before forwarding. */
  refuse?: bigint[];
  /** Nonces accepted and then dropped, never executed: every later nonce waits behind them. */
  lose?: bigint[];
  /** Seat nonces that execute and revert, spending the nonce and seating nobody. */
  revert?: bigint[];
  /** Nonces that execute but whose receipt never reads. */
  unreadable?: bigint[];
}

/**
 * A shard as the launcher sees it: the mempool queues the launcher's transactions by nonce, and the sequencer executes
 * them in nonce order whenever the launcher reads. A create registers its game; a seat seats the game's next player,
 * or nobody once its roster is full.
 */
export function launchShard(faults: ShardFaults = {}) {
  const refuse = new Set(faults.refuse);
  const lose = new Set(faults.lose);
  const revert = new Set(faults.revert);
  const unreadable = new Set(faults.unreadable);
  const queued = new Map<bigint, Queued>();
  const results = new Map<bigint, SeatResult>();
  const games = new Map<number, { name: string; roster: number; seated: number }>();
  const state = {
    nonce: 0n,
    sent: [] as { nonce: bigint; kind: Queued["kind"]; gameId?: number }[],
    refused: 0,
    deepestQueue: 0,
    closedWaits: 0,
    /** Every seat reverts while set: a persistent refusal. */
    refusing: false,
  };
  const idOf = (name: string) => [...games].find(([, game]) => game.name === name)?.[0] ?? 0;
  const execute = () => {
    for (let tx = queued.get(state.nonce); tx; tx = queued.get(state.nonce)) {
      queued.delete(state.nonce);
      if (tx.kind === "create") {
        if (!idOf(tx.game.name)) games.set(games.size + 1, { name: tx.game.name, roster: tx.game.players, seated: 0 });
      } else if (state.refusing || revert.delete(state.nonce)) {
        results.set(state.nonce, "spent");
      } else {
        const game = games.get(tx.gameId)!;
        if (game.seated < game.roster) game.seated++;
        results.set(state.nonce, { remaining: BigInt(game.roster - game.seated) });
      }
      state.nonce++;
    }
  };
  const enqueue = (nonce: bigint, tx: Queued) => {
    // A dropped transaction, or one at a nonce the chain already took, never runs.
    if (lose.delete(nonce) || nonce < state.nonce) return;
    queued.set(nonce, tx);
    state.deepestQueue = Math.max(state.deepestQueue, queued.size);
  };
  const chain: SlotChain = {
    async nextNonce() {
      execute();
      return state.nonce;
    },
    async send(nonce, gameId) {
      if (refuse.delete(nonce)) {
        state.refused++;
        throw new SeatRefused();
      }
      state.sent.push({ nonce, kind: "seat", gameId });
      enqueue(nonce, { kind: "seat", gameId });
    },
    async result(nonce) {
      execute();
      return unreadable.has(nonce) ? "missing" : (results.get(nonce) ?? "missing");
    },
    async gameId(name) {
      execute();
      return idOf(name);
    },
    async sendCreate(game, nonce) {
      state.sent.push({ nonce, kind: "create" });
      enqueue(nonce, { kind: "create", game });
      return `0x${nonce.toString(16)}`;
    },
    async awaitClosed() {
      state.closedWaits++;
      execute();
    },
    async verify(game, gameId) {
      if (games.get(gameId)?.roster !== game.players) throw new Error("frozen_roster_differs");
    },
    async ready(gameId) {
      execute();
      const game = games.get(gameId)!;
      return game.seated === game.roster;
    },
  };
  return {
    chain,
    state,
    games,
    /** A game a crashed run already created, with this many players seated. */
    created(game: SlotGame, seated = 0) {
      games.set(games.size + 1, { name: game.name, roster: game.players, seated });
      return games.size;
    },
    /** Launcher transactions a crashed run left queued, which the new run no longer holds the hashes of. */
    queue(nonce: bigint, gameId: number) {
      queued.set(nonce, { kind: "seat", gameId });
    },
  };
}
