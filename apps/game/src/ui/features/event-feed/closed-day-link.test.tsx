// @vitest-environment jsdom
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { disposeGameSyncSession, installActiveGameClient } from "@/sync/active-game-client";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";

const game = vi.hoisted(() => ({ store: null as unknown }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: game.store } }) }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));

const { FeedRowLine } = await import("./feed-row-line");

/** The fixture's season: day 0 runs over chain seconds [100, 400), day 1 from 400. */
const DAY_0 = 350;
const DAY_1 = 450;
const MAP = "/g/0xa1/1/map";

/** A fight at chain second `at` on a site of that day's map. */
const fightAt = (at: number) =>
  ({
    id: `fight-${at}`,
    event_id: `fight-${at}`,
    story: "BattleEvent",
    owner: "0x2",
    participants: ["0x2"],
    entity_id: 0,
    timestamp: String(at),
    timestampMs: at * 1000,
    storyPayload: { coord: { x: 55, y: at < 400 ? 50 : 450 } },
    presentation: { title: "A fight · Guard holds", description: "" },
  }) as unknown as ProcessedStoryEvent;

let unmount: () => void = () => {};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { store } = frontierDay();
  game.store = store;
  installActiveGameClient({ setup: { store }, connect() {}, disconnect() {}, dispose() {}, visit() {} } as never);
  window.history.replaceState({}, "", MAP);
  useUIStore.getState().selectOnMap(null);
});
afterEach(() => {
  unmount();
  disposeGameSyncSession();
  setBlockTimestampSource(null);
});

/** The Feed's row for the story, as a player sees it: a button only when it opens a place. */
const drawRow = async (event: ProcessedStoryEvent) => {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<FeedRowLine event={event} />));
  unmount = () => act(() => root.unmount());
  return { button: () => host.querySelector("button") };
};

describe("a Frontier story in the Feed, once its day has closed", () => {
  it("opens today's story on its tile", async () => {
    setBlockTimestampSource(() => DAY_1);
    const row = await drawRow(fightAt(420));

    await act(async () => row.button()!.click());

    expect(window.location.pathname).toBe(MAP);
    expect(new URLSearchParams(window.location.search).has("col")).toBe(true);
    expect(useUIStore.getState().selectedHex).toEqual({ col: 55, row: 450 });
  });

  it("is no link for yesterday's story: its place is not on today's map", async () => {
    setBlockTimestampSource(() => DAY_1);
    const row = await drawRow(fightAt(DAY_0));

    expect(row.button()).toBeNull();
  });

  it("goes nowhere when the day closes under a row drawn while it was today", async () => {
    setBlockTimestampSource(() => DAY_0);
    const row = await drawRow(fightAt(DAY_0));
    setBlockTimestampSource(() => DAY_1);

    await act(async () => row.button()!.click());

    expect(window.location.search).toBe("");
    expect(useUIStore.getState().selectedHex).toBeNull();
  });
});
