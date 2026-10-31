// @vitest-environment jsdom
import { act, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const PLAYER = "0x1";

/** The game's history, which each story read filters as Herald does. */
const history = vi.hoisted(
  () =>
    [] as {
      id: string;
      story: string;
      owner: string;
      participants: string[];
      at: number;
      tx?: string;
      /** Its place in its transaction's receipt, where it matters. */
      index?: number;
      /** The structure the story is about; 900 unless it says. */
      entity?: number;
      payload?: Record<string, unknown>;
    }[],
);
/** The player's lens for Events, and the game's Hyperstructures. */
const world = vi.hoisted(() => ({ filter: "all" as "important" | "all", hyperstructures: [] as number[] }));

vi.mock("@/hooks/helpers/use-block-timestamp", async () => {
  const { useChainTimeStore } = await import("@/hooks/store/use-chain-time-store");
  return { useNowMs: () => useChainTimeStore((state) => state.nowMs) };
});
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (select: (state: unknown) => unknown) => select({ account: { address: PLAYER } }),
}));
vi.mock("@/hooks/store/use-story-events-store", () => {
  type Read = { limit: number; story?: string; owner?: string; entityId?: number };
  /** One read as Herald serves it: its newest `limit` stories of its story, naming its player, about its entity. */
  const serve = ({ limit, story, owner, entityId }: Read) =>
    history
      .toSorted((left, right) => right.at - left.at)
      .filter((event) => !story || event.story === story)
      .filter((event) => !owner || event.participants.some((address) => BigInt(address) === BigInt(owner)))
      .filter((event) => entityId === undefined || (event.entity ?? 900) === entityId)
      .slice(0, limit)
      .map((event) => ({
        ...event,
        event_id:
          event.index === undefined ? event.id : `story:v2:test:0x1:0x1:${event.tx}:0x${event.index.toString(16)}`,
        entity_id: event.entity ?? 900,
        tx_hash: event.tx ?? `0x${event.id}`,
        timestamp: String(event.at / 1_000),
        timestampMs: event.at,
        storyPayload: event.payload ?? {},
      }));
  return {
    useStoryReads: (reads: Read[]) => ({
      data: [...new Map(reads.flatMap(serve).map((event) => [event.id, event])).values()],
      queries: [],
    }),
    useStoryEvents: (limit: number) => ({ data: serve({ limit }), isError: false, refetch: () => undefined }),
  };
});
vi.mock("@/hooks/store/use-events-filter-store", () => ({ useEventsFilter: () => [world.filter, () => undefined] }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      store: { inGame: () => world.hyperstructures.map((entity_id) => ({ entity_id })) },
    },
  }),
}));
vi.mock("@/hooks/helpers/use-native-facts", async () =>
  (await import("@/hooks/helpers/native-facts-mock")).nativeFactsMock(),
);
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getTick: () => 60, getActiveGameId: () => 1 } }));
vi.mock("@/ui/design-system/molecules/popover", () => ({
  PopoverPanel: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./events-filter-switch", () => ({ EventsFilterSwitch: () => null }));
vi.mock("./story-feed-row", () => ({ StoryFeedRow: ({ event }: { event: { id: string } }) => <i>{event.id}</i> }));
vi.mock("./feed-row-line", () => ({
  FeedRowLine: ({ event }: { event: { id: string } }) => <i>{event.id}</i>,
  ToastRow: ({ text }: { text: string }) => <b>{text}</b>,
  headlineIcon: () => "play",
}));

import { useHeadlineFeedStore } from "../news-headlines/headline-feed-store";
import { useEventFeedStore } from "./event-feed-store";
import { EventLogPanel } from "./event-log-panel";
import { QuickFeedRows, useEventsFeed } from "./quick-feed";
import { EventsCard } from "../world/hud/events-card";
import { HISTORY, LOG_BUTTON } from "../../../../scripts/prove-play-game.mjs";

const fight = (id: string, at: number, attacker = "0x5", defender = "0x6") => ({
  id,
  story: "BattleEvent",
  owner: attacker,
  participants: [attacker, defender],
  at,
  payload: { defender_id: 900, attacker: { player: attacker }, defender: { player: defender } },
});

const capture = (id: string, at: number, taker: string, holder: string) => ({
  id,
  story: "StructureCapturedStory",
  owner: taker,
  participants: [taker, holder],
  at,
  payload: { previous_owner: holder, new_owner: taker },
});
const othersFights = (count: number, from: number) =>
  Array.from({ length: count }, (_, index) => fight(`theirs${index}`, from + index));
const routineStories = (count: number, from: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `made${index}`,
    story: "ProductionStory",
    owner: PLAYER,
    participants: [PLAYER],
    at: from + index,
  }));

it.each(["all"] as const)(
  "the Log reads the player's site benefits under %s without requiring push notifications",
  (filter) => {
    world.filter = filter;
    history.push(
      {
        id: "shrine",
        story: "SiteUsed",
        owner: PLAYER,
        participants: [PLAYER],
        at: 80_000,
        payload: { explorer_id: 9, benefit: { Shrine: 200 } },
      },
      {
        id: "well",
        story: "SiteUsed",
        owner: PLAYER,
        participants: [PLAYER],
        at: 90_000,
        payload: { explorer_id: 9, benefit: { Well: 5 } },
      },
      {
        id: "theirs",
        story: "SiteUsed",
        owner: "0x2",
        participants: ["0x2"],
        at: 95_000,
        payload: { explorer_id: 10, benefit: { Shrine: 200 } },
      },
    );
    act(() => root.render(<EventLogPanel onDismiss={() => undefined} isInsideAnchor={() => false} />));
    expect(rows()).toEqual(["theirs", "well", "shrine"]);
  },
);

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const draw = () => act(() => root.render(<QuickFeedRows />));
const rows = () => [...host.querySelectorAll("i")].map((row) => row.textContent);
const toasts = () => [...host.querySelectorAll("b")].map((toast) => toast.textContent);

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  history.length = 0;
  world.filter = "all";
  world.hyperstructures = [];
  useEventFeedStore.setState({ notices: [] });
  useHeadlineFeedStore.setState({ headlines: [] });
  useChainTimeStore.getState().anchor({ timestamp: 100_000 });
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => act(() => root.unmount()));

it("shows under All the world's history, newest first: every player's stories, routine ones too", () => {
  history.push(
    fight("battle", 90_000),
    { id: "crate", story: "RelicChestOpened", owner: PLAYER, participants: [PLAYER], at: 80_000 },
    { id: "made", story: "ProductionStory", owner: PLAYER, participants: [PLAYER], at: 95_000 },
    { id: "theirs", story: "RelicChestOpened", owner: "0x2", participants: ["0x2"], at: 85_000 },
  );
  const Ids = () => (
    <>
      {useEventsFeed()
        .stories.map(({ id }) => id)
        .join(",")}
    </>
  );
  expect(renderToStaticMarkup(<Ids />)).toBe("made,battle,theirs,crate");
});

it("says so under Important before anything important has happened, and stops once something has", () => {
  world.filter = "important";
  history.push(...routineStories(2, 1_000));
  draw();
  expect(rows()).toEqual([]);
  expect(host.textContent).toBe("Nothing here yet.");

  history.push(fight("mine", 2_000, PLAYER));
  draw();
  expect(rows()).toEqual(["mine"]);
  expect(host.textContent).not.toContain("Nothing here yet.");
});

it("shows the game's three newest stories, newest on top, however long the clock runs on", () => {
  history.push(fight("r0", 99_000), fight("r1", 98_000), fight("r2", 97_000), fight("r3", 96_000));
  draw();
  expect(rows()).toEqual(["r0", "r1", "r2"]);
  act(() => useChainTimeStore.getState().anchor({ timestamp: 3_600_000 }));
  draw();
  expect(rows()).toEqual(["r0", "r1", "r2"]);
});

it("puts a newer story on top and lets the oldest go; the other two keep their elements", () => {
  history.push(fight("r0", 99_000), fight("r1", 98_000), fight("r2", 97_000));
  draw();
  const kept = [...host.querySelectorAll("i")].slice(0, 2);
  history.push(fight("newer", 101_000));
  draw();
  expect(rows()).toEqual(["newer", "r0", "r1"]);
  expect([...host.querySelectorAll("i")].slice(1)).toEqual(kept);
});

it("keeps the player's crate under Important however many routine stories of theirs come after it", () => {
  world.filter = "important";
  history.push(
    { id: "crate", story: "RelicChestOpened", owner: PLAYER, participants: [PLAYER], at: 50_000 },
    ...Array.from({ length: 160 }, (_, index) => ({
      id: `made${index}`,
      story: "ProductionStory",
      owner: PLAYER,
      participants: [PLAYER],
      at: 60_000 + index,
    })),
    fight("theirs", 99_000),
  );
  draw();
  expect(rows()).toEqual(["crate"]);
});

it("shows under Important a Hyperstructure taken by other players, and the player's fight, not others' fights", () => {
  world.filter = "important";
  world.hyperstructures = [900];
  history.push(fight("mine", 97_000, PLAYER, "0x5"), fight("theirs", 98_000), {
    id: "seized",
    story: "StructureCapturedStory",
    owner: "0xb",
    participants: ["0xb", "0xc"],
    at: 99_000,
    payload: { previous_owner: "0xc", new_owner: "0xb" },
  });
  draw();
  expect(rows()).toEqual(["seized", "mine"]);
});

it("keeps the player's three fights under Important through other players' fights and their own routine stories", () => {
  world.filter = "important";
  history.push(fight("mine3", 99_000, PLAYER), fight("mine2", 98_000, "0x5", PLAYER), fight("mine1", 97_000, PLAYER));
  draw();
  expect(rows()).toEqual(["mine3", "mine2", "mine1"]);
  history.push(...othersFights(350, 200_000), ...routineStories(150, 300_000));
  draw();
  expect(rows()).toEqual(["mine3", "mine2", "mine1"]);
  history.push(fight("newer", 400_000, "0x5", PLAYER));
  draw();
  expect(rows()).toEqual(["newer", "mine3", "mine2"]);
});

it("keeps a Hyperstructure's capture under Important through other structures' captures", () => {
  world.filter = "important";
  world.hyperstructures = [900];
  history.push(capture("seized", 99_000, "0xb", "0xc"));
  history.push(
    ...Array.from({ length: 150 }, (_, index) => ({
      ...capture(`realm${index}`, 200_000 + index, "0xd", "0xe"),
      entity: 7,
    })),
  );
  draw();
  expect(rows()).toEqual(["seized"]);
});

it("opens the Log on the same Important stories the strip keeps", () => {
  world.filter = "important";
  history.push(fight("mine3", 99_000, PLAYER), fight("mine2", 98_000, PLAYER), fight("mine1", 97_000, PLAYER));
  history.push(fight("mine0", 96_000, PLAYER), ...othersFights(350, 200_000), ...routineStories(150, 300_000));
  act(() => root.render(<EventLogPanel onDismiss={() => undefined} isInsideAnchor={() => false} />));
  expect(rows()).toEqual(["mine3", "mine2", "mine1", "mine0"]);
});

it("opens the Log under All on the world's history as one list, with no second list under it", () => {
  history.push(fight("theirs", 99_000), { ...routineStories(1, 98_000)[0], id: "made" }, fight("mine", 97_000, PLAYER));
  act(() => root.render(<EventLogPanel onDismiss={() => undefined} isInsideAnchor={() => false} />));
  expect(rows()).toEqual(["theirs", "made", "mine"]);
  expect(host.textContent).not.toContain("World history");
});

it("tells under Important a capture and the fight that won it as one row, by its capture", () => {
  world.filter = "important";
  // The contract writes the capture, then the battle in which the structure's last guard fell.
  history.push(
    {
      ...fight("fight", 99_001, PLAYER, "0xa1"),
      tx: "0xc1a",
      index: 4,
      payload: {
        attacker_id: 41,
        defender_id: 900,
        attacker: { player: PLAYER, before: "2000", after: "1500" },
        defender: { player: "0xa1", before: "1000", after: "0" },
      },
    },
    {
      id: "taken",
      story: "StructureCapturedStory",
      owner: PLAYER,
      participants: [PLAYER, "0xa1"],
      at: 99_000,
      tx: "0xc1a",
      index: 3,
      payload: { previous_owner: "0xa1", new_owner: PLAYER },
    },
  );
  draw();
  expect(rows()).toEqual(["taken"]);
});

it("shows the client's toasts above the stories, apart from their three: a notice in its time, the clock's milestones", () => {
  history.push(fight("r0", 99_000), fight("r1", 98_000), fight("r2", 97_000));
  useEventFeedStore.getState().push({ kind: "error", title: "Not enough stamina", ttlMs: 60_000 });
  useHeadlineFeedStore.setState({
    headlines: [
      {
        id: "end",
        type: "game-end",
        title: "Game over",
        description: ["The game has ended"],
        icon: "game-end",
        timestamp: 100_000,
      },
      {
        id: "seized",
        type: "hyper-capture",
        title: "Seized",
        description: ["b took a Hyperstructure"],
        icon: "hyper-capture",
        timestamp: 100_000,
      },
    ],
  });
  draw();
  expect(toasts()).toEqual(["The game has ended", "Not enough stamina"]);
  expect(rows()).toEqual(["r0", "r1", "r2"]);
});

it("drops a notice once its time is over", async () => {
  vi.useFakeTimers();
  try {
    useEventFeedStore.getState().push({ kind: "warning", title: "Storage is full", ttlMs: 1_000 });
    draw();
    expect(toasts()).toEqual(["Storage is full"]);
    await act(async () => vi.advanceTimersByTime(1_100));
    expect(toasts()).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});

it("opens history through the game runner's selectors on the rendered sheet controls", () => {
  const Rail = () => {
    const [open, setOpen] = useState(false);
    return <EventsCard logOpen={open} onLogToggle={() => setOpen((value) => !value)} />;
  };
  act(() => root.render(<Rail />));
  const button = host.querySelector<HTMLButtonElement>(LOG_BUTTON)!;
  expect(button).not.toBeNull();
  expect(host.querySelector(HISTORY)).toBeNull();
  act(() => button.click());
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(host.querySelector(HISTORY)).not.toBeNull();
  act(() => button.click());
  expect(host.querySelector(HISTORY)).toBeNull();
});
