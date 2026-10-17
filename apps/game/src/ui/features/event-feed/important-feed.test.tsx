import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { expect, it, vi } from "vitest";

// Browsers have AnimationEvent, so React hears a fade's end as "animationend"; jsdom lacks it, and React would listen for
// a prefixed name instead. Defined before react-dom loads, the test hears it as a browser does.
vi.hoisted(() => Object.assign(globalThis, { AnimationEvent: globalThis.Event }));

const PLAYER = "0x1";

/** The game's history as each story read serves it: by story, and by every player a story names. */
const history = vi.hoisted(
  () => [] as { id: string; story: string; owner: string; participants: string[]; at?: number; tx?: string }[],
);
/** The client's own sends, as the transaction store reports them. */
const sent = vi.hoisted(() => [] as unknown[]);

// Chain time is the real store's: anchored, ticked and corrected as the game's heads do. The stories are stamped at 100 s.
vi.mock("@/hooks/helpers/use-block-timestamp", async () => {
  const { useChainTimeStore } = await import("@/hooks/store/use-chain-time-store");
  return { useNowMs: () => useChainTimeStore((state) => state.nowMs) };
});
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (select: (state: unknown) => unknown) => select({ account: { address: PLAYER } }),
}));
vi.mock("@/hooks/store/use-story-events-store", () => ({
  useStoryEvents: (limit: number, story?: string, owner?: string) => ({
    data: history
      .filter((event) => !story || event.story === story)
      .filter((event) => !owner || event.participants.some((address) => BigInt(address) === BigInt(owner)))
      .slice(0, limit)
      .map((event) => ({
        ...event,
        event_id: event.id,
        tx_hash: event.tx ?? `0x${event.id}`,
        timestamp: "100",
        timestampMs: event.at ?? 100_000,
        storyPayload: {},
      })),
  }),
}));
vi.mock("./use-feed-rows", () => ({ useFeedRows: () => ({ inFlight: [], arrived: [], recent: sent }) }));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getTick: () => 60 } }));
vi.mock("./feed-row-line", () => ({
  FEED_ROW_CLASS: "",
  FeedRowLine: ({ row }: { row: { id: string } }) => <i>{row.id}</i>,
  HeadlineIcon: () => null,
}));

import { QuickFeedRows, useImportantFeed } from "./quick-feed";

const Rows = () => (
  <>
    {useImportantFeed()
      .rows.map((row) => row.id)
      .join(",")}
  </>
);

it("brings the player's opened crate into Events among every battle, without the routine stories", () => {
  history.push(
    { id: "battle", story: "BattleEvent", owner: "0x5", participants: ["0x5", "0x6"] },
    { id: "crate", story: "RelicChestOpened", owner: PLAYER, participants: [PLAYER] },
    { id: "made", story: "ProductionStory", owner: PLAYER, participants: [PLAYER] },
    { id: "theirs", story: "RelicChestOpened", owner: "0x2", participants: ["0x2"] },
  );
  expect(
    renderToStaticMarkup(<Rows />)
      .split(",")
      .toSorted(),
  ).toEqual(["story:battle", "story:crate"]);
});

/** The card's quick rows, mounted, over this history; returns what it draws and how to end a row's fade. */
const mountQuickFeed = (ids: string[]) => {
  history.length = 0;
  sent.length = 0;
  history.push(...ids.map((id) => ({ id, story: "BattleEvent", owner: "0x5", participants: ["0x5"] })));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<QuickFeedRows />));
  const drawn = () => [...host.querySelectorAll("i")].map((row) => row.textContent);
  const wrapper = (id: string) => [...host.querySelectorAll("i")].find((row) => row.textContent === id)!.parentElement!;
  /** What the browser does when a row's fade finishes. */
  const endFade = (id: string) =>
    act(() => {
      wrapper(id).dispatchEvent(new Event("animationend", { bubbles: true }));
    });
  const rerender = () => act(() => root.render(<QuickFeedRows />));
  const unmount = () => {
    act(() => root.unmount());
    host.remove();
  };
  return { drawn, wrapper, endFade, rerender, unmount };
};

it("keeps a drawn row through a chain clock correction, and takes it off the card when its fade ends", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const prior = useChainTimeStore.getState();
  useChainTimeStore.getState().anchor({ timestamp: 100_000 });
  const feed = mountQuickFeed(["battle"]);
  try {
    expect(feed.drawn()).toEqual(["story:battle"]);
    // Its 20 s are its own: a 3 s fade after 17 s on screen, started when drawn.
    expect(feed.wrapper("story:battle").style.animation).toBe("quickFeedFade 3000ms linear 17000ms forwards");
    // A delayed head corrects the clock back (the store's lead cap); the row neither leaves early nor outlives its fade.
    act(() => useChainTimeStore.getState().setHeartbeat({ timestamp: 104_000 }));
    act(() => useChainTimeStore.getState().anchor({ timestamp: 300_000 }));
    expect(feed.drawn()).toEqual(["story:battle"]);
    feed.endFade("story:battle");
    expect(feed.drawn()).toEqual([]);
  } finally {
    feed.unmount();
    useChainTimeStore.setState(prior);
  }
});

it("gives a row hidden behind the five newest its own full time once a slot frees for it", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const prior = useChainTimeStore.getState();
  useChainTimeStore.getState().anchor({ timestamp: 100_000 });
  const feed = mountQuickFeed(["r0", "r1", "r2", "r3", "r4", "r5"]);
  try {
    expect(feed.drawn()).toHaveLength(5);
    feed.endFade(feed.drawn()[0]!);
    const sixth = feed
      .drawn()
      .find((id) => !["story:r0", "story:r1", "story:r2", "story:r3", "story:r4"].includes(id!));
    expect(sixth).toBeDefined();
    expect(feed.wrapper(sixth!).style.animation).toBe("quickFeedFade 3000ms linear 17000ms forwards");
  } finally {
    feed.unmount();
    useChainTimeStore.setState(prior);
  }
});

it("never lets a newer row push a drawn one off or move it: the drawn rows keep their elements and their fades", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const prior = useChainTimeStore.getState();
  useChainTimeStore.getState().anchor({ timestamp: 100_000 });
  const feed = mountQuickFeed(["r0", "r1", "r2", "r3", "r4"]);
  try {
    const before = feed.drawn();
    const elements = before.map((id) => feed.wrapper(id!));
    // Another player's battle lands while five rows are drawn.
    history.push({ id: "newer", story: "BattleEvent", owner: "0x7", participants: ["0x7"], at: 101_000 });
    feed.rerender();
    expect(feed.drawn()).toEqual(before);
    expect(before.map((id) => feed.wrapper(id!))).toEqual(elements);
    // When one fade ends, the newcomer comes in on top with its own full time.
    feed.endFade(before[1]!);
    expect(feed.drawn()).toEqual(["story:newer", ...before.filter((id) => id !== before[1])]);
    expect(feed.wrapper("story:newer").style.animation).toBe("quickFeedFade 3000ms linear 17000ms forwards");
  } finally {
    feed.unmount();
    useChainTimeStore.setState(prior);
  }
});

it("keeps a send and the story that tells it as one row: the same element, its fade running on", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const prior = useChainTimeStore.getState();
  useChainTimeStore.getState().anchor({ timestamp: 100_000 });
  const feed = mountQuickFeed([]);
  try {
    sent.push({ kind: "transaction", id: "0x0abc", at: 100_000, transaction: { hash: "0x0abc", status: "success" } });
    feed.rerender();
    expect(feed.drawn()).toEqual(["0x0abc"]);
    const row = feed.wrapper("0x0abc");
    // The send's story arrives, its hash written without the leading zero: it takes the send's row.
    history.push({
      id: "fight",
      story: "BattleEvent",
      owner: PLAYER,
      participants: [PLAYER],
      at: 101_000,
      tx: "0xabc",
    });
    feed.rerender();
    expect(feed.drawn()).toEqual(["story:fight"]);
    expect(feed.wrapper("story:fight")).toBe(row);
  } finally {
    feed.unmount();
    useChainTimeStore.setState(prior);
  }
});
