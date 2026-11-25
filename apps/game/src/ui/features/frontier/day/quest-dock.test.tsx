import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameProvider } from "@/hooks/context/game-context";
import { chainOf } from "@/lab/game/lab-chain";
import { questScenario } from "@/lab/game/quest-scenario";
import { dayOf, readExpeditionRules } from "@bibliothecadao/eternum";
import { RESOURCE_PRECISION, aspects } from "@bibliothecadao/types";
import { nativeBaneConstants, nativeQuestConstants } from "@bibliothecadao/eternum/game-client";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { useBaneToday } from "./bane-face";
import { QuestDock } from "./quest-dock";

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

function fixture() {
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
  const drawWith = (node: ReactNode) =>
    act(() =>
      root!.render(
        <GameProvider
          value={{ store, systemCalls: { claim_daily_quest: submit } } as unknown as GameClientSetup}
          account={{ address: scenario.player, account: { address: scenario.player } } as never}
        >
          {node}
        </GameProvider>,
      ),
    );
  const realm = () => store.require("Structure", { game_id: 1, entity_id: 7 });
  const draw = () => drawWith(<QuestDock realm={realm()} rules={readExpeditionRules(store, 1)!} layout="desktop" />);
  return { store, draw, drawWith, realm, submit, finish: () => finish({ transaction_hash: "0x123" }), scenario };
}

const collect = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Collect");

describe("the quest dock", () => {
  it("submits once, keeps Collect busy, and renders only the received grant as collected", async () => {
    const game = fixture();
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
          { kind: "ClaimDailyQuest", fields: { home: "7", day: "0" }, span: [] },
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
    const game = fixture();
    game.store.setSnapshot({ gameId: 1, actor: game.scenario.player, complete: false, timestamp: 350 });
    game.draw();
    expect(host.textContent).toContain("Loading today's quest");
    expect(collect()).toBeUndefined();
    act(() => game.store.setSnapshot({ gameId: 1, actor: game.scenario.player, complete: true, timestamp: 350 }));
    expect(collect()?.disabled).toBe(false);
  });
});

function worldDay() {
  const fixtureGame = fixture();
  const { store } = fixtureGame;
  const registry = store.require("GameRegistry", { game_id: 1 });
  const rules = store.require("SliceRules", { game_id: 1 });
  const calendar = {
    seed: registry.seed,
    startMainAt: Number(registry.start_main_at),
    scheduledEndAt: Number(registry.scheduled_end_at),
    endAt: Number(registry.end_at),
    dayUnitSeconds: rules.day_unit_seconds,
  };
  const start = dayOf(calendar, calendar.startMainAt)!.end;
  clock.now = start + 20;
  store.applyFacts([
    { model: "HomeAspect", key: "0xd000", value: { game_id: 1, home: 7, aspect: 2 } },
    { model: "AspectActivity", key: "0xd001", value: { game_id: 1, aspect: 2, day: 0, active: 5 } },
    {
      model: "BaneRules",
      key: "0xd002",
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
    { model: "WorldBane", key: "0xd003", value: { game_id: 1, day: 1, kind: nativeBaneConstants.ASH_FALL } },
    {
      model: "QuestProgress",
      key: "0xd004",
      value: { game_id: 1, home: 7, day: 1, progress: 2500, completed_level: 1 },
    },
  ]);
  store.setSnapshot({ gameId: 1, complete: true, actor: fixtureGame.scenario.player, timestamp: clock.now });
  const grant = (model: "LaborGrant" | "BaneGrant", labor = 1000, essence = 1500) => ({
    model,
    key: "0xff10",
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
        key: "0xd005",
        value: { game_id: 1, aspect: 2, day: 1, completed: 2, ended_at: start + 10 },
      },
    ]);
  return { ...fixtureGame, grant, win };
}
const collectAgain = () =>
  [...host.querySelectorAll("button")].find((button) => button.textContent === "Collect again");
const reward = (name: string) => host.querySelector(`[data-reward="${name}"]`)?.getAttribute("aria-label");

describe("bane collection", () => {
  it("collects the second world reward once after quorum and renders the actual clipped receipt", async () => {
    const game = worldDay();
    game.store.applyFacts([game.grant("LaborGrant")]);
    game.draw();
    expect(collectAgain()).toBeUndefined();
    expect(host.querySelector('[aria-label="Collected"]')).not.toBeNull();
    act(game.win);
    expect(collectAgain()?.disabled).toBe(false);
    expect(reward("Labor")).toBe("1,000 Labor");
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
    expect(reward("Labor")).toBe("1,250 Labor");
    expect(reward("Essence")).toBe("2,000 Essence");
  });

  it("offers both rewards for a first collection after quorum and waits for both receipts", async () => {
    const game = worldDay();
    game.win();
    game.draw();
    expect(collect()?.disabled).toBe(false);
    expect(reward("Labor")).toBe("2,000 Labor");
    expect(reward("Essence")).toBe("3,000 Essence");
    await act(async () => collect()!.click());
    expect(game.submit).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[aria-label="Collected"]')).toBeNull();
    await act(async () => {
      game.store.applyFacts([game.grant("LaborGrant"), game.grant("BaneGrant")]);
      game.finish();
    });
    expect(host.querySelector('[aria-label="Collected"]')).not.toBeNull();
    expect(collectAgain()).toBeUndefined();
    expect(reward("Labor")).toBe("2,000 Labor");
  });

  it("says the day's quest comes with the first transaction, inventing none, while the day's roll is not written", () => {
    const game = worldDay();
    game.store.applyFacts([{ model: "WorldBane", key: "0xd003", value: null }]);
    game.draw();
    expect(host.querySelector("[data-quest-undrawn]")?.textContent).toBe(
      "Today's quest and bane are drawn on the first transaction anyone sends today.",
    );
    expect(host.textContent).not.toContain("Loading today's quest");
    expect(host.textContent).not.toContain("The Cull");
    expect(host.querySelector("[data-reward]")).toBeNull();
    expect(collect()).toBeUndefined();
    expect(collectAgain()).toBeUndefined();
  });

  it("names a team bane by the Aspect that cast it, over its quest, and grants no second reward when it ends", () => {
    const game = worldDay();
    const source = aspects.find((aspect) => aspect.id !== 2)!;
    game.store.applyFacts([
      { model: "FirstTeamBane", key: "0xd006", value: { game_id: 1, issued_day: 0 } },
      {
        model: "TeamBane",
        key: "0xd007",
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
        key: "0xd004",
        value: { game_id: 1, home: 7, day: 1, progress: 3, completed_level: 1 },
      },
      game.grant("LaborGrant"),
    ]);
    game.win();
    game.draw();
    expect(host.querySelector("aside")?.getAttribute("aria-label")).toBe(`Havoc: Bane from ${source.name}`);
    expect(host.querySelector(".emissary-dock__portrait")?.getAttribute("data-icon")).toBe("bane-altar-curse");
    expect(host.querySelector("[data-bane-row]")?.textContent).toBe("No Deep heightBreak: 2/2 of your Aspect · Broken");
    expect(host.querySelector("[data-quest-objective]")?.textContent).toBe("The Stand · Clear 3 guarded sites (3/3)");
    expect(host.textContent).not.toContain("2× if broken");
    expect(host.querySelector('[aria-label="Collected"]')).not.toBeNull();
    expect(collectAgain()).toBeUndefined();
    expect(reward("Labor")).toBe("1,000 Labor");
  });

  it("gives every figure a bane cuts one line: the bane, what it cuts, by how much and until when, and none once broken", () => {
    const game = worldDay();
    const BaneLine = () => <output>{useBaneToday(game.realm())?.line ?? "none"}</output>;
    game.drawWith(<BaneLine />);
    expect(host.textContent).toMatch(/^Ash Fall: production 50% until broken or \d\d:\d\d$/);
    act(game.win);
    expect(host.textContent).toBe("none");
  });

  it("says when a world bane clears while the Aspect has not broken it", () => {
    const game = worldDay();
    game.draw();
    expect(host.querySelector("[data-bane-row]")?.textContent).toMatch(
      /^50% Production2× if brokenBreak: 0\/2 of your Aspect · Clears in \d+[hm]$/,
    );
  });

  it("shows a received sub-unit reward as less than one, never zero", () => {
    const game = worldDay();
    game.win();
    const bonus = game.grant("BaneGrant", 0, 0);
    game.store.applyFacts([
      game.grant("LaborGrant", 0, 0),
      { ...bonus, value: { ...bonus.value, amount: 500_000_000n, essence: 250_000_000n } },
    ]);
    game.draw();
    expect(host.querySelector('[aria-label="Collected"]')).not.toBeNull();
    expect(reward("Labor")).toBe("<1 Labor");
    expect(reward("Essence")).toBe("<1 Essence");
  });
});
