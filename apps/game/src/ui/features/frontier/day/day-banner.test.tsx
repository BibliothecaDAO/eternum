// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

// The day's banner on the lab's game, its quest read from native facts as the HUD reads them; only the network and
// the transaction's sending stand in.
const { LabGame } = await import("@/ui/features/debug/kit-lab/lab-game");
const { UnifiedHudLab } = await import("@/ui/features/debug/kit-lab/unified-hud-lab");
const { readDailyQuest } = await import("@bibliothecadao/eternum");
const { useChainTimeStore } = await import("@/hooks/store/use-chain-time-store");
const { dailyQuests } = await import("@bibliothecadao/types");
const { frontierSeasonOnePreset } = await import("../../../../../../../config/source/frontier/season-one");
const { FrontierDayBanner } = await import("./day-banner");

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 404 })),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

/** Season 1's quest rules, as its preset writes them. */
const questRules = () => {
  const { baseCounts, labor, essence, bonusPercent } = frontierSeasonOnePreset.dailyQuest;
  return {
    model: "QuestRules",
    key: "0x9e1",
    value: {
      game_id: 1,
      base_counts: baseCounts,
      labor: BigInt(labor),
      essence: BigInt(essence),
      bonus_percent: bonusPercent,
    },
  };
};

const claims: { home: number; day: number }[] = [];

/** The lab realm's banner; `facts` the game holds before it draws. */
const renderBanner = async (facts: unknown[]) => {
  let shown!: NativeFactStore;
  await act(async () =>
    root.render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient()}>
          <LabGame
            preset={5}
            facts={() => facts}
            systemCalls={() => ({
              // The send stays in flight: the banner's own state while it travels is what is read.
              claim_daily_quest: (call: { home: number; day: number }) => {
                claims.push({ home: call.home, day: call.day });
                return new Promise(() => {});
              },
            })}
          >
            {(store) => {
              shown = store;
              return <FrontierDayBanner realm={store.require("Structure", { game_id: 1, entity_id: 7 })} />;
            }}
          </LabGame>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  return shown;
};

const banner = () => host.querySelector('[aria-label="Today\'s quest"]');
const button = (word: string) => [...host.querySelectorAll("button")].find((each) => each.textContent === word);

it("draws nothing in a game without quests", async () => {
  await renderBanner([]);
  expect(banner()).toBeNull();
});

it("names today's quest, how far the realm is and what it pays, with nothing to collect yet", async () => {
  const store = await renderBanner([questRules()]);
  const quest = dailyQuests.find(({ id }) => id === today(store).id)!;
  // A Settlement (level 1): the base count, 1,000 labor and 1,500 Essence.
  expect(banner()!.textContent).toContain(quest.name);
  expect(banner()!.textContent).toContain(`0 of ${quest.baseCount} `);
  expect(banner()!.textContent).toContain("1,000");
  expect(banner()!.textContent).toContain("1,500");
  expect(button("Collect")).toBeUndefined();
});

it("collects a finished quest once, then says it was collected", async () => {
  const store = await renderBanner([questRules()]);
  const { day, target } = today(store);
  await act(async () =>
    store.applyFacts([
      {
        model: "QuestProgress",
        key: "0x9e2",
        value: { game_id: 1, home: 7, day, progress: BigInt(target), completed_level: 1 },
      },
    ] as never),
  );
  expect(banner()!.textContent).toContain(`${target} of ${target} `);
  await act(async () => button("Collect")!.click());
  await act(async () => button("Collecting")?.click());
  expect(claims).toEqual([{ home: 7, day }]);

  await act(async () =>
    store.applyFacts([
      {
        model: "LaborGrant",
        key: "0x9e3",
        value: { game_id: 1, home: 7, day, account: 7n, amount: 1000n, essence: 1500n },
      },
    ] as never),
  );
  expect(banner()!.querySelector("[aria-label='Collected']")).not.toBeNull();
  expect(button("Collect")).toBeUndefined();
});

it("stands in the realm's column of a new player's HUD (/lab/kit/unified/frontier-new)", async () => {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/unified/frontier-new"]}>
        <QueryClientProvider client={new QueryClient()}>
          <Routes>
            <Route path="unified/:view?" element={<UnifiedHudLab />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  expect(host.querySelector('[data-hud-column] [aria-label="Today\'s quest"]')).not.toBeNull();
});

/** Today's quest on the lab's calendar, read as the banner reads it: the core reader at the chain's clock. */
function today(store: NativeFactStore) {
  const now = Math.floor(useChainTimeStore.getState().nowMs! / 1000);
  const quest = readDailyQuest(store, 1, 7, now)!;
  return { day: quest.day, id: quest.id, target: Number(quest.target) };
}
