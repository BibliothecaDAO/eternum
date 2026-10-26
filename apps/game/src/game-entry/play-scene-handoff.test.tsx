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
const facts = vi.hoisted(() => ({ own: [] as unknown[] }));
vi.mock("@/hooks/helpers/use-structures", () => ({ usePlayerStructures: () => facts.own }));
vi.mock("@/ui/layouts/game-entry-timeline", () => ({ markGameEntryMilestone: () => {} }));

import { resetEntryDestination, settleEntryDestination } from "@/game-entry/entry-destination";
import { usePlayRouteReadinessStore } from "@/game-entry/play-route-readiness-store";
import { Position } from "@bibliothecadao/eternum";
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
  resetEntryDestination();
});

/** The entry's answer for its realm, as the boot's structure choice gives it (initial-structure.ts). */
const entryOpens = (destination: Position | null) => act(async () => settleEntryDestination(destination));

const convergedMap = () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  overrideSpectateIntent(false);
  const token = usePlayRouteReadinessStore.getState().startBoot();
  usePlayRouteReadinessStore.getState().markWorldmapReady(token);
  usePlayRouteReadinessStore.getState().markWorldmapConverged(token);
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
    expect(`${ui.where().pathname}${ui.where().search}`).toBe(ENTRY);
    await entryOpens(Position.fromContract({ x: 1, y: 1 }));
    expect(ui.where().pathname).toBe(`${GAME}/hex`);
    expect([ui.where().searchParams.get("col"), ui.where().searchParams.get("row")]).toEqual(["12", "-3"]);
    expect(ui.where().searchParams.get("resumeScene")).toBe("hex");
  } finally {
    await ui.unmount();
  }
});

it("hands a spectator off to the realm they watch when it arrives after the map converged", async () => {
  convergedMap();
  boot.snapshot = { ...boot.snapshot, resolvedRequest: { entryMode: "spectator", resumeScene: "hex" } };
  const ui = await mountHandoff();
  try {
    // A Frontier spectator's realm streams in with the leader's visit, after the snapshot and after the map converged.
    expect(`${ui.where().pathname}${ui.where().search}`).toBe(ENTRY);

    await act(async () =>
      useUIStore.setState({ structureEntityId: 5, isSpectating: true, worldMapReturnPosition: { col: 3, row: 4 } }),
    );
    await entryOpens(Position.fromContract({ x: 5, y: 8850 }));

    expect(ui.where().pathname).toBe(`${GAME}/hex`);
    expect([ui.where().searchParams.get("col"), ui.where().searchParams.get("row")]).toEqual(["3", "4"]);
  } finally {
    boot.snapshot = { ...boot.snapshot, resolvedRequest: { entryMode: "player", resumeScene: "hex" } };
    await ui.unmount();
  }
});

it("keeps a player with no realm to open on the map, dropping the resume instead of waiting", async () => {
  convergedMap();
  const ui = await mountHandoff();
  try {
    expect(`${ui.where().pathname}${ui.where().search}`).toBe(ENTRY);
    await entryOpens(null);
    expect(ui.where().pathname).toBe(`${GAME}/map`);
    expect(ui.where().searchParams.get("boot")).toBeNull();
    expect(ui.where().searchParams.get("resumeScene")).toBeNull();
  } finally {
    await ui.unmount();
  }
});
