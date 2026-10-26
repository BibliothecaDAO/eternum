// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The build's send stands in, held open until the test lets it land, so a second press arrives while it is in flight.
const send = vi.hoisted(() => ({ build: vi.fn(), land: () => {} }));
vi.mock("@/ui/features/settlement/construction/realm-build-actions", () => ({
  buildRealmBuilding: (...args: unknown[]) => {
    send.build(...args);
    return new Promise<void>((resolve) => (send.land = resolve));
  },
}));
vi.mock("@/utils/can-issue-orders", () => ({
  canIssueOrders: () => true,
  actNowRefusal: () => null,
  refusedBeforePlay: () => false,
}));
vi.mock("@/ui/features/settlement/production/production-modal", () => ({ ProductionModal: () => null }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: {} } }) }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({}) }));
vi.mock("@bibliothecadao/eternum", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/eternum")>()),
  getRealmInfo: () => ({ position: { x: 1, y: 1 } }),
  configManager: { buildingCostMode: "standard" },
  resolveUseSimpleCost: () => false,
}));

const { useSuggestionActions } = await import("./use-suggestion-actions");
const { usePopoverStore } = await import("@/hooks/store/use-popover-store");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { LeftView } = await import("@/types");

const WOOD = {
  id: "1-build-wood",
  realmId: 1,
  realmName: "Egonal",
  action: "build-wood",
  label: "Build wood camp",
  icon: "wood",
  buildingTypeHint: 5,
} as never;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  send.build.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

/** A surface offering the step, as the Build order panel and Attention's suggestions each do: its verb, busy while the step sends. */
const Surface = ({ name }: { name: string }) => {
  const { handleSuggestionClick, pendingSuggestionIds } = useSuggestionActions();
  return (
    <button
      aria-label={name}
      aria-busy={pendingSuggestionIds.includes("1-build-wood")}
      onClick={() => void handleSuggestionClick(WOOD)}
    >
      Build
    </button>
  );
};

it("sends a step once while it is in flight, whichever surface presses it, and shows it sending on both", async () => {
  await act(async () =>
    root.render(
      <>
        <Surface name="Build order" />
        <Surface name="Attention" />
      </>,
    ),
  );
  const press = (name: string) =>
    act(async () => host.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!.click());
  const busy = () => [...host.querySelectorAll("button")].map((button) => button.getAttribute("aria-busy"));

  await press("Build order");
  await press("Attention");
  expect(send.build).toHaveBeenCalledTimes(1);
  expect(busy()).toEqual(["true", "true"]);

  await act(async () => send.land());
  expect(busy()).toEqual(["false", "false"]);
  await press("Attention");
  expect(send.build).toHaveBeenCalledTimes(2);
});

/** A realm's army step, as the order offers it once its barracks stands. */
const armyStep = (action: "train-troops" | "deploy-army") =>
  ({
    id: `1-${action}`,
    realmId: 1,
    realmName: "Egonal",
    action,
    label: action,
    icon: "troops",
    resourceHint: 7,
  }) as never;

/** A surface offering one step, pressed once. */
const pressStep = async (step: never) => {
  const Step = () => {
    const { handleSuggestionClick } = useSuggestionActions();
    return <button onClick={() => void handleSuggestionClick(step)}>Take</button>;
  };
  await act(async () => root.render(<Step />));
  await act(async () => host.querySelector("button")!.click());
};

it("opens the realm's Production on its troop for Train, and its army deployment for Deploy", async () => {
  await pressStep(armyStep("train-troops"));
  const production = usePopoverStore.getState().surface;
  expect([production?.id, (production?.content as { props: unknown }).props]).toEqual([
    "production",
    { preSelectedRealmId: 1, preSelectedResource: 7 },
  ]);
  await pressStep(armyStep("deploy-army"));
  expect(useUIStore.getState().leftNavigationView).toBe(LeftView.MilitaryView);
  expect(useUIStore.getState().pendingMilitaryAction).toEqual({ structureId: 1, isExplorer: true });
  expect(send.build).not.toHaveBeenCalled();
});
