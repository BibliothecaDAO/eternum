import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const game = vi.hoisted(() => ({
  mode: "blitz",
  ordersAllowed: true,
  steps: [] as unknown[],
  build: vi.fn(async () => undefined),
  levelUp: vi.fn(),
}));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useResolvedWorldGameMode: () => game.mode }));
vi.mock("@/utils/can-issue-orders", () => ({
  canIssueOrders: () => game.ordersAllowed,
  useActNowRefusal: () => null,
}));
vi.mock("@/ui/features/world/containers/left-facets/use-empire-suggestions", () => ({
  useEmpireSuggestions: () => game.steps,
}));
vi.mock("@/ui/features/world/containers/left-facets/use-suggestion-actions", () => ({
  isOrderSuggestion: (step: { action: string }) => step.action !== "upgrade",
  useSuggestionActions: () => ({ handleSuggestionClick: game.build, pendingSuggestionIds: [] }),
}));
vi.mock("@/ui/modules/entity-details/hooks/use-realm-level-up", () => ({
  useRealmLevelUp: () => ({
    word: "Level up to Kingdom",
    ready: true,
    loading: false,
    refusal: null,
    run: game.levelUp,
  }),
}));

import { BuildOrderPanel } from "./build-order-panel";

const WOOD = {
  id: "1-build-wood",
  realmId: 1,
  realmName: "Egonal",
  action: "build-wood",
  label: "Build wood camp",
  reason: "Wood camps: 1 of 2 built.",
  icon: "wood",
};
const LEVEL_UP = {
  id: "2-upgrade",
  realmId: 2,
  realmName: "Stolsli",
  action: "upgrade",
  label: "Level up realm",
  reason: "It can level up now.",
  icon: "upgrade",
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Object.assign(game, { mode: "blitz", ordersAllowed: true, steps: [WOOD, LEVEL_UP] });
  game.build.mockClear();
  game.levelUp.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const draw = () => act(async () => root.render(<BuildOrderPanel />));
const rows = () =>
  [...host.querySelectorAll(".ui-row")].map((row) => [
    row.querySelector(".ui-row__title")?.textContent,
    row.querySelector(".ui-row__detail")?.textContent,
    row.querySelector("button")?.textContent,
  ]);

it("shows each realm's next step under the default order, and each verb takes it", async () => {
  await draw();
  expect(host.querySelector("section")?.getAttribute("aria-label")).toBe("Build order");
  expect(host.textContent).toContain("Default");
  expect(rows()).toEqual([
    ["Egonal", "Wood camps: 1 of 2 built.", "Build"],
    ["Stolsli", "It can level up now.", "Level up to Kingdom"],
  ]);
  const [build, levelUp] = [...host.querySelectorAll<HTMLButtonElement>(".ui-row button")];
  await act(async () => build.click());
  await act(async () => levelUp.click());
  expect(game.build).toHaveBeenCalledWith(WOOD);
  expect(game.levelUp).toHaveBeenCalledTimes(1);
});

it("says when no realm has a step it can take now", async () => {
  game.steps = [];
  await draw();
  expect(rows()).toEqual([]);
  expect(host.textContent).toContain("Nothing to build now");
});

it("draws nothing where there is no build order to follow: outside a Blitz, or for a viewer who gives no orders", async () => {
  game.mode = "frontier";
  await draw();
  expect(host.innerHTML).toBe("");
  Object.assign(game, { mode: "blitz", ordersAllowed: false });
  await draw();
  expect(host.innerHTML).toBe("");
});
