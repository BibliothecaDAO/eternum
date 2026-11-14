import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameProvider } from "@/hooks/context/game-context";
import { chainOf } from "@/lab/game/lab-chain";
import { questScenario } from "@/lab/game/quest-scenario";
import { dayOf } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, aspects } from "@bibliothecadao/types";
import { nativeBaneConstants, nativeQuestConstants } from "@bibliothecadao/eternum/game-client";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { DailyQuest } from "./daily-quest";

const clock = vi.hoisted(() => ({ now: 350 }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => clock.now }));
vi.mock("@/sync/action-outcome", () => ({
  untilApplied: async (sent: Promise<{ transaction_hash: string }>) => (await sent).transaction_hash,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let host: HTMLDivElement;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  clock.now = 350;
});

function fixture(layout: "desktop" | "phone") {
  const scenario = questScenario();
  const store = chainOf(scenario);
  let finish!: (value: { transaction_hash: string }) => void;
  const submit = vi.fn(
    () =>
      new Promise<{ transaction_hash: string }>((resolve) => {
        finish = resolve;
      }),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const draw = () =>
    act(() =>
      root!.render(
        <GameProvider
          value={{ store, systemCalls: { claim_daily_quest: submit } } as unknown as GameClientSetup}
          account={{ address: scenario.player, account: { address: scenario.player } } as never}
        >
          <DailyQuest realm={store.require("Structure", { game_id: 1, entity_id: 7 })} layout={layout} />
        </GameProvider>,
      ),
    );
  return { store, draw, submit, finish: () => finish({ transaction_hash: "0x123" }), scenario };
}

const collect = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Collect");

describe.each(["desktop", "phone"] as const)("daily quest on %s", (layout) => {
  it("submits once, keeps Collect busy, and renders only the received grant as collected", async () => {
    const game = fixture(layout);
    game.draw();
    expect(collect()?.disabled).toBe(false);
    await act(async () => {
      collect()!.click();
    });
    expect(game.submit).toHaveBeenCalledTimes(1);
    expect(game.submit).toHaveBeenCalledWith(expect.objectContaining({ home: 7, day: 0 }));
    expect(host.textContent).toContain("Collecting…");
    expect(host.querySelector('[aria-label="Collected"]')).toBeNull();
    await act(async () => {
      game.store.applyFacts(
        game.scenario.answer(
          { kind: "ClaimDailyQuest", fields: { home: "7", day: "0" }, calldata: [] },
          game.store,
          350,
        ) as never,
      );
      game.finish();
    });
    expect(host.querySelector('[aria-label="Collected"]')).not.toBeNull();
    expect(collect()).toBeUndefined();
    expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it("offers no Collect until a complete snapshot establishes the missing receipt and bonus", () => {
    const game = fixture(layout);
    game.store.setSnapshot({ gameId: 1, actor: game.scenario.player, complete: false, timestamp: 350 });
    game.draw();
    expect(host.textContent).toContain("Reading today's quest");
    expect(collect()).toBeUndefined();
    act(() => game.store.setSnapshot({ gameId: 1, actor: game.scenario.player, complete: true, timestamp: 350 }));
    expect(collect()?.disabled).toBe(false);
  });
});

function worldDay(layout: "desktop" | "phone") {
  const fixtureGame = fixture(layout);
  const { store } = fixtureGame;
  const registry = store.require("GameRegistry", { game_id: 1 });
  const rules = store.require("SliceRules", { game_id: 1 });
  const calendar = {
    seed: registry.seed,
    startMainAt: Number(registry.start_main_at),
    endAt: Number(registry.end_at),
    dayUnitSeconds: rules.day_unit_seconds,
  };
  const start = dayOf(calendar, calendar.startMainAt)!.end;
  clock.now = start + 20;
  store.applyFacts([
    { model: "HomeAspect", key: "membership", value: { game_id: 1, home: 7, aspect: 2 } },
    { model: "AspectActivity", key: "activity", value: { game_id: 1, aspect: 2, day: 0, active: 5 } },
    {
      model: "BaneRules",
      key: "banes",
      value: {
        game_id: 1,
        chance_step: 20,
        quorum_percent: 40,
        beast_percent: 150,
        stamina_percent: 50,
        production_percent: 50,
        quest_counts: [3, 6, 9, 12, 20, 40, 60, 80, 2500, 6000, 10_000, 15_000],
      },
    },
    { model: "WorldBane", key: "world-day", value: { game_id: 1, day: 1, kind: nativeBaneConstants.ASH_FALL } },
    {
      model: "QuestProgress",
      key: "quest-day",
      value: { game_id: 1, home: 7, day: 1, progress: 2500, completed_level: 1 },
    },
  ]);
  store.setSnapshot({ gameId: 1, complete: true, actor: fixtureGame.scenario.player, timestamp: clock.now });
  const grant = (model: "LaborGrant" | "BaneGrant", labor = 1000, essence = 1500) => ({
    model,
    key: `receipt-${model}`,
    value: {
      game_id: 1,
      home: 7,
      day: 1,
      account: fixtureGame.scenario.player,
      amount: BigInt(labor) * BigInt(RESOURCE_PRECISION),
      essence: BigInt(essence) * BigInt(RESOURCE_PRECISION),
    },
  });
  const win = () =>
    store.applyFacts([
      {
        model: "BaneProgress",
        key: "quorum-day",
        value: { game_id: 1, aspect: 2, day: 1, completed: 2, ended_at: start + 10 },
      },
    ]);
  return { ...fixtureGame, grant, win };
}
const collectAgain = () =>
  [...host.querySelectorAll("button")].find((button) => button.textContent === "Collect again");
const reward = (name: string) => host.querySelector(`[data-reward="${name}"]`)?.textContent?.trim();

describe.each(["desktop", "phone"] as const)("bane collection on %s", (layout) => {
  it("collects the second world reward once after quorum and renders the actual clipped receipt", async () => {
    const game = worldDay(layout);
    game.store.applyFacts([game.grant("LaborGrant")]);
    game.draw();
    expect(collectAgain()).toBeUndefined();
    expect(host.querySelector('[aria-label="Collected"]')).not.toBeNull();
    act(game.win);
    expect(collectAgain()?.disabled).toBe(false);
    expect(reward("Labor")).toBe("1,000");
    await act(async () => collectAgain()!.click());
    expect(game.submit).toHaveBeenCalledTimes(1);
    expect(game.submit).toHaveBeenCalledWith(expect.objectContaining({ home: 7, day: 1 }));
    expect(host.textContent).toContain("Collecting…");
    await act(async () => {
      game.store.applyFacts([game.grant("BaneGrant", 250, 500)]);
      game.finish();
    });
    expect(host.querySelector('[aria-label="Collected"]')).not.toBeNull();
    expect(collectAgain()).toBeUndefined();
    expect(reward("Labor")).toBe("1,250");
    expect(reward("Essence")).toBe("2,000");
  });

  it("offers both rewards for a first collection after quorum and waits for both receipts", async () => {
    const game = worldDay(layout);
    game.win();
    game.draw();
    expect(collect()?.disabled).toBe(false);
    expect(reward("Labor")).toBe("2,000");
    expect(reward("Essence")).toBe("3,000");
    await act(async () => collect()!.click());
    expect(game.submit).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[aria-label="Collected"]')).toBeNull();
    await act(async () => {
      game.store.applyFacts([game.grant("LaborGrant"), game.grant("BaneGrant")]);
      game.finish();
    });
    expect(host.querySelector('[aria-label="Collected"]')).not.toBeNull();
    expect(collectAgain()).toBeUndefined();
    expect(reward("Labor")).toBe("2,000");
  });

  it("does not invent an ordinary quest while the recorded day is missing", () => {
    const game = worldDay(layout);
    game.store.applyFacts([{ model: "WorldBane", key: "world-day", value: null }]);
    game.draw();
    expect(host.textContent).toContain("Reading today's quest");
    expect(host.textContent).not.toContain("The Cull");
    expect(host.querySelector("[data-reward]")).toBeNull();
    expect(collect()).toBeUndefined();
    expect(collectAgain()).toBeUndefined();
  });

  it("names the source of a team bane and grants no second reward when it ends", () => {
    const game = worldDay(layout);
    const source = aspects.find((aspect) => aspect.id !== 2)!;
    game.store.applyFacts([
      { model: "FirstTeamBane", key: "first-bane", value: { game_id: 1, issued_day: 0 } },
      {
        model: "TeamBane",
        key: "team-day",
        value: {
          game_id: 1,
          aspect: 2,
          day: 1,
          issued_day: 0,
          source: source.id,
          quest: nativeQuestConstants.STAND,
        },
      },
      {
        model: "QuestProgress",
        key: "quest-day",
        value: { game_id: 1, home: 7, day: 1, progress: 3, completed_level: 1 },
      },
      game.grant("LaborGrant"),
    ]);
    game.win();
    game.draw();
    expect(host.textContent).toContain(`${source.name}'s bane`);
    expect(host.textContent).toContain("The Stand");
    expect(host.querySelector('[aria-label="Collected"]')).not.toBeNull();
    expect(collectAgain()).toBeUndefined();
    expect(reward("Labor")).toBe("1,000");
  });
  it("shows a received sub-unit reward as less than one, never zero", () => {
    const game = worldDay(layout);
    game.win();
    const bonus = game.grant("BaneGrant", 0, 0);
    game.store.applyFacts([
      game.grant("LaborGrant", 0, 0),
      { ...bonus, value: { ...bonus.value, amount: 500_000_000n, essence: 250_000_000n } },
    ]);
    game.draw();
    expect(host.querySelector('[aria-label="Collected"]')).not.toBeNull();
    expect(reward("Labor")).toBe("<1");
    expect(reward("Essence")).toBe("<1");
  });
});
