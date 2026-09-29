import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const boot = vi.hoisted(() => ({
  snapshot: {
    phase: "handoff_scene",
    resolvedRequest: { entryMode: "player", resumeScene: "hex" },
  } as Record<string, unknown>,
}));
vi.mock("@/game-entry/play-route-boot", () => ({ usePlayRouteBootSnapshot: () => boot.snapshot }));
const facts = vi.hoisted(() => ({ own: [] as unknown[], all: [] as unknown[] }));
vi.mock("@/hooks/helpers/use-structures", () => ({ usePlayerStructures: () => facts.own }));
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => facts.all }));
vi.mock("@/ui/layouts/game-entry-timeline", () => ({ markGameEntryMilestone: () => {} }));

import { usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { overrideSpectateIntent } from "@/utils/spectator-session";
import { PlaySceneHandoff } from "./play-scene-handoff";

const GAME = "/g/0x5245414c4d53/1";
const ENTRY = `${GAME}/map?col=-1882578126&row=-1882626526&boot=map-first&resumeScene=hex`;

const Where = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
};

afterEach(() => {
  useUIStore.setState({ structureEntityId: 0, isSpectating: false, worldMapReturnPosition: null });
  facts.own = [];
  facts.all = [];
});

const convergedMap = () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  overrideSpectateIntent(false);
  usePlayRouteReadinessStore.getState().reset(1);
  usePlayRouteReadinessStore.getState().markWorldmapReady(1);
  usePlayRouteReadinessStore.getState().markWorldmapConverged(1);
};

const mountHandoff = async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[ENTRY]}>
        <PlaySceneHandoff />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
  return {
    where: () => new URL(container.querySelector("[data-testid='where']")!.textContent!, "https://realms.invalid"),
    unmount: () => act(async () => root.unmount()),
  };
};

it("hands a Frontier player off to their own realm's hex, and not before their realm is selected", async () => {
  convergedMap();
  facts.own = [{ entityId: 1, position: { x: 1, y: 1 } }];
  // The map converged while the entry still shows the spectator fallback, before the player's realm arrived.
  useUIStore.setState({ structureEntityId: 7, isSpectating: true, worldMapReturnPosition: { col: 5, row: 6 } });
  const ui = await mountHandoff();
  try {
    expect(`${ui.where().pathname}${ui.where().search}`).toBe(ENTRY);

    // The player's own realm is selected at today's site: the handoff opens it there.
    await act(async () =>
      useUIStore.setState({ structureEntityId: 1, isSpectating: false, worldMapReturnPosition: { col: 12, row: -3 } }),
    );
    expect(ui.where().pathname).toBe(`${GAME}/hex`);
    expect([ui.where().searchParams.get("col"), ui.where().searchParams.get("row")]).toEqual(["12", "-3"]);
    expect(ui.where().searchParams.get("resumeScene")).toBe("hex");
  } finally {
    await ui.unmount();
  }
});

it("keeps a player with no realm to open on the map, dropping the resume instead of waiting", async () => {
  convergedMap();
  const ui = await mountHandoff();
  try {
    expect(ui.where().pathname).toBe(`${GAME}/map`);
    expect(ui.where().searchParams.get("boot")).toBeNull();
    expect(ui.where().searchParams.get("resumeScene")).toBeNull();
  } finally {
    await ui.unmount();
  }
});
