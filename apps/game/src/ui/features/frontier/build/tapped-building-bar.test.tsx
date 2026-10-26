// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BuildingType } from "@bibliothecadao/types";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

/** The realm's standing buildings by plot, as the store holds them, and the game's demolish. */
const game = vi.hoisted(() => ({
  buildings: new Map<string, number>(),
  destroyBuilding: vi.fn(async () => undefined),
}));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({ id: "frontier" }) }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      store: {
        get: (_model: string, key: { inner_col: number; inner_row: number }) => {
          const category = game.buildings.get(`${key.inner_col}:${key.inner_row}`);
          return category === undefined ? undefined : { category };
        },
      },
    },
  }),
}));
vi.mock("@/sync/active-game-client", () => ({
  requireActiveGameClient: () => ({ actions: { destroyBuilding: game.destroyBuilding } }),
}));

const { TappedBuildingBar } = await import("./tapped-building-bar");

const REALM = { game_id: 1, entity_id: 7n } as never;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  game.buildings = new Map([["11:10", BuildingType.ResourceWheat]]);
  game.destroyBuilding.mockClear();
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => act(() => root.unmount()));

/** The Farm the player tapped on plot (11, 10), which opened Research on its row. */
const FARM = { category: BuildingType.ResourceWheat, innerCol: 11, innerRow: 10 };
const draw = () => act(() => root.render(<TappedBuildingBar realm={REALM} building={FARM} />));
const press = (label: string) =>
  act(async () => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click());

it("demolishes the Farm tapped on the board once its Delete is confirmed, as a loss asks in Frontier", async () => {
  draw();
  expect(host.textContent).toContain("Farm");
  await press("Delete");
  expect(game.destroyBuilding).not.toHaveBeenCalled();
  await press("Confirm delete");
  expect(game.destroyBuilding).toHaveBeenCalledWith({ structureId: 7, hex: { col: 11, row: 10 } });
});

it("goes once the Farm no longer stands on its plot, demolished or replaced", () => {
  draw();
  expect(host.textContent).toContain("Farm");
  game.buildings.delete("11:10");
  draw();
  expect(host.textContent).toBe("");
  game.buildings.set("11:10", BuildingType.WorkersHut);
  draw();
  expect(host.textContent).toBe("");
});
