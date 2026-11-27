// @vitest-environment jsdom
// @vitest-environment jsdom
import { OATH_PICK, PICK_EFFECT_WORDS } from "@/ui/design-system/kit/words";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { formatCount, formatShort, FRAGMENT, FRAGMENTS } from "@bibliothecadao/types";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { DockArmy } from "../hud/dock-armies";

const game = vi.hoisted(() => ({
  spendPoint: vi.fn(() => Promise.resolve({ transaction_hash: "0x7" })),
  chooseOath: vi.fn(() => Promise.resolve({ transaction_hash: "0x8" })),
  rerollOath: vi.fn(() => Promise.resolve({ transaction_hash: "0x9" })),
  fragments: null as number | null,
  ethereal: undefined as number | undefined,
  staminaKnown: true,
  select: vi.fn(),
  learned: 0n,
  signer: { address: "0x111" },
  progress: {
    game_id: 1,
    explorer_id: 12n,
    logistics: 0,
    oath_slots: 1,
    oaths: 0,
    oath_pick: 0,
  },
  rules: {
    common_xp: 75,
    game_id: 1,
    reveal_xp: 2,
    reveal_xp_per_depth: 1,
    uncommon_xp: 200,
    rare_xp: 400,
    epic_xp: 800,
    legendary_xp: 1500,
  },
}));
const troopsFact: Pick<DockArmy["troopsFact"], "category"> = { category: "Knight" };
const army = {
  explorerId: 12,
  number: 1,
  label: "Army 1",
  art: "knight-t1",
  troops: 1_500,
  troopsFact,
  stamina: { current: 4, max: 120 },
  secondsToFull: 232,
};

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      store: {
        get: (model: string) =>
          model === "ArmyProgress"
            ? game.progress
            : model === "RealmKnowledge"
              ? { learned: game.learned }
              : game.rules,
      },
      systemCalls: { spend_skill_point: game.spendPoint, choose_oath: game.chooseOath, reroll_oath: game.rerollOath },
    },
    account: { account: game.signer },
  }),
}));
vi.mock("@/sync/action-outcome", () => ({ untilApplied: async (sent: Promise<unknown>) => (await sent, "0x7") }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({
  useNativeRevision: () => 0,
  useNativeFacts: () => ({ store: { get: (model: string) => (model === "ArmyProgress" ? game.progress : undefined) } }),
}));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useSelectArmyOnMap: () => game.select }));
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (pick: (state: unknown) => unknown) => pick({ account: { address: "0x111" } }),
}));
vi.mock("@/hooks/helpers/use-compact-hud", async (original) => ({
  ...(await original<typeof import("@/hooks/helpers/use-compact-hud")>()),
  useHudLayout: () => "desktop",
}));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => true }));
vi.mock("../deploy/use-deploy-plan", () => ({ useDeployPlan: () => ({ open: [] }) }));
vi.mock("../sites/well-refill", () => ({ useWellRefill: (_id: number, ratio: number) => ({ shown: ratio }) }));
vi.mock("../hud/dock-armies", () => ({
  useDockArmies: () => [{ ...army, ethereal: game.ethereal, ...(game.staminaKnown ? {} : { stamina: undefined }) }],
}));
vi.mock("../value/fragments", () => ({ useFragmentsHeld: () => game.fragments }));
// The army stands away from its spire: its panel has no Spire (spire-card.test.tsx plays the spire).
vi.mock("../spire-card", () => ({ useArmySpireStatus: () => null }));

const { FrontierArmy } = await import("./frontier-army");
const { ArmyDock } = await import("../hud/army-dock");

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
  game.learned = 0n;
  game.staminaKnown = true;
  game.progress.oath_slots = 1;
  army.troopsFact = { category: "Knight" };
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (text: RegExp) => [...host.querySelectorAll("button")].find((each) => text.test(each.textContent ?? ""));

it("opens the army's panel from its row on a desktop, through its existing selection callback", () => {
  const onOpenArmy = vi.fn();
  const realm = { owner: "0x111", base: { troop_max_explorer_count: 3 } };
  act(() => root.render(<ArmyDock realm={realm as never} armies={[army as never]} onOpenArmy={onOpenArmy} />));
  act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Army 1"]')!.click());
  // The HUD's pick selects and opens it (useArmyPanelOpens): the row takes that one way, no selection of its own.
  expect(onOpenArmy).toHaveBeenCalledOnce();
  expect(onOpenArmy).toHaveBeenCalledWith(12);
  expect(game.select).not.toHaveBeenCalled();
});

it("keeps Delete as a trash at the foot's bottom right, asking before it deletes, and offers no Reinforce", () => {
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: 12 } }));
  act(() => root.render(<FrontierArmy realm={{ game_id: 1 } as never} onClose={vi.fn()} />));
  const trash = host.querySelector<HTMLButtonElement>('.ui-window__foot button[aria-label="Delete"]');
  expect(trash?.nextElementSibling).toBeNull();
  expect(host.querySelector('.ui-frame__head button[aria-label="Delete"]')).toBeNull();
  expect(trash?.dataset.kind).toBe("danger");
  expect(button(/Reinforce/)).toBeUndefined();
  expect(host.querySelector('[role="alertdialog"]')).toBeNull();
  act(() => trash!.click());
  expect(host.querySelector('.ui-frame__body [role="alertdialog"]')?.textContent).toContain(
    "troops, carried resources and held Oaths are lost",
  );
});

it("spells what each sworn Oath grants in the panel, no hover needed", async () => {
  const { nativeOathConstants: oaths } = await import("@bibliothecadao/eternum/game-client");
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: 12 } }));
  game.progress.oath_slots = 2;
  game.progress.oaths = (1 << (oaths.POWER - 1)) | (1 << (oaths.GIANTS - 1));
  act(() => root.render(<FrontierArmy realm={{ game_id: 1 } as never} onClose={vi.fn()} />));
  const rows = [...host.querySelectorAll("[data-oath-effects] li")].map((row) =>
    [...row.children].map((part) => part.textContent),
  );
  expect(rows).toEqual([
    ["Giants", `-${oaths.GIANTS_REDUCTION_PERCENT}%`, PICK_EFFECT_WORDS.battleDamageTaken],
    ["Power", `+${oaths.POWER_DAMAGE_PERCENT}%`, PICK_EFFECT_WORDS.battleDamageDealt],
  ]);
  game.progress.oaths = 0;
});

vi.mock("../relics/army-relic-slots", () => ({ ArmyRelicSlots: () => null }));

it("shows the army's captured Oath capacity rather than later home research", () => {
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: 12 } }));
  game.learned = 3n << 30n;
  game.progress.oath_slots = 2;
  act(() => root.render(<FrontierArmy realm={{ game_id: 1 } as never} onClose={vi.fn()} />));
  const sockets = () => host.querySelector("[data-oath-slots]")!;
  expect(sockets().getAttribute("aria-label")).toBe("2 Oath slots");
  expect(sockets().querySelectorAll("[data-open]")).toHaveLength(2);
  game.progress.oath_slots = 5;
  act(() => root.render(<FrontierArmy realm={{ game_id: 1 } as never} onClose={vi.fn()} />));
  expect(sockets().getAttribute("aria-label")).toBe("5 Oath slots");
  expect(sockets().querySelectorAll("[data-locked]")).toHaveLength(0);
});

it("draws each offered Oath with its Order crest, effect line and the army's slot in the head, without job colours", async () => {
  const { FrontierOathPick } = await import("./oath-pick");
  const { nativeOathConstants: oaths } = await import("@bibliothecadao/eternum/game-client");
  game.progress.oath_slots = 2;
  game.progress.oaths = 1 << (oaths.GIANTS - 1);
  game.progress.oath_pick = oaths.POWER - 1 + ((oaths.FOX - 1) << 4) + ((oaths.RAGE - 1) << 8);
  act(() => root.render(<FrontierOathPick realm={{ game_id: 1 } as never} />));
  const cards = [...host.querySelectorAll<HTMLElement>("[data-oath-id]")];
  expect(cards).toHaveLength(3);
  expect(cards.map((card) => Number(card.dataset.oathId))).toEqual([oaths.POWER, oaths.FOX, oaths.RAGE]);
  expect(cards.every((card) => !("oathJob" in card.dataset))).toBe(true);
  expect(cards.every((card) => card.querySelector("img, svg") !== null)).toBe(true);
  expect(host.querySelector(".oath-pick__title span")?.textContent).toBe("Slot 2 of 2 · 1,500 Knights");
});

it("opens the earned pick once its army is picked and keeps it through Escape and outside presses", async () => {
  const { FrontierOathPick } = await import("./oath-pick");
  const { nativeOathConstants: oaths } = await import("@bibliothecadao/eternum/game-client");
  game.progress.oath_slots = 1;
  game.progress.oaths = 0;
  game.progress.oath_pick = oaths.POWER - 1 + ((oaths.FOX - 1) << 4) + ((oaths.RAGE - 1) << 8);
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: null } }));
  act(() => root.render(<FrontierOathPick realm={{ game_id: 1 } as never} />));
  expect(host.querySelector("[data-oath-pick]")).toBeNull();
  act(() => useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: 12 } })));
  expect(host.querySelectorAll("[data-oath-id]")).toHaveLength(3);
  expect(host.querySelector('button[aria-label="Close"]')).toBeNull();
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    host.querySelector<HTMLElement>(".ui-modal")!.click();
  });
  expect(host.querySelector("[data-oath-pick]")).not.toBeNull();
  expect(host.querySelector<HTMLElement>("[data-oath-pass-result]")!.dataset.oathPassResult).toBe(
    String(army.stamina.current + oaths.PASS_STAMINA),
  );
  act(() => {
    game.progress.oath_pick = 0;
    root.render(<FrontierOathPick realm={{ game_id: 1 } as never} />);
  });
  expect(host.querySelector("[data-oath-pick]")).toBeNull();
});

it("opens an earned pick before the army's stamina is known, its cards answerable and Pass held until its result is", async () => {
  const { FrontierOathPick } = await import("./oath-pick");
  const { nativeOathConstants: oaths } = await import("@bibliothecadao/eternum/game-client");
  game.staminaKnown = false;
  game.progress.oath_slots = 1;
  game.progress.oaths = 0;
  game.progress.oath_pick = oaths.POWER - 1 + ((oaths.FOX - 1) << 4) + ((oaths.RAGE - 1) << 8);
  act(() => root.render(<FrontierOathPick realm={{ game_id: 1 } as never} />));
  expect(host.querySelectorAll("[data-oath-id]")).toHaveLength(3);
  const pass = () => host.querySelector<HTMLButtonElement>("[data-oath-pass]")!;
  expect(pass().textContent).toBe(`Pass · +${oaths.PASS_STAMINA}`);
  expect(pass().disabled).toBe(true);
  expect(host.querySelector("[data-oath-pass-result]")).toBeNull();
  game.staminaKnown = true;
  act(() => root.render(<FrontierOathPick realm={{ game_id: 1 } as never} />));
  expect(pass().disabled).toBe(false);
  expect(pass().textContent).toBe(
    `Pass · +${oaths.PASS_STAMINA} · ${army.stamina.current} → ${army.stamina.current + oaths.PASS_STAMINA}`,
  );
  game.staminaKnown = false;
  act(() => root.render(<FrontierOathPick realm={{ game_id: 1 } as never} />));
  await act(async () => host.querySelector<HTMLButtonElement>(`[data-oath-id="${oaths.FOX}"]`)!.click());
  await act(async () => host.querySelector<HTMLButtonElement>("[data-oath-swear]")!.click());
  expect(game.chooseOath).toHaveBeenCalledWith({
    signer: game.signer,
    explorerId: army.explorerId,
    expectedPick: game.progress.oath_pick,
    oath: oaths.FOX,
    replace: null,
  });
});

it("redraws the card at its place for its Fragments, once a pick, never short of Fragments or in the Deep", async () => {
  const { FrontierOathPick } = await import("./oath-pick");
  const { nativeFragmentConstants, nativeOathConstants: oaths } = await import("@bibliothecadao/eternum/game-client");
  const price = nativeFragmentConstants.OATH_REROLL_FRAGMENTS;
  const offer = oaths.POWER - 1 + ((oaths.FOX - 1) << 4) + ((oaths.RAGE - 1) << 8);
  const redraws = () => [...host.querySelectorAll<HTMLButtonElement>("[data-reroll-oath]")];
  const show = (pick: number, fragments: number | null, ethereal: number | undefined) => {
    game.progress.oath_pick = pick;
    game.fragments = fragments;
    game.ethereal = ethereal;
    act(() => root.render(<FrontierOathPick realm={{ game_id: 1 } as never} />));
  };
  game.staminaKnown = true;
  game.progress.oath_slots = 1;
  game.progress.oaths = 0;
  show(offer, price, undefined);
  expect(redraws().map((redraw) => [redraw.dataset.rerollOath, redraw.disabled])).toEqual([
    ["0", false],
    ["1", false],
    ["2", false],
  ]);
  const rageRedraw = redraws()[2]!;
  expect(rageRedraw.getAttribute("aria-label")).toBe(`Swap Rage for ${formatCount(price, FRAGMENT, FRAGMENTS)}`);
  expect(rageRedraw.textContent).toBe(`${OATH_PICK.swap} ·${formatShort(price)}`);
  await act(async () => redraws()[2]!.click());
  expect(game.rerollOath).toHaveBeenCalledWith({
    signer: game.signer,
    explorerId: army.explorerId,
    expectedPick: offer,
    index: 2,
  });
  show(offer + oaths.REROLLED, price, undefined);
  expect(redraws()).toHaveLength(0);
  show(offer, price - 1, undefined);
  expect(redraws().map((redraw) => redraw.disabled)).toEqual([true, true, true]);
  show(offer, null, undefined);
  expect(redraws()).toHaveLength(0);
  const { DEEP_DEPTH } = await import("@bibliothecadao/eternum");
  show(offer, price, DEEP_DEPTH);
  expect(redraws()).toHaveLength(0);
});
