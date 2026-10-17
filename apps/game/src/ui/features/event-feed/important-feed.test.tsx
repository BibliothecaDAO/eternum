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
  () =>
    [] as {
      id: string;
      story: string;
      owner: string;
      participants: string[];
      at?: number;
      tx?: string;
      /** Its place in its transaction's receipt. */
      index?: number;
      payload?: Record<string, unknown>;
    }[],
);
/** The client's own sends, as the transaction store reports them. */
const sent = vi.hoisted(() => [] as unknown[]);
/** The player's filter for Events: All unless a test chooses another. */
const filter = vi.hoisted(() => ({ value: "all" as "important" | "mine" | "all" }));

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
        // A story names its subject: a captured structure's id, here one for every story.
        entity_id: 900,
        tx_hash: event.tx ?? `0x${event.id}`,
        timestamp: "100",
        timestampMs: event.at ?? 100_000,
        position: { block: 1, transactionIndex: 0, eventIndex: event.index ?? 0 },
        storyPayload: event.payload ?? {},
      })),
  }),
}));
vi.mock("./use-feed-rows", () => ({ useFeedRows: () => ({ inFlight: [], recent: sent }) }));
vi.mock("@/hooks/store/use-events-filter-store", () => ({ useEventsFilter: () => [filter.value, () => undefined] }));
vi.mock("@bibliothecadao/eternum", () => ({
  configManager: { getTick: () => 60 },
  // What a capture's headline reads, as the game's own words have it.
  CAPTURE_AFTERMATH: "Its armies and incoming deliveries went with it",
  isViewerOwner: (owner: bigint, viewer: bigint | null) => viewer !== null && owner === viewer,
}));
vi.mock("./feed-row-line", () => ({
  FEED_ROW_CLASS: "",
  FeedRowLine: ({ row }: { row: { id: string } }) => <i>{row.id}</i>,
  HeadlineIcon: () => null,
}));

import { deriveFeedRows } from "./event-feed-rows";
import { TransactionType } from "@bibliothecadao/provider";
import type { Transaction } from "@/hooks/store/use-transaction-store";
import { QuickFeedRows, useImportantFeed, useStripRows } from "./quick-feed";
import { useHeadlineFeedStore } from "../news-headlines/headline-feed-store";
import { buildCaptureHeadline } from "../news-headlines/capture-headline";
import type { FeedNotice } from "./event-feed-store";

/** The Events card's strip, as the card draws it. */
const Strip = () => <QuickFeedRows shown={useStripRows()} />;

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

/** The card's strip rows, mounted, over this history (newest first); returns what it draws and each row's element. */
const mountQuickFeed = (ids: string[]) => {
  history.length = 0;
  sent.length = 0;
  history.push(
    ...ids.map((id, index) => ({ id, story: "BattleEvent", owner: "0x5", participants: ["0x5"], at: 100_000 - index })),
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<Strip />));
  const drawn = () => [...host.querySelectorAll("i")].map((row) => row.textContent);
  const wrapper = (id: string) => [...host.querySelectorAll("i")].find((row) => row.textContent === id)!;
  const rerender = () => act(() => root.render(<Strip />));
  const unmount = () => {
    act(() => root.unmount());
    host.remove();
  };
  return { drawn, wrapper, rerender, unmount };
};

it("keeps the newest three rows with no fade: they stay however long the clock runs on", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const prior = useChainTimeStore.getState();
  useChainTimeStore.getState().anchor({ timestamp: 100_000 });
  const feed = mountQuickFeed(["r0", "r1", "r2", "r3", "r4"]);
  try {
    expect(feed.drawn()).toEqual(["story:r0", "story:r1", "story:r2"]);
    act(() => useChainTimeStore.getState().anchor({ timestamp: 3_600_000 }));
    feed.rerender();
    expect(feed.drawn()).toEqual(["story:r0", "story:r1", "story:r2"]);
  } finally {
    feed.unmount();
    useChainTimeStore.setState(prior);
  }
});

it("puts a newer row on top and lets the oldest go; the other two keep their elements", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const feed = mountQuickFeed(["r0", "r1", "r2"]);
  try {
    const kept = ["story:r0", "story:r1"].map((id) => feed.wrapper(id));
    history.push({ id: "newer", story: "BattleEvent", owner: "0x7", participants: ["0x7"], at: 101_000 });
    feed.rerender();
    expect(feed.drawn()).toEqual(["story:newer", "story:r0", "story:r1"]);
    expect(["story:r0", "story:r1"].map((id) => feed.wrapper(id))).toEqual(kept);
  } finally {
    feed.unmount();
  }
});

it("draws under Important the player's fight and not another player's", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  filter.value = "important";
  const feed = mountQuickFeed([]);
  try {
    history.push(
      {
        id: "mine",
        story: "BattleEvent",
        owner: PLAYER,
        participants: [PLAYER],
        at: 101_000,
        payload: { attacker: { player: PLAYER }, defender: { player: "0x5" } },
      },
      {
        id: "theirs",
        story: "BattleEvent",
        owner: "0x5",
        participants: ["0x5"],
        at: 102_000,
        payload: { attacker: { player: "0x5" }, defender: { player: "0x6" } },
      },
    );
    feed.rerender();
    expect(feed.drawn()).toEqual(["story:mine"]);
  } finally {
    filter.value = "all";
    feed.unmount();
  }
});

it("keeps a send and the story that tells it as one row, in the same element", () => {
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

it('tells a done build by the story it wrote, a routine one the Events level leaves out, not by "· Done"', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const prior = useChainTimeStore.getState();
  useChainTimeStore.getState().anchor({ timestamp: 100_000 });
  const feed = mountQuickFeed([]);
  try {
    sent.push({ kind: "transaction", id: "0x0b1d", at: 100_000, transaction: { hash: "0x0b1d", status: "success" } });
    history.push({ id: "farm", story: "BuildingPaymentStory", owner: PLAYER, participants: [PLAYER], tx: "0xb1d" });
    feed.rerender();
    expect(feed.drawn()).toEqual(["story:farm"]);
  } finally {
    feed.unmount();
    useChainTimeStore.setState(prior);
  }
});

// Review regressions: the bound holds the player's news, and an action keeps one row and one life across its sources.
const withFeed = (ids: string[], run: (feed: ReturnType<typeof mountQuickFeed>) => void) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const prior = useChainTimeStore.getState();
  useChainTimeStore.getState().anchor({ timestamp: 100_000 });
  const feed = mountQuickFeed(ids);
  try {
    run(feed);
  } finally {
    feed.unmount();
    useChainTimeStore.setState(prior);
  }
};

it("draws the player's newest battle even when three other battles fill the strip", () => {
  withFeed(["r0", "r1", "r2"], (feed) => {
    history.push({ id: "attacked", story: "BattleEvent", owner: PLAYER, participants: [PLAYER], at: 101_000 });
    feed.rerender();
    expect(feed.drawn()).toHaveLength(3);
    expect(feed.drawn()[0]).toBe("story:attacked");
  });
});

const original = {
  hash: "0x0abc",
  status: "success",
  type: TransactionType.ATTACK_EXPLORER_VS_GUARD,
  submittedAt: 100_000,
  confirmedAt: 100_000,
} as Transaction;
const setTransactions = (transactions: Transaction[]) => {
  const rows = deriveFeedRows({ transactions, notices: [] });
  sent.splice(0, sent.length, ...rows.recent);
};
const pruneOriginal = () =>
  setTransactions([
    original,
    ...Array.from({ length: 15 }, (_, i) => ({
      ...original,
      hash: `0x${(4096 + i).toString(16)}`,
      type: TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION,
      submittedAt: 102_000 + i,
      confirmedAt: 102_000 + i,
    })),
  ]);
const addStory = () =>
  history.push({ id: "fight", story: "BattleEvent", owner: PLAYER, participants: [PLAYER], at: 101_000, tx: "0xabc" });

it("retains the same story element when its send leaves the real 15-row recent list", () => {
  withFeed([], (feed) => {
    setTransactions([original]);
    feed.rerender();
    const element = feed.wrapper("0x0abc");
    addStory();
    feed.rerender();
    expect(feed.wrapper("story:fight")).toBe(element);
    pruneOriginal();
    feed.rerender();
    expect(feed.drawn()).toEqual(["story:fight"]);
    expect(feed.wrapper("story:fight")).toBe(element);
  });
});

it("tells a delivery's landing in one row: its unloading, then the story that unloading wrote, in the same element", () => {
  withFeed([], (feed) => {
    setTransactions([{ ...original, hash: "0x0off", type: TransactionType.ARRIVALS_OFFLOAD }]);
    feed.rerender();
    const element = feed.wrapper("0x0off");
    history.push({
      id: "landed",
      story: "ResourceReceiveArrivalStory",
      owner: PLAYER,
      participants: [PLAYER],
      at: 101_000,
      tx: "0xoff",
    });
    feed.rerender();
    expect(feed.drawn()).toEqual(["story:landed"]);
    expect(feed.wrapper("story:landed")).toBe(element);
  });
});

/**
 * One transaction that took a structure, as the contract writes it (combat.cairo): the capture first, inside
 * `try_capture`, then the battle. Either an army beat the structure's last guard (it attacked), or the structure's
 * guard attacked an army beside it and fell (the army defended).
 */
const capture = (path: "army-attacked" | "guard-fell", captor: string, holder: string) => {
  const claim = { owner: captor, participants: [captor, holder], at: 101_000, tx: "0xc1a" };
  const [attacker, defender] = path === "army-attacked" ? [captor, holder] : [holder, captor];
  return {
    taken: {
      ...claim,
      id: "taken",
      story: "StructureCapturedStory",
      index: 1,
      payload: { previous_owner: holder, new_owner: captor },
    },
    fight: {
      ...claim,
      id: "fight",
      story: "BattleEvent",
      index: 2,
      payload: { attacker: { player: attacker }, defender: { player: defender } },
    },
  };
};

it.each([
  ["army-attacked", "who lost it", "0xc1", PLAYER],
  ["army-attacked", "who took it", PLAYER, "0xa1"],
  ["guard-fell", "who lost it", "0xc1", PLAYER],
  ["guard-fell", "who took it", PLAYER, "0xa1"],
] as const)("tells a capture (%s) in one row, by its capture, to the player %s", (path, _side, captor, holder) => {
  withFeed([], (feed) => {
    const { taken, fight } = capture(path, captor, holder);
    history.push(fight, taken);
    feed.rerender();
    expect(feed.drawn()).toEqual(["story:taken"]);
  });
});

it.each([
  ["the battle, then its capture", ["fight", "taken"]],
  ["the capture, then its battle", ["taken", "fight"]],
] as const)("keeps one row, in the same element, when %s arrive in turn", (_order, arrivals) => {
  withFeed([], (feed) => {
    const stories = capture("army-attacked", "0xc1", PLAYER);
    history.push(stories[arrivals[0]]);
    feed.rerender();
    const element = feed.wrapper(`story:${arrivals[0]}`);
    history.push(stories[arrivals[1]]);
    feed.rerender();
    expect(feed.drawn()).toEqual(["story:taken"]);
    expect(feed.wrapper("story:taken")).toBe(element);
  });
});

it("review: tells the capture with actual Cairo event order, capture before battle", () => {
  withFeed([], (feed) => {
    const claim = { owner: "0xc1", participants: ["0xc1", PLAYER], at: 101_000, tx: "0xc1a" };
    history.push({ ...claim, id: "fight", story: "BattleEvent", index: 2 });
    history.push({
      ...claim,
      id: "taken",
      story: "StructureCapturedStory",
      index: 1,
      payload: { previous_owner: PLAYER, new_owner: "0xc1" },
    });
    feed.rerender();
    expect(feed.drawn()).toEqual(["story:taken"]);
  });
});

/** This session's sends and notices, as the stores hold them and the real feed derives its (bounded) rows. */
const setFeed = (transactions: Transaction[], notices: FeedNotice[] = []) => {
  const rows = deriveFeedRows({ transactions, notices });
  sent.splice(0, sent.length, ...rows.recent);
};
/** Fifteen routine production orders, settled after `from`: what Important leaves out, and what fills the bounded list. */
const routine = (from: number) =>
  Array.from({ length: 15 }, (_, i) => ({
    ...original,
    hash: `0x${(4096 + i).toString(16)}`,
    type: TransactionType.BURN_RESOURCE_FOR_RESOURCE_PRODUCTION,
    submittedAt: from + i,
    confirmedAt: from + i,
  }));
const underImportant = (run: () => void) => {
  filter.value = "important";
  try {
    run();
  } finally {
    filter.value = "all";
  }
};

it("keeps a refused order, an unanswered one and a warning through traffic Important leaves out, until newer important ones replace them", () => {
  underImportant(() =>
    withFeed([], (feed) => {
      const refused = { ...original, status: "reverted" as const };
      const unanswered = {
        ...original,
        hash: "0x0bad",
        status: "no_answer" as const,
        submittedAt: 100_500,
        confirmedAt: 100_500,
      };
      const warning: FeedNotice = { id: "warn", kind: "warning", title: "Storage is full", at: 100_800 } as FeedNotice;
      setFeed([refused, unanswered], [warning]);
      feed.rerender();
      expect(feed.drawn()).toEqual(["warn", "0x0bad", "0x0abc"]);
      // Fifteen routine orders push all three out of the bounded recent list: the strip keeps them.
      setFeed(routine(102_000));
      feed.rerender();
      expect(feed.drawn()).toEqual(["warn", "0x0bad", "0x0abc"]);
      // Newer important events replace them, newest first.
      history.push(
        {
          id: "f1",
          story: "BattleEvent",
          owner: PLAYER,
          participants: [PLAYER],
          at: 200_000,
          payload: { attacker: { player: PLAYER }, defender: { player: "0x5" } },
        },
        {
          id: "f2",
          story: "BattleEvent",
          owner: PLAYER,
          participants: [PLAYER],
          at: 201_000,
          payload: { attacker: { player: PLAYER }, defender: { player: "0x5" } },
        },
      );
      feed.rerender();
      expect(feed.drawn()).toEqual(["story:f2", "story:f1", "warn"]);
    }),
  );
});

/** A headline published for the strip, and the headlines put back as they were after. */
const withHeadlines = (
  run: (
    publish: (headline: Parameters<ReturnType<typeof useHeadlineFeedStore.getState>["publish"]>[0]) => void,
  ) => void,
) => {
  const previous = useHeadlineFeedStore.getState().headlines;
  try {
    run((headline) => act(() => useHeadlineFeedStore.getState().publish(headline)));
  } finally {
    act(() => useHeadlineFeedStore.setState({ headlines: previous }));
  }
};

it("counts a milestone among the strip's three rows, in its own tick and after it", () => {
  withHeadlines((publish) =>
    withFeed(["r0", "r1", "r2"], (feed) => {
      useChainTimeStore.getState().anchor({ timestamp: 101_000 });
      publish({
        id: "end",
        type: "game-end",
        title: "Game ended",
        description: "Game ended",
        timestamp: 101_000,
        icon: "game-end",
      });
      feed.rerender();
      expect(feed.drawn()).toEqual(["end", "story:r0", "story:r1"]);
      act(() => useChainTimeStore.getState().anchor({ timestamp: 500_000 }));
      feed.rerender();
      expect(feed.drawn()).toEqual(["end", "story:r0", "story:r1"]);
    }),
  );
});

it.each([
  ["the story, then its headline", "story-first"],
  ["the headline, then its story", "headline-first"],
] as const)("tells a capture once, by its story, when %s arrive", (_order, order) => {
  const headline = buildCaptureHeadline({
    structureId: 900,
    isHyperstructure: false,
    structureName: "Stolsli",
    previousOwner: 0xa1n,
    newOwner: BigInt(PLAYER),
    site: null,
    viewer: BigInt(PLAYER),
    nameOf: () => "clientlane",
    at: 101_000,
  });
  const { taken, fight } = capture("army-attacked", PLAYER, "0xa1");
  underImportant(() =>
    withHeadlines((publish) =>
      withFeed([], (feed) => {
        if (order === "story-first") history.push(taken, fight);
        else publish(headline);
        feed.rerender();
        if (order === "story-first") publish(headline);
        else history.push(taken, fight);
        feed.rerender();
        expect(feed.drawn()).toEqual(["story:taken"]);
      }),
    ),
  );
});
