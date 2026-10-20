// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";

const game = vi.hoisted(() => ({
  buyTier: vi.fn(() => Promise.resolve({ transaction_hash: "0x7" })),
  select: vi.fn(),
  signer: { address: "0x111" },
  progress: {
    game_id: 1,
    explorer_id: 12n,
    xp: 12,
    battle: 1,
    logistics: 1,
    scouting: 1,
    scouting_kinds: 0,
    homecoming: 1,
  },
  rules: { game_id: 1, reveal_xp: 2, fixed_xp: 200, uncommon_xp: 100, rare_xp: 200, epic_xp: 400, legendary_xp: 800 },
}));
const army = {
  explorerId: 12,
  number: 1,
  label: "Army 1",
  art: "knight-t1",
  xp: 12,
  troops: 1_500,
  stamina: { current: 4, max: 120 },
  secondsToFull: 232,
  canBuyTier: false,
};

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      store: { get: (model: string) => (model === "ArmyProgress" ? game.progress : game.rules) },
      systemCalls: { buy_tier: game.buyTier },
    },
    account: { account: game.signer },
  }),
}));
vi.mock("@/sync/action-outcome", () => ({ untilApplied: async (sent: Promise<unknown>) => (await sent, "0x7") }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useSelectArmyOnMap: () => game.select }));
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (pick: (state: unknown) => unknown) => pick({ account: { address: "0x111" } }),
}));
vi.mock("@/shell/frame/layout", () => ({ useLayout: () => "desktop" }));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => true }));
vi.mock("../deploy/open-slots", () => ({ useOpenArmySlots: () => [] }));
vi.mock("../sites/well-refill", () => ({ useWellRefill: (_id: number, ratio: number) => ({ shown: ratio }) }));
vi.mock("../hud/dock-armies", () => ({ useDockArmies: () => [army] }));
vi.mock("./army-refill", () => ({ ArmyRefill: () => null }));
vi.mock("../frontier-reveal-yield", () => ({ useArmyRevealYield: () => 75 }));

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
  game.progress.xp = 12;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (text: RegExp) => [...host.querySelectorAll("button")].find((each) => text.test(each.textContent ?? ""));

it("opens the army's panel from its row on a desktop, whatever its XP buys", () => {
  const onOpenArmy = vi.fn();
  const realm = { owner: "0x111", base: { troop_max_explorer_count: 3 } };
  act(() => root.render(<ArmyDock realm={realm as never} armies={[army as never]} onOpenArmy={onOpenArmy} />));
  act(() => button(/Army 1/)!.click());
  expect(game.select).toHaveBeenCalledWith(12);
  expect(onOpenArmy).toHaveBeenCalledWith(12);
});

it("shows the army's figures, then its level-ups one step on, and buys the chosen level with buy_tier", async () => {
  game.progress.xp = 260;
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: 12 } }));
  act(() => root.render(<FrontierArmy realm={{ game_id: 1 } as never} onClose={vi.fn()} />));
  expect(host.textContent).toContain("Damage dealt");
  expect(host.textContent).toContain("Max stamina");
  // Frontier's camp is its Troll, on the panel as everywhere (the shared structure naming rule).
  expect(host.textContent).toContain("Clear a Troll: more for a stronger guard");
  expect(host.textContent).not.toMatch(/Camp/);
  act(() => button(/Level up · 4 ready/)!.click());
  act(() => [...host.querySelectorAll<HTMLButtonElement>("[data-attribute='scouting']")][0]!.click());
  expect(button(/^Trolls$/)).toBeDefined();
  expect(host.textContent).not.toMatch(/Camp/);
  act(() => button(/^Rifts$/)!.click());
  await act(async () => button(/^Level up$/)!.click());
  expect(game.buyTier).toHaveBeenCalledWith({
    signer: game.signer,
    explorerId: 12,
    attribute: "Scouting",
    scoutingKind: "Rift",
  });
});

it("lets an army short of XP see its level-ups, and holds the verb with what is missing", () => {
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: 12 } }));
  act(() => root.render(<FrontierArmy realm={{ game_id: 1 } as never} onClose={vi.fn()} />));
  act(() => button(/^Level-ups$/)!.click());
  expect(host.textContent).toContain("100 XP · 88 XP short");
  expect(button(/^Level up$/)!.disabled).toBe(true);
});
