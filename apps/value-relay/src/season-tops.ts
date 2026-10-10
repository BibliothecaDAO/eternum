import { computeSeasonTop } from "@realms-world/value-ledger";
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
  end: number;
  reviewUntil: number;
}
type Change =
  | { kind: "opened" | "posted" | "corrected"; id: number; reviewUntil?: number; revision?: string }
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
  mmr(id: number, wallet: string, head: number): Promise<string>;
  winner(id: number, index: number, head: number): Promise<string>;
  post(id: number, wallets: readonly string[]): Promise<void>;
  challenge(id: number, omitted: string): Promise<void>;
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
const SIZE = 100;

export const processSeasonTops = (mode: "post" | "audit", ports: SeasonPorts, store: Store) =>
  relayOperation("season_" + mode, () => runSeasonTops(mode, ports, store));

/** Both processes derive the list independently from the same frozen seasonal MMR. */
async function runSeasonTops(mode: "post" | "audit", ports: SeasonPorts, store: Store): Promise<string | null> {
  const head = await ports.head();
  const postsComplete = await ingestSeasonEvents("posts", ports.posts, head, ports, store);
  const complete = await ingestSeasonEvents("changes", ports.changes, head, ports, store);
  if (!complete || !postsComplete) return "season_history_pending";
  const id = await nextSeason(mode, store);
  if (id === undefined) return null;
  const season = await ports.season(id, head.number);
  if (head.time < season.end || !season.participantCount) return null;
  if (mode === "post" && season.posted && !season.challenged) return null;
  if (mode === "audit" && (!season.posted || season.challenged)) return null;
  const revision = `${season.reviewUntil}:${(await store.get<string>(`season:proposal:${season.id}`)) ?? ""}:${(await store.get<string>(`season:correction:${season.id}`)) ?? ""}`;
  const checkedKey = `season:checked:${season.id}`;
  if (mode === "audit" && (await store.get<string>(checkedKey)) === revision) return null;
  const ratings = await readSeasonRatings(season, head, ports, store);
  const expected = computeSeasonTop(ratings, season.paidFraction);
  if (mode === "post") {
    await ports.post(season.id, expected);
    return null;
  }
  return reviewSeasonTop(season, head, expected, revision, ports, store);
}

async function nextSeason(mode: "post" | "audit", store: Store) {
  const key = `season:${mode}:cursor`;
  const cursor = await store.get<string>(key);
  const prefix = "season:known:";
  let pending = await store.list<number>({ prefix, limit: 1, ...(cursor ? { startAfter: cursor } : {}) });
  if (!pending.size && cursor) pending = await store.list<number>({ prefix, limit: 1 });
  const entry = [...pending][0];
  if (!entry) return undefined;
  await store.put(key, entry[0]);
  return entry[1];
}

async function reviewSeasonTop(
  season: Season,
  head: Head,
  expected: readonly string[],
  revision: string,
  ports: SeasonPorts,
  store: Store,
) {
  const actual = await Promise.all(
    Array.from({ length: season.topCount }, (_, index) => ports.winner(season.id, index, head.number)),
  );
  if (
    actual.length === expected.length &&
    actual.every((wallet, index) => BigInt(wallet) === BigInt(expected[index]!))
  ) {
    await store.put(`season:checked:${season.id}`, revision);
    return null;
  }
  const listed = new Set(actual.map((wallet) => BigInt(wallet).toString()));
  const omitted = expected.find((wallet) => !listed.has(BigInt(wallet).toString()));
  if (!omitted) throw new Error("season_top_order_differs");
  await ports.challenge(season.id, omitted);
  return `season_challenged:${season.id}`;
}

async function readSeasonRatings(season: Season, head: Head, ports: SeasonPorts, store: Store) {
  const ratings: { wallet: string; mmr: string }[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await store.list<string>({
      prefix: `season:participant:${season.id}:`,
      limit: SIZE,
      ...(after ? { startAfter: after } : {}),
    });
    ratings.push(
      ...(await Promise.all(
        [...page.values()].map(async (wallet) => ({ wallet, mmr: await ports.mmr(season.id, wallet, head.number) })),
      )),
    );
    if (page.size < SIZE) break;
    after = [...page.keys()].at(-1)!;
  }
  if (ratings.length !== season.participantCount) throw new Error("season_population_mismatch");
  if (BigInt(await ports.blockHash(head.number)) !== BigInt(head.hash))
    throw new Error("season_snapshot_anchor_changed");
  return ratings;
}

async function ingestSeasonEvents(
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
    if (row.kind === "corrected") {
      if (!row.revision) throw new Error("season_correction_revision_missing");
      await store.put(`season:correction:${row.id}`, row.revision);
    }
    if (row.kind === "posted" && row.revision) await store.put(`season:proposal:${row.id}`, row.revision);
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
