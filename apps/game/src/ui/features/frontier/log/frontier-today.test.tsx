import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";

const OWNER = 0x5eed0154n;
const NOW = 60;
const asked = vi.hoisted(() => ({ owners: [] as Array<string | undefined>, failed: false }));

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => NOW }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: new NativeFactStore() } }) }));
vi.mock("@/hooks/store/use-story-events-store", () => ({
  useStoryEvents: (_limit: number, _story: string | undefined, owner: string | undefined) => {
    asked.owners.push(owner);
    if (asked.failed) return { data: [], isPending: false, isSuccess: false, isError: true, refetch: vi.fn() };
    const theirs = owner !== undefined && BigInt(owner) === OWNER;
    return {
      data: theirs
        ? [
            {
              id: "reveal",
              event_id: "reveal",
              story: "ExplorationReward",
              owner: `0x${OWNER.toString(16)}`,
              timestampMs: 30_000,
              storyPayload: { resource_type: ResourcesIds.Essence, amount: String(1_200n * 1_000_000_000n) },
            },
          ]
        : [],
      isPending: false,
      isSuccess: true,
      isError: false,
      holdsSince: 0,
      refetch: vi.fn(),
    };
  },
}));

const { FrontierToday } = await import("./frontier-today");

const RULES = {
  dayUnitSeconds: 100,
  seed: 1n,
  startMainAt: 0,
  scheduledEndAt: 21 * 20 * 14_400,
  endAt: 21 * 20 * 14_400,
} as never;
const WATCHED = { game_id: 1, entity_id: 7, owner: OWNER } as never;

const inGame = (today: ReactNode) => <QueryClientProvider client={new QueryClient()}>{today}</QueryClientProvider>;

const draw = () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(inGame(<FrontierToday rules={RULES} realm={WATCHED} onClose={() => undefined} />)));
  const gains = () => [...host.querySelectorAll("[data-total]")].map((cell) => cell.getAttribute("aria-label"));
  return {
    host,
    gains,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
};

afterEach(() => {
  asked.failed = false;
});

it("shows a spectator what the watched realm's day earned, read from its owner's history", () => {
  const today = draw();
  expect(BigInt(asked.owners.at(-1)!)).toBe(OWNER);
  expect(today.gains()).toEqual(["Essence +1.2K", "Labor +0", "Glory —"]);
  expect(today.host.querySelector("[data-today-week]")).toBeNull();
  today.unmount();
});

it("leaves each gain unknown when the history read fails, never a zero", () => {
  asked.failed = true;
  const today = draw();
  expect(today.gains()).toEqual(["Essence —", "Labor —", "Glory —"]);
  today.unmount();
});
