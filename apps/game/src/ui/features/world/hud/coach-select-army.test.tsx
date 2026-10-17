// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const ARMY = 7;
const ARMY_TILE = { col: 4, row: 5 };
const CRATE_TILE = { col: 9, row: 5 };

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { store: { entityOccupancy: () => ({ ...ARMY_TILE, alt: false }) } } }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 1000,
  useNowMs: () => 1_000_000,
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => [] }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({}) }));
vi.mock("@bibliothecadao/eternum/game-sync", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getActiveGameSyncRuntime: () => null,
}));
// The route is the coach's own (coach.test.ts): here, one step that sends army 7 to a crate on another tile.
vi.mock("./coach", () => ({
  coachSteps: () => [
    {
      key: "coach:crate",
      line: "Open the relic crate",
      verb: "Show the crate",
      act: { kind: "go", armyId: 7, target: { col: 9, row: 5 } },
    },
  ],
}));

import { configManager } from "@bibliothecadao/eternum";
import { ARMY_SELECT_REQUEST_EVENT, takeArmySelectRequest } from "@/three/scenes/worldmap-army-select-request";
import { useCoachSteps } from "./use-coach-steps";

/** The world map as WorldmapScene takes a request: at once while it is the shown scene, else when it is shown. */
const worldMap = { shown: false, taken: [] as Array<ReturnType<typeof takeArmySelectRequest>> };
const takeIfShown = () => {
  if (worldMap.shown) worldMap.taken.push(takeArmySelectRequest());
};
const showMap = () => {
  worldMap.shown = true;
  worldMap.taken.push(takeArmySelectRequest());
};

const Probe = () => {
  const [step] = useCoachSteps();
  if (step.kind !== "order" || !step.run) throw new Error("The coach's step has no button");
  return <button onClick={step.run}>{step.verb}</button>;
};

const pressStep = async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() => root.render(<Probe />));
  await act(async () => host.querySelector("button")!.click());
  act(() => root.unmount());
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(configManager, "getMapCenter").mockReturnValue(0);
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  vi.spyOn(configManager, "getVictoryPointGrants").mockReturnValue({
    exploreTile: 5,
    openRelicCrate: 250,
    claimCampFromBandits: 250,
    claimHyperstructureFromBandits: 1000,
    hyperstructurePerSecond: 1,
    hyperstructureScale: "per-realm",
  });
  worldMap.taken = [];
  window.addEventListener(ARMY_SELECT_REQUEST_EVENT, takeIfShown);
});

afterEach(() => {
  window.removeEventListener(ARMY_SELECT_REQUEST_EVENT, takeIfShown);
  takeArmySelectRequest();
  vi.restoreAllMocks();
});

it("from the realm view, opens the map at the army and has it selected there once shown, its target's card open", async () => {
  window.history.replaceState({}, "", "/g/0xa1/1/hex");
  worldMap.shown = false;
  await pressStep();
  expect(window.location.pathname).toBe("/g/0xa1/1/map");
  expect(worldMap.taken).toEqual([]);
  showMap();
  expect(worldMap.taken).toEqual([{ entityId: ARMY, forSite: CRATE_TILE }]);
});

it("on the world map, has the army selected at once, its target's card open, and nothing left for later", async () => {
  window.history.replaceState({}, "", "/g/0xa1/1/map");
  worldMap.shown = true;
  await pressStep();
  expect(worldMap.taken).toEqual([{ entityId: ARMY, forSite: CRATE_TILE }]);
  expect(takeArmySelectRequest()).toBeNull();
});
