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
}));

vi.mock("./next-up-facts", () => ({ useNextUpFacts: () => moves.facts }));
vi.mock("../frontier-home", () => ({ useGoToFrontierPlace: () => moves.goToPlace }));
vi.mock("@/ui/features/military/utils/open-army-deployment", () => ({ openArmyDeployment: moves.deploy }));
vi.mock("@/hooks/helpers/use-navigate", () => ({
  useSelectArmyOnMap: () => moves.selectArmy,
  useNavigateToMapView: () => vi.fn(),
}));
vi.mock("../hud/dock-armies", () => ({
  useDockArmies: () => [
    { explorerId: 11, stamina: { current: 20, max: 150 }, canBuyTier: false },
    { explorerId: 12, stamina: { current: 90, max: 150 }, canBuyTier: true },
  ],
}));
vi.mock("@/utils/can-issue-orders", () => ({ useActNowRefusal: () => null }));
vi.mock("@/ui/features/frontier/hud/army-order", () => ({ useArmyOrder: () => (moves.pinned ? {} : null) }));
vi.mock("@/shell/frame/layout", () => ({ useLayout: () => moves.layout }));

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
  rules: { hutAdds: 6, stamina: { explore: 30, anHour: 30 }, xp: { reveal: 2 }, homecomingPercent: 3 },
};

let host: HTMLDivElement;
let root: Root;
const onSurface = vi.fn();

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

const show = (facts: Partial<NextUpFacts>, screen: { pinned?: boolean; layout?: "phone" | "desktop" } = {}) => {
  moves.facts = { ...MORNING, ...facts };
  moves.pinned = screen.pinned ?? false;
  moves.layout = screen.layout ?? "desktop";
  act(() =>
    root.render(<FrontierNextUp rules={{} as never} realm={{ entity_id: 7 } as never} onSurface={onSurface} />),
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

it("selects the army with the most stamina to explore, and opens the sheet of the one whose XP buys a tier", () => {
  show({ armies: 2 });
  press("Select the army");
  expect(moves.selectArmy).toHaveBeenCalledWith(12);

  show({ armies: 2, armyTierAffordable: true });
  press("Open the army");
  expect(moves.selectArmy).toHaveBeenLastCalledWith(12);
  expect(onSurface).toHaveBeenCalledWith("army");
});

it("opens the realm for barracks, and Research and Production where a step names them", () => {
  show({ barracks: false, armies: 1 });
  press("Open the realm");
  expect(moves.goToPlace).toHaveBeenCalledWith(false);

  show({ armies: 1, armiesTired: true, typeTierAffordable: "farm" });
  press("Research");
  expect(onSurface).toHaveBeenCalledWith("research");

  show({ armies: 1, armiesTired: true, storeFull: "wheat" });
  press("Production");
  expect(onSurface).toHaveBeenCalledWith("production");
});

it("steps its button down to secondary while a phone's pinned order holds the action, and only then", () => {
  const kindOf = () =>
    host.querySelector<HTMLButtonElement>('section[aria-label="Next up"] [data-kind]:not([data-kind="quiet"])')?.dataset
      .kind;
  show({});
  expect(kindOf()).toBe("primary");
  show({}, { pinned: true, layout: "phone" });
  expect(kindOf()).toBe("secondary");
  // A desktop's hover names a tile's order without pinning a bar: Next up keeps the action.
  show({}, { pinned: true, layout: "desktop" });
  expect(kindOf()).toBe("primary");
});
