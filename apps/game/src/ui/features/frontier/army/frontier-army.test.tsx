// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";

const game = vi.hoisted(() => ({
  spendPoint: vi.fn(() => Promise.resolve({ transaction_hash: "0x7" })),
  select: vi.fn(),
  signer: { address: "0x111" },
  progress: {
    common_points: 0,
    uncommon_points: 0,
    rare_points: 0,
    epic_points: 0,
    legendary_points: 0,
    game_id: 1,
    explorer_id: 12n,
    xp: 12,
    battle: 0,
    logistics: 0,
    scouting: 0,
    scouting_kinds: 0,
    homecoming: 0,
  },
  rules: {
    common_xp: 75,
    game_id: 1,
    reveal_xp: 2,
    reveal_xp_per_depth: 1,
    fixed_xp: 200,
    uncommon_xp: 200,
    rare_xp: 400,
    epic_xp: 800,
    legendary_xp: 1500,
  },
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
  canSpendSkillPoint: false,
};

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      store: { get: (model: string) => (model === "ArmyProgress" ? game.progress : game.rules) },
      systemCalls: { spend_skill_point: game.spendPoint },
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
vi.mock("../deploy/use-deploy-plan", () => ({ useDeployPlan: () => ({ open: [] }) }));
vi.mock("../sites/well-refill", () => ({ useWellRefill: (_id: number, ratio: number) => ({ shown: ratio }) }));
vi.mock("../hud/dock-armies", () => ({ useDockArmies: () => [army] }));
vi.mock("./army-refill", () => ({ ArmyRefill: () => null }));
vi.mock("../frontier-reveal-yield", () => ({ useArmyRevealYield: () => 75 }));
// The army stands away from its spire: its panel has no Spire (spire-card.test.tsx plays the spire).
vi.mock("../spire-card", () => ({ useArmyAtItsSpire: () => null, SpireButton: () => null }));

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
  game.progress.common_points = 0;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const button = (text: RegExp) => [...host.querySelectorAll("button")].find((each) => text.test(each.textContent ?? ""));

it("opens the army's panel from its row on a desktop, whether it holds a point", () => {
  const onOpenArmy = vi.fn();
  const realm = { owner: "0x111", base: { troop_max_explorer_count: 3 } };
  act(() => root.render(<ArmyDock realm={realm as never} armies={[army as never]} onOpenArmy={onOpenArmy} />));
  act(() => button(/Army 1/)!.click());
  // The HUD's pick selects and opens it (useArmyPanelOpens): the row takes that one way, no selection of its own.
  expect(onOpenArmy).toHaveBeenCalledOnce();
  expect(onOpenArmy).toHaveBeenCalledWith(12);
  expect(game.select).not.toHaveBeenCalled();
});

it("shows the army's figures, then its level-ups one step on, and buys the chosen level with spend_skill_point", async () => {
  game.progress.xp = 260;
  game.progress.common_points = 1;
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: 12 } }));
  act(() => root.render(<FrontierArmy realm={{ game_id: 1 } as never} choosing={false} onClose={vi.fn()} />));
  // The army's sheet stands in the kit's one frame, as every surface the HUD opens does (frontier-hud.test).
  expect(host.querySelector("section[data-kit-sheet]")?.hasAttribute("data-kit-frame")).toBe(true);
  // Each attribute is a tile named by its attribute, with what it gives as its effect (the owner's pick, 22 October).
  expect(host.querySelector('button[aria-label="Battle 0% damage"]')).not.toBeNull();
  expect(host.textContent).toMatch(/\d+ max stamina/);
  expect(host.textContent).toMatch(/% come home/);
  // Scouting uses the same Troll name as the map.
  expect(host.textContent).not.toMatch(/Camp/);
  // Level up counts nothing: a point buys one level-up, whichever the choices take.
  expect(button(/Level up/)!.textContent).toBe("Level up");
  // A tile opens its own level-up.
  act(() => host.querySelector<HTMLButtonElement>('button[aria-label^="Scouting"]')!.click());
  expect(host.querySelector("[data-attribute='scouting']")!.getAttribute("aria-pressed")).toBe("true");
  expect(button(/^Trolls$/)).toBeDefined();
  expect(host.textContent).not.toMatch(/Camp/);
  act(() => button(/^Rifts$/)!.click());
  await act(async () => button(/^Level up$/)!.click());
  expect(game.spendPoint).toHaveBeenCalledWith({
    signer: game.signer,
    explorerId: 12,
    choice: { kind: "Scouting", value: { kind: "Rift", value: undefined } },
  });
});

it("lets an army without points see its level-ups, and holds the verb with what is missing", () => {
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: 12 } }));
  act(() => root.render(<FrontierArmy realm={{ game_id: 1 } as never} choosing={false} onClose={vi.fn()} />));
  act(() => button(/^Level-ups$/)!.click());
  expect(host.textContent).toContain("No fitting point");
  expect(button(/^Level up$/)!.disabled).toBe(true);
});

it("sends the chosen point rank for Stamina without changing lifetime XP", async () => {
  game.progress.xp = 260;
  game.progress.common_points = 1;
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: 12 } }));
  act(() => root.render(<FrontierArmy realm={{ game_id: 1 } as never} choosing={false} onClose={vi.fn()} />));
  act(() => button(/^Level up$/)!.click());
  act(() => host.querySelector<HTMLButtonElement>('[data-attribute="stamina"]')!.click());
  await act(async () => button(/^Refill$/)!.click());
  expect(game.spendPoint).toHaveBeenCalledWith({
    signer: game.signer,
    explorerId: 12,
    choice: { kind: "Stamina", value: 1 },
  });
  expect(game.progress.xp).toBe(260);
});

it("returns to the army's status once its last point is spent, and stays on the choices while one is left", async () => {
  game.progress.xp = 260;
  game.progress.common_points = 2;
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: 12 } }));
  const draw = () =>
    act(() => root.render(<FrontierArmy realm={{ game_id: 1 } as never} choosing={false} onClose={vi.fn()} />));
  draw();
  act(() => button(/^Level up$/)!.click());
  act(() => host.querySelector<HTMLButtonElement>('[data-attribute="stamina"]')!.click());
  // The first point lands: one is left, so the choices stay.
  await act(async () => button(/^Refill$/)!.click());
  game.progress.common_points = 1;
  draw();
  expect(host.querySelector("[data-army-step]")!.getAttribute("data-army-step")).toBe("choose");
  // The last lands: nothing is left to buy, and the army's status is back, never "No fitting point".
  await act(async () => button(/^Refill$/)!.click());
  expect(game.spendPoint).toHaveBeenCalledTimes(2);
  game.progress.common_points = 0;
  draw();
  expect(host.querySelector("[data-army-step]")!.getAttribute("data-army-step")).toBe("stats");
  expect(host.textContent).not.toContain("No fitting point");
});

it.each([
  [74, "75"],
  [75, "200"],
  [199, "200"],
  [200, "400"],
  [399, "400"],
  [400, "800"],
  [799, "800"],
  [800, "1,500"],
  [1499, "1,500"],
  [1500, "1,575"],
  [1575, "1,700"],
  [3000, "3,075"],
])("shows the real next-point readout at %s XP, including in Level up", (xp, next) => {
  game.progress.xp = xp;
  game.progress.common_points = Number(xp >= game.rules.common_xp);
  useUIStore.setState((state) => ({ entityActions: { ...state.entityActions, selectedEntityId: 12 } }));
  act(() => root.render(<FrontierArmy realm={{ game_id: 1 } as never} choosing={false} onClose={vi.fn()} />));
  const readout = `${xp.toLocaleString("en-US")} / ${next} XP`;
  expect(host.textContent).toContain(readout);
  act(() => button(/Level[ -]up/)!.click());
  expect(host.textContent).toContain(readout);
});
