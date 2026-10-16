import { SeatRefused, type LauncherSeats, type SeatResult } from "./seat-pipeline";
import type { SlotChain, SlotGame } from "./slot-launch";

type Queued = { kind: "create"; game: SlotGame } | { kind: "seat"; gameId: number };

/** The scheduler's account, which creates the games; seaters are named by the games. */
const SCHEDULER = "scheduler";
/** The seater the per-nonce faults apply to. */
const FAULTY = "s0";

export interface ShardFaults {
  /** Nonces of s0 whose seat the RPC refuses once before forwarding. */
  refuse?: bigint[];
  /** Nonces of s0 accepted and then dropped, never executed: every later nonce of s0 waits behind them. */
  lose?: bigint[];
  /** Nonces of s0 whose seat executes and reverts, spending the nonce and seating nobody. */
  revert?: bigint[];
  /** Nonces of s0 that execute but whose receipt never reads. */
  unreadable?: bigint[];
}

/**
 * A shard as the launch sees it. The mempool queues each account's transactions by nonce, and the sequencer executes
 * every account's queue in nonce order whenever anyone reads. A create registers its game with its seater; a seat seats
 * the game's next player, or nobody once its roster is full.
 */
export function launchShard(faults: ShardFaults = {}) {
  const refuse = new Set(faults.refuse);
  const lose = new Set(faults.lose);
  const revert = new Set(faults.revert);
  const unreadable = new Set(faults.unreadable);
  const accounts = new Map<string, { nonce: bigint; queued: Map<bigint, Queued> }>();
  const results = new Map<string, SeatResult>();
  const games = new Map<number, { name: string; roster: number; seated: number; seater: string }>();
  const state = {
    sent: [] as { account: string; nonce: bigint; kind: Queued["kind"]; gameId?: number }[],
    refused: 0,
    deepestQueue: 0,
    closedWaits: 0,
    /** Seaters whose every seat reverts while listed: a persistent refusal. */
    refusing: new Set<string>(),
    nonce: (account: string) => accountOf(account).nonce,
  };
  const accountOf = (account: string) => {
    if (!accounts.has(account)) accounts.set(account, { nonce: 0n, queued: new Map() });
    return accounts.get(account)!;
  };
  const idOf = (name: string) => [...games].find(([, game]) => game.name === name)?.[0] ?? 0;
  const runSeat = (account: string, nonce: bigint, gameId: number): SeatResult => {
    if (state.refusing.has(account) || (account === FAULTY && revert.delete(nonce))) return "spent";
    const game = games.get(gameId)!;
    if (game.seated < game.roster) game.seated++;
    return { remaining: BigInt(game.roster - game.seated) };
  };
  const execute = () => {
    for (const [account, queue] of accounts) {
      for (let tx = queue.queued.get(queue.nonce); tx; tx = queue.queued.get(queue.nonce)) {
        queue.queued.delete(queue.nonce);
        if (tx.kind === "create" && !idOf(tx.game.name)) {
          const { name, players, seater } = tx.game;
          games.set(games.size + 1, { name, roster: players, seated: 0, seater });
        }
        if (tx.kind === "seat") results.set(`${account}:${queue.nonce}`, runSeat(account, queue.nonce, tx.gameId));
        queue.nonce++;
      }
    }
  };
  const enqueue = (account: string, nonce: bigint, tx: Queued) => {
    const queue = accountOf(account);
    // A dropped transaction, or one at a nonce the chain already took, never runs.
    if ((account === FAULTY && lose.delete(nonce)) || nonce < queue.nonce) return;
    queue.queued.set(nonce, tx);
    state.deepestQueue = Math.max(state.deepestQueue, queue.queued.size);
  };
  const seats = (account: string): LauncherSeats => ({
    async nextNonce() {
      execute();
      return accountOf(account).nonce;
    },
    async send(nonce, gameId) {
      if (account === FAULTY && refuse.delete(nonce)) {
        state.refused++;
        throw new SeatRefused();
      }
      state.sent.push({ account, nonce, kind: "seat", gameId });
      enqueue(account, nonce, { kind: "seat", gameId });
    },
    async result(nonce) {
      execute();
      if (account === FAULTY && unreadable.has(nonce)) return "missing";
      return results.get(`${account}:${nonce}`) ?? "missing";
    },
  });
  const chain: SlotChain = {
    async nextNonce() {
      execute();
      return accountOf(SCHEDULER).nonce;
    },
    async gameId(name) {
      execute();
      return idOf(name);
    },
    async sendCreate(game, nonce) {
      state.sent.push({ account: SCHEDULER, nonce, kind: "create" });
      enqueue(SCHEDULER, nonce, { kind: "create", game });
      return `0x${nonce.toString(16)}`;
    },
    async awaitClosed() {
      state.closedWaits++;
      execute();
    },
    async verify(game, gameId) {
      const stored = games.get(gameId)!;
      if (stored.roster !== game.players) throw new Error("frozen_roster_differs");
      if (stored.seater !== game.seater) throw new Error("game_seater_differs");
    },
    async ready(gameId) {
      execute();
      const game = games.get(gameId)!;
      return game.seated === game.roster;
    },
    seats,
  };
  return {
    chain,
    state,
    games,
    /** A game a crashed run already created, with this many players seated. */
    created(game: SlotGame, seated = 0) {
      games.set(games.size + 1, { name: game.name, roster: game.players, seated, seater: game.seater });
      return games.size;
    },
    /** A seat a crashed run left queued at this seater's nonce, which the new run no longer holds the hash of. */
    queue(seater: string, nonce: bigint, gameId: number) {
      accountOf(seater).queued.set(nonce, { kind: "seat", gameId });
    },
    /** What a seater sent, in order. */
    sentBy(account: string) {
      return state.sent.filter((sent) => sent.account === account);
    },
  };
}
