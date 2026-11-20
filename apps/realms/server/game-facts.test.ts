import { ShardReleaseMismatchError } from "@bibliothecadao/eternum/game-client";
import type { HeraldSocket } from "@bibliothecadao/eternum/game-sync";
import { afterEach, describe, expect, it, vi } from "vitest";

import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { readActorArmies } from "./army-rest";
import { followDeepSites } from "./deep-site-stream";
import { readReleaseCatalogue } from "./game-facts";
import { readDeepAlerts } from "./deep-site-watch";
import {
  ARMY,
  GAME_ID,
  mistFacts,
  PLAYER_ACCOUNT,
  RELEASE,
  siteSnapshot,
  snapshot,
  TODAY,
} from "./fixtures/shard-world";

afterEach(() => vi.unstubAllGlobals());

const SHARD = "https://herald.test";
const READABLE = bindings.schemaIdentity;
const OTHER = "0x1";
const pin = (created: number, release: number) => ({
  game_id: GAME_ID,
  release_id: release,
  created_release_id: created,
});

const caught = () => readReleaseCatalogue(SHARD);
const SITE = { troops: 1000, aspect: 2, lore: true, lastTick: 0 };
const world = (owner: string | null = null) => {
  const bar = { amount: 120, settledAt: Math.floor(Date.now() / 1000), day: TODAY };
  const read = snapshot(bar, bar, owner, [PLAYER_ACCOUNT], "golden", null);
  return siteSnapshot({ ...read, models: [...read.models, ...mistFacts(undefined)] }, SITE, owner);
};

const heraldServing = (
  releases: Record<string, string>,
  current: ReturnType<typeof pin> | null,
  manifestFailures = 0,
) => {
  let failures = manifestFailures;
  return vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname === "/manifest")
        return failures-- > 0
          ? new Response("unavailable", { status: 503 })
          : Response.json({ version: 1, releaseSchemas: releases });
      const read = world(url.searchParams.get("owner"));
      read.models.find(({ model }) => model === "GameRelease")!.rows = current ? [{ key: "0x1", value: current }] : [];
      return Response.json(read);
    }),
  );
};

const REFUSED = [
  ["an incompatible origin", { [RELEASE - 1]: OTHER, [RELEASE]: READABLE }, pin(RELEASE - 1, RELEASE)],
  ["an incompatible current release", { [RELEASE - 1]: READABLE, [RELEASE]: OTHER }, pin(RELEASE - 1, RELEASE)],
  ["an unknown intermediate release", { [RELEASE - 2]: READABLE, [RELEASE]: READABLE }, pin(RELEASE - 2, RELEASE)],
  ["a pin that runs backwards", { [RELEASE - 1]: READABLE, [RELEASE]: READABLE }, pin(RELEASE, RELEASE - 1)],
] as const;

describe("the notification snapshot readers", () => {
  it.each(REFUSED)("refuse %s before any fact is interpreted", async (_case, releases, current) => {
    heraldServing(releases, current);
    await expect(readActorArmies(SHARD, GAME_ID, PLAYER_ACCOUNT, Date.now(), await caught())).rejects.toBeInstanceOf(
      ShardReleaseMismatchError,
    );
    await expect(
      readDeepAlerts(
        SHARD,
        { gameId: GAME_ID, actor: PLAYER_ACCOUNT, owner: PLAYER_ACCOUNT },
        Date.now(),
        await caught(),
      ),
    ).rejects.toBeInstanceOf(ShardReleaseMismatchError);
  });

  it("read a game whose pin moved on through releases they all read", async () => {
    heraldServing({ [RELEASE - 1]: READABLE, [RELEASE]: READABLE }, pin(RELEASE - 1, RELEASE));
    const armies = await readActorArmies(SHARD, GAME_ID, PLAYER_ACCOUNT, Date.now(), await caught());
    expect(armies.map(({ armyId }) => armyId)).toContain(ARMY);
    await expect(
      readDeepAlerts(
        SHARD,
        { gameId: GAME_ID, actor: PLAYER_ACCOUNT, owner: PLAYER_ACCOUNT },
        Date.now(),
        await caught(),
      ).then(({ sites }) => sites),
    ).resolves.toBeInstanceOf(Array);
  });
});

const watching = (
  releases: Record<string, string>,
  current: ReturnType<typeof pin> | null = pin(RELEASE, RELEASE),
  failures = 0,
) => {
  heraldServing(releases, current, failures);
  const sockets: { closed: boolean; receive: (message: unknown) => void }[] = [];
  const open = (): HeraldSocket => {
    const socket = {
      closed: false,
      onclose: null,
      onerror: null,
      onmessage: null as HeraldSocket["onmessage"],
      onopen: null,
      close() {
        socket.closed = true;
      },
      send() {},
      receive: (message: unknown) => socket.onmessage?.({ data: JSON.stringify(message) }),
    };
    sockets.push(socket);
    return socket;
  };
  const changed = vi.fn();
  followDeepSites(SHARD, GAME_ID, changed, undefined, open);
  const socket = sockets[0]!;
  socket.receive({ type: "hello", epoch: "e", seq: 0, confirmed_block: 10, preconfirmed_block: null });
  let seq = 0;
  const models = world()
    .models.filter(({ model }) => model === "GameRelease" || model === "DeepRules")
    .map((model) => (model.model === "GameRelease" && !current ? { ...model, rows: [] } : model));
  for (const model of models) socket.receive({ type: "snapshot", epoch: "e", seq: 0, ...model });
  socket.receive({ type: "snapshot_end", epoch: "e", seq: 0 });
  const release = (current: ReturnType<typeof pin>) =>
    socket.receive({
      type: "diff",
      epoch: "e",
      seq: ++seq,
      block: 11,
      preconfirmed: false,
      set: [{ model: "GameRelease", key: "0x1", value: current }],
      del: [],
    });
  return { socket, changed, release };
};

describe("a deep site stream", () => {
  it("arms its watches from a readable game, and stops at once on a game it cannot read", async () => {
    const readable = watching({ [RELEASE]: READABLE });
    await vi.waitFor(() => expect(readable.changed).toHaveBeenCalledTimes(1));
    expect(readable.socket.closed).toBe(false);

    const unreadable = watching({ [RELEASE]: OTHER });
    await vi.waitFor(() => expect(unreadable.socket.closed).toBe(true));
    expect(unreadable.changed).not.toHaveBeenCalled();
  });

  it("leaves a release check it could not make to the notifier's re-read, which checks again", async () => {
    const stream = watching({ [RELEASE]: READABLE }, pin(RELEASE, RELEASE), 1);
    await vi.waitFor(() => expect(stream.changed).toHaveBeenCalledTimes(1));
    expect(stream.socket.closed).toBe(false);
  });

  it("stops on a game that shows no release pin, as on one it cannot read", async () => {
    const stream = watching({ [RELEASE]: READABLE }, null);
    await vi.waitFor(() => expect(stream.socket.closed).toBe(true));
    expect(stream.changed).not.toHaveBeenCalled();
  });

  it("revalidates when the game's release changes: a readable one re-reads the watches, an unreadable one stops", async () => {
    const stream = watching({ [RELEASE - 2]: OTHER, [RELEASE - 1]: READABLE, [RELEASE]: READABLE });
    await vi.waitFor(() => expect(stream.changed).toHaveBeenCalledTimes(1));
    stream.release(pin(RELEASE - 1, RELEASE));
    await vi.waitFor(() => expect(stream.changed).toHaveBeenCalledTimes(2));
    expect(stream.socket.closed).toBe(false);
    stream.release(pin(RELEASE - 2, RELEASE));
    await vi.waitFor(() => expect(stream.socket.closed).toBe(true));
    expect(stream.changed).toHaveBeenCalledTimes(2);
  });
});
