import type { LedgerGameKey } from "@realms-world/value-ledger";
import { relayOperation } from "./ports";
import { normalizeStarknetAddress } from "@realms-world/identity";

interface Head {
  number: number;
  hash: string;
  time: number;
}
interface Season {
  id: number;
  participantCount: number;
  paidFraction: number;
  topCount: number;
  posted: boolean;
  challenged: boolean;
  settlementStarted: boolean;
  end: number;
  reviewUntil: number;
}
type Change =
  | { kind: "opened" | "posted" | "corrected"; id: number; reviewUntil?: number; revision?: string }
  | { kind: "game"; id: number; key: LedgerGameKey; terminal: boolean; revision?: string }
  | { kind: "participant"; id: number; wallet: string };
interface Page {
  rows: readonly Change[];
  head: number;
  next: string | null;
}
export interface SeasonPorts {
  head(): Promise<Head>;
  blockHash(number: number): Promise<string>;
  changes(from: number, cursor: string | null, head: number): Promise<Page>;
  posts(from: number, cursor: string | null, head: number): Promise<Page>;
  season(id: number, head: number): Promise<Season>;
  game(key: LedgerGameKey, head: number): Promise<{ id: number; terminal: boolean }>;
  mmr(id: number, wallet: string, head: number): Promise<string>;
  winner(id: number, index: number, head: number): Promise<string>;
  post(id: number, wallets: readonly string[]): Promise<void>;
}
interface Store {
  get<A>(key: string): Promise<A | undefined>;
  put(key: string, value: unknown): Promise<unknown>;
  delete(key: string): Promise<boolean>;
  list<A>(options: { prefix: string; limit: number; startAfter?: string }): Promise<Map<string, A>>;
}
interface Cursor {
  from: number;
  token: string | null;
  head: number;
  hash: string;
}
interface Audit {
  head: Head;
  revision: string;
  phase: "mmr" | "winners" | "post" | "done";
  after: string | null;
  checked: number;
  winnerIndex: number;
  proposal?: Head;
  proposalRevision?: string;
}
const SIZE = 100;

export const processSeasonTops = (mode: "post" | "audit", ports: SeasonPorts, store: Store) =>
  relayOperation("season_" + mode, async () => {
    try {
      return await runSeasonTops(mode, ports, store);
    } catch (error) {
      if (mode === "audit") {
        const clock = await store.get<{ time: number; at: number }>("season:clock");
        const unverified = await store.list<{ id: number; deadline: number }>({
          prefix: "season:unverified:",
          limit: 100,
        });
        const elapsed = clock ? Math.max(0, Math.ceil((Date.now() - clock.at) / 1000)) : 0;
        const due = [...unverified.values()].find((row) => !clock || clock.time + elapsed >= row.deadline - 60);
        if (due) return `season_top_unavailable:${due.id}`;
      }
      throw error;
    }
  });

/** The ledger's frozen seasonal MMR is the leaderboard; the live token may already belong to the next season. */
async function runSeasonTops(mode: "post" | "audit", ports: SeasonPorts, store: Store): Promise<string | null> {
  const head = await ports.head();
  await store.put("season:clock", { time: head.time, at: Date.now() });
  const postsComplete = await ingestSeasonEvents(mode, "posts", ports.posts, head, ports, store);
  const complete = await ingestSeasonEvents(mode, "changes", ports.changes, head, ports, store);
  if (mode === "audit" && !postsComplete) return `season_posts_unverified:${head.number}`;
  const cursor = await store.get<string>(`season:${mode}:cursor`);
  const prefix = "season:known:";
  let pending = await store.list<number>({ prefix, limit: 1, ...(cursor ? { startAfter: cursor } : {}) });
  if (!pending.size && cursor) pending = await store.list<number>({ prefix, limit: 1 });
  const entry = [...pending][0];
  if (!entry) return null;
  await store.put(`season:${mode}:cursor`, entry[0]);
  const season = await ports.season(entry[1], head.number);
  if (mode === "audit" && season.challenged) await clearSeasonAuditMarkers(store, season.id);
  if (
    head.time < season.end ||
    !season.participantCount ||
    (mode === "post" && season.posted && !season.challenged && season.topCount === winnerCount(season)) ||
    (mode === "audit" && season.challenged)
  )
    return null;
  if (!(await gamesFinished(season.id, head, ports, store))) return pendingFault(mode, season, head);
  const fault = await advanceSeason(mode, season, head, complete, ports, store);
  return fault;
}
async function gamesFinished(id: number, head: Head, ports: SeasonPorts, store: Store) {
  const prefix = `season:game:${id}:`;
  const cursorKey = `season:games-cursor:${id}`;
  const after = await store.get<string>(cursorKey);
  let rows = await store.list<LedgerGameKey>({ prefix, limit: 25, ...(after ? { startAfter: after } : {}) });
  if (!rows.size && after) rows = await store.list<LedgerGameKey>({ prefix, limit: 25 });
  for (const [key, game] of rows) {
    const status = await ports.game(game, head.number);
    if (status.id !== id) throw new Error("season_game_binding_differs");
    if (status.terminal) await store.delete(key);
  }
  await store.put(cursorKey, rows.size === 25 ? [...rows.keys()].at(-1)! : "");
  return !(await store.list({ prefix, limit: 1 })).size;
}
async function ingestSeasonEvents(
  mode: "post" | "audit",
  stream: "changes" | "posts",
  read: SeasonPorts["changes"],
  head: Head,
  ports: SeasonPorts,
  store: Store,
) {
  const key = `season:events:${stream}`;
  const saved = await store.get<Cursor>(key);
  if (saved && (head.number < saved.head || BigInt(await ports.blockHash(saved.head)) !== BigInt(saved.hash)))
    throw new Error("season_event_anchor_changed");
  const cursor = saved ?? { from: 0, token: null, head: head.number, hash: head.hash };
  if (cursor.from > head.number) return true;
  const pin = cursor.token ? cursor.head : head.number;
  if (cursor.token && BigInt(await ports.blockHash(pin)) !== BigInt(cursor.hash))
    throw new Error("season_event_anchor_changed");
  const page = await read(cursor.from, cursor.token, pin);
  if (page.head !== pin || page.rows.length > SIZE || (page.next !== null && page.next === cursor.token))
    throw new Error("invalid_season_event_page");
  for (const row of page.rows) {
    await store.put(`season:known:${row.id}`, row.id);
    if (row.kind === "game") {
      const key = `season:game:${row.id}:${row.key.chainId}:${row.key.gameId}`;
      if (row.terminal) await store.delete(key);
      else await store.put(key, row.key);
    }
    if (row.kind === "corrected" || (row.kind === "game" && row.revision)) {
      if (!row.revision) throw new Error("season_correction_revision_missing");
      await store.put(`season:correction:${row.id}`, row.revision);
    }
    if (row.kind === "posted") {
      if (row.revision) await store.put(`season:proposal:${row.id}`, row.revision);
      if (mode === "audit" && row.kind === "posted")
        await store.put(`season:unverified:${String(row.reviewUntil ?? 0).padStart(16, "0")}:${row.id}`, {
          id: row.id,
          deadline: row.reviewUntil ?? 0,
        });
    }
    if (row.kind === "participant") {
      const wallet = normalizeStarknetAddress(row.wallet);
      await store.put(`season:participant:${row.id}:${wallet}`, wallet);
    }
  }
  await store.put(key, {
    from: page.next ? cursor.from : pin + 1,
    token: page.next,
    head: pin,
    hash: cursor.token ? cursor.hash : head.hash,
  });
  return page.next === null && pin === head.number;
}
async function advanceSeason(
  mode: "post" | "audit",
  season: Season,
  head: Head,
  complete: boolean,
  ports: SeasonPorts,
  store: Store,
) {
  const key = `season:${mode}:job:${season.id}`;
  const correction = (await store.get<string>(`season:correction:${season.id}`)) ?? "";
  const revision = `${season.participantCount}:${season.paidFraction}:${correction}`;
  let job = await store.get<Audit>(key);
  if (!job || job.revision !== revision)
    job = { head, revision, phase: "mmr", after: null, checked: 0, winnerIndex: 0 };
  if (mode === "post" && season.challenged && job.phase === "done") job.phase = "post";
  if (
    mode === "audit" &&
    job.phase !== "mmr" &&
    season.posted &&
    !season.challenged &&
    season.topCount === winnerCount(season)
  ) {
    const proposalRevision = `${season.reviewUntil}:${(await store.get<string>(`season:proposal:${season.id}`)) ?? ""}`;
    if (job.proposalRevision !== proposalRevision) {
      job.proposal = head;
      job.proposalRevision = proposalRevision;
      job.phase = "winners";
      job.winnerIndex = 0;
      job.after = null;
    }
  }

  if (job.proposal && BigInt(await ports.blockHash(job.proposal.number)) !== BigInt(job.proposal.hash))
    throw new Error("season_proposal_anchor_changed");
  if (job.phase === "done") {
    await clearSeasonAuditMarkers(store, season.id);
    return null;
  }
  if (!complete) return pendingFault(mode, season, head);
  if (BigInt(await ports.blockHash(job.head.number)) !== BigInt(job.head.hash))
    throw new Error("season_snapshot_anchor_changed");
  const scorePrefix = `season:score:${mode}:${season.id}:${job.head.hash}:`;
  if (job.phase === "mmr") {
    const participants = await store.list<string>({
      prefix: `season:participant:${season.id}:`,
      limit: SIZE,
      ...(job.after ? { startAfter: job.after } : {}),
    });
    const rows = [...participants];
    const ratings = await Promise.all(rows.map(([, wallet]) => ports.mmr(season.id, wallet, job.head.number)));
    for (let index = 0; index < rows.length; index++) {
      const rating = BigInt(ratings[index]!);
      if (rating < 0n || rating >= 2n ** 128n) throw new Error("invalid_season_mmr");
      const wallet = rows[index]![1];
      const order = (2n ** 128n - 1n - rating).toString(16).padStart(32, "0");
      await store.put(`${scorePrefix}${order}:${wallet.slice(2).padStart(64, "0")}`, wallet);
    }
    job.checked += rows.length;
    job.after = rows.at(-1)?.[0] ?? job.after;
    if (rows.length < SIZE) {
      if (job.checked !== season.participantCount)
        return mode === "audit" ? `season_population_mismatch:${season.id}` : pendingFault(mode, season, head);
      job.phase = "winners";
      job.after = null;
    }
  } else if (job.phase === "winners") {
    const count = winnerCount(season);
    if (mode === "audit" && (!season.posted || !job.proposal)) return pendingFault(mode, season, head);
    if (mode === "audit" && season.topCount !== count) return `season_top_mismatch:${season.id}`;
    const rows = [
      ...(await store.list<string>({
        prefix: scorePrefix,
        limit: Math.min(SIZE, count - job.winnerIndex),
        ...(job.after ? { startAfter: job.after } : {}),
      })),
    ];
    if (!rows.length && job.winnerIndex < count) throw new Error("season_top_population_missing");
    const actual =
      mode === "audit"
        ? await Promise.all(
            rows.map((_, index) => ports.winner(season.id, job.winnerIndex + index, job.proposal!.number)),
          )
        : [];
    for (let index = 0; index < rows.length; index++) {
      const wallet = rows[index]![1];
      if (mode === "audit" && BigInt(actual[index]!) !== BigInt(wallet)) return `season_top_mismatch:${season.id}`;
      await store.put(`season:top:${mode}:${season.id}:${String(job.winnerIndex + index).padStart(16, "0")}`, wallet);
    }
    job.winnerIndex += rows.length;
    job.after = rows.at(-1)?.[0] ?? job.after;
    if (job.winnerIndex === count) {
      job.phase = mode === "post" ? "post" : "done";
    }
  } else if (job.phase === "post") {
    const count = winnerCount(season);
    const winners: string[] = [];
    for (let index = 0; index < count; index++) {
      const wallet = await store.get<string>(`season:top:${mode}:${season.id}:${String(index).padStart(16, "0")}`);
      if (!wallet) throw new Error("season_top_population_missing");
      winners.push(wallet);
    }
    await ports.post(season.id, winners);
    job.phase = "done";
  }

  await store.put(key, job);
  if (mode === "audit" && job.phase === "done") await clearSeasonAuditMarkers(store, season.id);
  return job.phase === "done" ? null : pendingFault(mode, season, head);
}
const pendingFault = (mode: "post" | "audit", season: Season, head: Head) =>
  mode === "audit" && season.posted && !season.challenged && head.time >= season.reviewUntil - 60
    ? `season_top_unverified:${season.id}`
    : null;

async function clearSeasonAuditMarkers(store: Store, id: number) {
  const markers = await store.list<{ id: number }>({ prefix: "season:unverified:", limit: 100 });
  for (const [key, row] of markers) if (row.id === id) await store.delete(key);
}

const winnerCount = (season: Season) =>
  Number((BigInt(season.participantCount) * BigInt(season.paidFraction) + 9999n) / 10000n);
