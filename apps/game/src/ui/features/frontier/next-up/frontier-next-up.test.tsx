// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { NextUpFacts } from "./next-up-facts";

const moves = vi.hoisted(() => ({
  facts: {} as NextUpFacts,
  goToPlace: vi.fn(),
  deploy: vi.fn(),
  selectArmy: vi.fn(),
  /** A move or explore pinned on the map, and the screen it is pinned on. */
  pinned: false,
  layout: "desktop" as "phone" | "desktop",
  /** The view the player is in: the world map, or their realm. */
  onMap: true,
}));

vi.mock("./next-up-facts", () => ({ useNextUpFacts: () => moves.facts }));
vi.mock("../frontier-home", () => ({ useGoToFrontierPlace: () => moves.goToPlace }));
vi.mock("@/ui/features/military/utils/open-army-deployment", () => ({ openArmyDeployment: moves.deploy }));
vi.mock("@/hooks/helpers/use-navigate", () => ({
  useSelectArmyOnMap: () => moves.selectArmy,
}));
vi.mock("@/play/navigation/open-place", () => ({ openOnMap: vi.fn() }));
vi.mock("../hud/dock-armies", () => ({
  useDockArmies: () => [
    { explorerId: 11, stamina: { current: 20, max: 150 }, canSpendSkillPoint: false },
    { explorerId: 12, stamina: { current: 90, max: 150 }, canSpendSkillPoint: true },
  ],
}));
vi.mock("@/utils/can-issue-orders", () => ({ useActNowRefusal: () => null }));
vi.mock("@/ui/features/frontier/hud/army-order", () => ({ useArmyOrder: () => (moves.pinned ? {} : null) }));
vi.mock("@/shell/frame/layout", () => ({ useLayout: () => moves.layout }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: moves.onMap }) }));

const { FrontierNextUp } = await import("./frontier-next-up");

const MORNING: NextUpFacts = {
  realm: true,
  barracks: true,
  troopsAtHome: 1_500,
  armies: 0,
  armySelected: false,
  armiesTired: false,
  guardInReach: false,
  camp: null,
  armyTierAffordable: false,
  castleAffordable: false,
  typeTierAffordable: null,
  lastHour: false,
  storeFull: null,
  populationFull: false,
};

let host: HTMLDivElement;
let root: Root;
const onSurface = vi.fn();
const onOpenArmy = vi.fn();

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  vi.clearAllMocks();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const show = (
  facts: Partial<NextUpFacts>,
  screen: { pinned?: boolean; layout?: "phone" | "desktop"; onMap?: boolean } = {},
) => {
  moves.facts = { ...MORNING, ...facts };
  moves.pinned = screen.pinned ?? false;
  moves.layout = screen.layout ?? "desktop";
  moves.onMap = screen.onMap ?? true;
  act(() =>
    root.render(
      <FrontierNextUp
        rules={{} as never}
        realm={{ entity_id: 7 } as never}
        onSurface={onSurface}
        onOpenArmy={onOpenArmy}
      />,
    ),
  );
};

const press = (verb: string) =>
  act(() => [...host.querySelectorAll("button")].find((button) => button.textContent === verb)!.click());

it("shows the day's step in the Next up panel, and its button opens the realm's Deploy", () => {
  show({});
  expect(host.querySelector('section[aria-label="Next up"]')?.textContent).toContain("Deploy your armies");
  press("Deploy");
  expect(moves.deploy).toHaveBeenCalledWith({ structureId: 7, isExplorer: true });
});

it("selects the army with the most stamina to explore, and opens the panel of the one whose XP buys a tier", () => {
  show({ armies: 2 });
  press("Select the army");
  expect(moves.selectArmy).toHaveBeenCalledWith(12);

  // One way to the panel: the HUD's pick of the army, never a second open of the surface beside it.
  show({ armies: 2, armyTierAffordable: true });
  press("Open the army");
  expect(onOpenArmy).toHaveBeenCalledOnce();
  expect(onOpenArmy).toHaveBeenCalledWith(12);
  expect(onSurface).not.toHaveBeenCalled();
});

it("opens the realm for barracks, Research where a step names it, and a full store where it is spent", () => {
  show({ barracks: false, armies: 1 });
  press("Open the realm");
  expect(moves.goToPlace).toHaveBeenCalledWith(false);

  show({ armies: 1, armiesTired: true, typeTierAffordable: "farm" });
  press("Research");
  expect(onSurface).toHaveBeenCalledWith("research");

  show({ armies: 1, armiesTired: true, storeFull: "wheat" });
  press("Deploy");
  expect(moves.deploy).toHaveBeenCalledWith({ structureId: 7, isExplorer: true });

  moves.goToPlace.mockClear();
  show({ armies: 1, armiesTired: true, storeFull: "labor" });
  press("Open the realm");
  expect(moves.goToPlace).toHaveBeenCalledWith(false);
});

it("says in the realm how to build the barracks there, with no button back into the realm", () => {
  show({ barracks: false, armies: 1 }, { onMap: false });
  const panel = host.querySelector('section[aria-label="Next up"]')!;
  expect(panel.textContent).toContain("Click an open plot for Barracks");
  expect([...panel.querySelectorAll("button")].map((button) => button.textContent)).not.toContain("Open the realm");
});

it("steps its button down to secondary while a phone's pinned order holds the action, and only then", () => {
  const kindOf = () =>
    host.querySelector<HTMLButtonElement>('section[aria-label="Next up"] [data-kind]:not([data-kind="quiet"])')?.dataset
      .kind;
  show({});
  expect(kindOf()).toBe("primary");
  show({}, { pinned: true, layout: "phone" });
  act(() => host.querySelector<HTMLButtonElement>('button[aria-label^="Next up:"]')!.click());
  expect(kindOf()).toBe("secondary");
  // A desktop's hover names a tile's order without pinning a bar: Next up keeps the action.
  show({}, { pinned: true, layout: "desktop" });
  expect(kindOf()).toBe("primary");
});

it("stands on a phone as its step's one line, a tap from the step and its fold back (mobile direction A)", () => {
  show({ barracks: false, armies: 1 }, { layout: "phone" });
  const pill = () => host.querySelector<HTMLButtonElement>('button[aria-label^="Next up:"]');
  expect(pill()!.textContent).toContain("Build barracks");
  expect(host.querySelector('section[aria-label="Next up"]')).toBeNull();

  act(() => pill()!.click());
  expect(host.querySelector('section[aria-label="Next up"]')!.textContent).toContain("Open the realm");
  act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Fold Next up"]')!.click());
  expect(pill()).not.toBeNull();
});
