// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";

// The day's banner on the lab's game, its quest read from native facts as the HUD reads them; only the network and
// the transaction's sending stand in.
const { LabGame } = await import("@/ui/features/debug/kit-lab/lab-game");
const { UnifiedHudLab } = await import("@/ui/features/debug/kit-lab/unified-hud-lab");
const { dayOf, readDailyQuest, readExpeditionRules } = await import("@bibliothecadao/eternum");
const { worldBane } = await import("../../../../../../../packages/core/src/utils/world-banes");
const { nativeQuestConstants: quests } =
  await import("../../../../../../../contracts/l3/world-native/schema/client.gen");
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
const opened: string[] = [];
/** What the home's daily claim has waiting; a test sets it before it draws. */
let claimWaiting: { labor: number; essence: number } | null = null;

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
              return (
                <FrontierDayBanner
                  realm={store.require("Structure", { game_id: 1, entity_id: 7 })}
                  claim={{ waiting: claimWaiting, onOpen: () => void opened.push("realms") }}
                />
              );
            }}
          </LabGame>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  return shown;
};

const banner = () => host.querySelector('[aria-label="Today\'s quest"]');
/** The quest's own action (not the claim chip, which is a button too). */
const collectButton = () =>
  [...banner()!.querySelectorAll("button")].find((each) => /Collect/.test(each.textContent ?? ""));
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

/** The lab's player's snapshot, complete or still loading, at the chain's clock. */
const snapshot = (store: NativeFactStore, complete: boolean) =>
  act(async () =>
    store.setSnapshot({
      gameId: 1,
      complete,
      actor: "0x111",
      timestamp: Math.floor(useChainTimeStore.getState().nowMs! / 1000),
    }),
  );
const finished = (day: number, target: number) => ({
  model: "QuestProgress",
  key: "0x9e2",
  value: { game_id: 1, home: 7, day, progress: BigInt(target), completed_level: 1 },
});
const receipt = (day: number) => ({
  model: "LaborGrant",
  key: "0x9e3",
  value: { game_id: 1, home: 7, day, account: 0x111n, amount: 1000n, essence: 1500n },
});
const campaignHome = { model: "CampaignHome", key: "0x9e4", value: { game_id: 1, home: 7n, campaign_id: 1n, tier: 1 } };

it("says it is reading while the snapshot loads, never zero progress, and offers no Collect before the receipt is known", async () => {
  const store = await renderBanner([questRules()]);
  const { day, target, id } = today(store);
  await snapshot(store, false);
  expect(banner()!.textContent).toContain(dailyQuests.find((quest) => quest.id === id)!.name);
  expect(banner()!.textContent).toContain("Reading your progress");
  expect(banner()!.textContent).not.toContain(`0 of ${target}`);

  // A collected quest recovering: its finished progress arrives before its receipt.
  await act(async () => store.applyFacts([finished(day, target)] as never));
  expect(button("Collect")).toBeUndefined();
  expect(banner()!.textContent).toContain("Reading your progress");

  await act(async () => store.applyFacts([receipt(day)] as never));
  await snapshot(store, true);
  expect(banner()!.querySelector("[aria-label='Collected']")).not.toBeNull();
  expect(button("Collect")).toBeUndefined();
});

it("shows a campaign home's 150% labor once its bonus is known, and nothing guessed before", async () => {
  const store = await renderBanner([questRules()]);
  const { day, target } = today(store);
  await snapshot(store, false);
  await act(async () => store.applyFacts([finished(day, target), campaignHome] as never));
  // The bonus is known (its row is here), the receipt is not: still reading, nothing to press.
  expect(banner()!.textContent).toContain("Reading your progress");
  expect(button("Collect")).toBeUndefined();

  await snapshot(store, true);
  expect(banner()!.textContent).toContain("1,500");
  expect(banner()!.textContent).not.toContain("1,000");
  // The quest's action is offered (an earlier test's send, held in flight on purpose, may still name it Collecting).
  expect(collectButton()).toBeDefined();
});

/** Season 1's race rules, as its preset writes them, and the lab realm's home in Harmony. */
const raceRules = () => {
  const { race } = frontierSeasonOnePreset;
  if (!race) throw new Error("Season 1's preset races no hyperstructures");
  const at = (index: number) => ({ alt: false, x: race.positions[index]![0]!, y: race.positions[index]![1]! });
  return [
    {
      model: "RaceRules",
      key: "0x9f1",
      value: {
        game_id: 1,
        season_days: BigInt(race.seasonDays),
        glory_per_tick: BigInt(race.gloryPerTick),
        height_per_tick: race.heightPerTick,
        stage_height: race.stageHeight,
        clear_mist_percent: race.clearMistPercent,
        second_wind_percent: race.secondWindPercent,
        pale_moon_percent: race.paleMoonPercent,
        spoils_percent: race.spoilsPercent,
        first: at(0),
        second: at(1),
        third: at(2),
        fourth: at(3),
      },
    },
    { model: "HomeAspect", key: "0x9f2", value: { game_id: 1, home: 7, aspect: 2 } },
  ];
};
const triumphOn = (stage: number, day: number) => ({
  model: "TriumphDay",
  key: `0x9f${stage + 2}`,
  value: { game_id: 1, aspect: 2, stage, day: BigInt(day) },
});

it("names the Aspect's Triumph today under the quest, and nothing on a day without one", async () => {
  const store = await renderBanner([questRules(), ...raceRules()]);
  const { day } = today(store);
  await snapshot(store, true);
  expect(banner()!.textContent).not.toContain("Second Wind");
  expect(banner()!.textContent).not.toContain("Reading your Aspect's day");

  await act(async () => store.applyFacts([triumphOn(2, day)] as never));
  expect(banner()!.textContent).toContain("Second Wind");
  expect(banner()!.textContent).toContain("Stamina refills 2 times as fast today");

  await act(async () => store.applyFacts([{ ...triumphOn(2, day), value: null }, triumphOn(3, day)] as never));
  expect(banner()!.textContent).toContain("Pale Moon");
  expect(banner()!.textContent).toContain("Beasts fight at 50% of their strength today");
});

it("says it is reading the Aspect's day while the snapshot cannot tell a Triumph, never none", async () => {
  const store = await renderBanner([questRules(), ...raceRules()]);
  await snapshot(store, false);
  expect(banner()!.textContent).toContain("Reading your Aspect's day");
});

/** Season 1's bane rules as its preset writes them, and the lab realm's home in Harmony. */
const baneRules = () => {
  const rules = frontierSeasonOnePreset.worldBanes;
  return [
    {
      model: "BaneRules",
      key: "0x9f8",
      value: {
        game_id: 1,
        chance_step: rules.chanceStep,
        quorum_percent: rules.quorumPercent,
        beast_percent: rules.beastPercent,
        stamina_percent: rules.staminaPercent,
        production_percent: rules.productionPercent,
        quest_counts: rules.questCounts.map(BigInt),
      },
    },
    { model: "HomeAspect", key: "0x9f2", value: { game_id: 1, home: 7, aspect: 2 } },
  ];
};
const baneProgress = (day: number, completed: number, endedAt: number) => ({
  model: "BaneProgress",
  key: "0x9f9",
  value: { game_id: 1, aspect: 2, day, completed, ended_at: endedAt },
});
const activeYesterday = (day: number, active: number) => ({
  model: "AspectActivity",
  key: "0x9fb",
  value: { game_id: 1, aspect: 2, day: day - 1, active },
});
/** The lab's chain clock moved into a later season day (the lab opens on day 0, which no bane ever falls on). */
const moveToDay = async (store: NativeFactStore, index: number) => {
  const rules = readExpeditionRules(store, 1)!;
  let at = rules.startMainAt;
  while (dayOf(rules, at)!.index < index) at = dayOf(rules, at)!.end;
  await act(async () => useChainTimeStore.getState().anchor({ timestamp: (at + 1) * 1000 }));
  await snapshot(store, true);
};

it("puts a rival's team bane's quest in place of the day's quest, with the bane and how far the Aspect is at ending it", async () => {
  const store = await renderBanner([questRules(), ...baneRules()]);
  const day = 2;
  await act(async () =>
    store.applyFacts([
      {
        model: "TeamBane",
        key: "0x9fa",
        value: { game_id: 1, aspect: 2, day, source: 3, issued_day: day - 1, quest: quests.STAND },
      },
      activeYesterday(day, 24),
      baneProgress(day, 4, 0),
    ] as never),
  );
  await moveToDay(store, day);
  expect(banner()!.textContent).toContain("The Stand");
  expect(banner()!.textContent).toContain("0 of 3 guarded sites");
  expect(banner()!.textContent).toContain("Team bane, from Chaos");
  expect(banner()!.textContent).toContain("Bane of Chaos");
  expect(banner()!.textContent).toContain("Your hyperstructure does not grow");
  // The sender's four Order crests stand beside the name.
  expect(banner()!.querySelectorAll("[data-tip] img, .border-b img").length).toBeGreaterThanOrEqual(5);
  // 25% of the 24 Harmony homes out the day before end it: 4 of 6.
  expect(banner()!.textContent).toContain("4 of 6 members");
});

it("offers Collect again once the Aspect ends a world bane, for the reward a second time", async () => {
  const store = await renderBanner([questRules(), ...baneRules()]);
  const seed = BigInt(store.require("GameRegistry", { game_id: 1 }).seed);
  const step = frontierSeasonOnePreset.worldBanes.chanceStep;
  // The first day the preset's roll brings the mist over this lab game.
  const day = Array.from({ length: 49 }, (_, index) => index + 1).find((d) => worldBane(seed, d, null, step) !== null)!;
  await act(async () =>
    store.applyFacts([
      {
        model: "QuestProgress",
        key: "0x9e2",
        value: { game_id: 1, home: 7, day, progress: 1_000_000_000_000n, completed_level: 1 },
      },
      receipt(day),
      activeYesterday(day, 4),
      baneProgress(day, 0, 0),
    ] as never),
  );
  await moveToDay(store, day);
  expect(banner()!.querySelector("[aria-label='Collected']")).not.toBeNull();
  expect(banner()!.textContent).toContain("0 of 1 members");
  await act(async () => store.applyFacts([baneProgress(day, 1, 1)] as never));
  expect(banner()!.textContent).toContain("World bane");
  expect(banner()!.textContent).toMatch(/Beasts \+50%|Stamina regenerates at 50%|Production at 50%/);
  expect(banner()!.textContent).toContain("Ended: the quest pays twice");
  // The quest's action is offered again (an earlier test's send, held in flight on purpose, may still name it Collecting).
  expect(["Collect again", "Collecting"]).toContain(collectButton()?.textContent);
  await act(async () =>
    store.applyFacts([
      {
        model: "BaneGrant",
        key: "0x9fc",
        value: { game_id: 1, home: 7, day, account: 0x111n, amount: 1000n, essence: 1500n },
      },
    ] as never),
  );
  expect(collectButton()).toBeUndefined();
  expect(banner()!.querySelector("[aria-label='Collected']")).not.toBeNull();
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
  return { day: quest.day, id: quest.quest!.id, target: Number(quest.reading.known!.target) };
}

it("says Spoils doubles a cleared site's numeric rewards and leaves a ruin's relic alone", async () => {
  const store = await renderBanner([questRules(), ...raceRules()]);
  const { day } = today(store);
  await snapshot(store, true);
  await act(async () => store.applyFacts([triumphOn(4, day)] as never));
  expect(banner()!.textContent).toContain("Spoils");
  expect(banner()!.textContent).toContain(
    "A cleared site pays 2 times the wheat, labor, Essence and XP today. A ruin's relic stays the same",
  );
});

it("holds the home's daily claim in its foot, opening Realms, and names no LORDS, credit or pass", async () => {
  claimWaiting = { labor: 1_000, essence: 0 };
  opened.length = 0;
  await renderBanner([questRules()]);
  const chip = [...banner()!.querySelectorAll("button")].find((each) => each.textContent?.includes("1K"));
  expect(chip).toBeDefined();
  await act(async () => chip!.click());
  expect(opened).toEqual(["realms"]);
  expect(banner()!.textContent).not.toMatch(/LORDS|credit|pass/i);
  claimWaiting = null;
});

describe("on a phone", () => {
  const phone = () =>
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
  /** Harmony on day 2 under Chaos's team bane, on its Second Wind day: the busiest the panel gets. */
  const busiestDay = async () => {
    phone();
    const store = await renderBanner([questRules(), ...baneRules(), ...raceRules()]);
    await act(async () =>
      store.applyFacts([
        {
          model: "TeamBane",
          key: "0x9fa",
          value: { game_id: 1, aspect: 2, day: 2, source: 3, issued_day: 1, quest: quests.STAND },
        },
        activeYesterday(2, 24),
        baneProgress(2, 4, 0),
        triumphOn(2, 2),
      ] as never),
    );
    await moveToDay(store, 2);
    return store;
  };

  it("keeps the quest on one row and the day's news as chips, each opening its line on a press", async () => {
    await busiestDay();
    expect(banner()!.textContent).toContain("The Stand");
    expect(banner()!.textContent).toContain("4 of 6");
    // The panel is the quest, one foot row and one row of chips: no head blocks and no meter for the members.
    expect(banner()!.querySelectorAll("[role='meter']").length).toBe(1);
    const chips = [...banner()!.querySelectorAll("button")].filter((each) =>
      ["Bane of Chaos", "Second Wind"].some((name) => each.textContent?.includes(name)),
    );
    expect(chips.map((chip) => chip.textContent)).toEqual(["Bane of Chaos", "Second Wind"]);
    expect(banner()!.textContent).not.toContain("Your hyperstructure does not grow");
    await act(async () => chips[0]!.click());
    expect(banner()!.textContent).toContain("Your hyperstructure does not grow");
    await act(async () => chips[0]!.click());
    expect(banner()!.textContent).not.toContain("Your hyperstructure does not grow");
    await act(async () => chips[1]!.click());
    expect(banner()!.textContent).toContain("Stamina refills 2 times as fast today");
  });
});
