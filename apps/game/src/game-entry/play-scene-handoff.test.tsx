import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const setShowBlankOverlayMock = vi.fn();
const usePlayerStructuresMock = vi.fn();
const useLocationMock = vi.fn();

const uiStoreState = {
  loadingStates: {
    map: false,
  },
  setShowBlankOverlay: setShowBlankOverlayMock,
};

const snapshotState: any = {
  account: null,
  bootToken: 1,
  currentTask: null,
  error: null,
  phase: "wait_worldmap_ready" as const,
  progress: 92,
  resolvedRequest: {
    bootScene: "map" as const,
    chain: "sepolia",
    entryMode: "player" as const,
    fallbackPolicy: "route" as const,
    requestedScene: "map" as const,
    resumeScene: null,
    routeWorldPosition: { col: 12, row: 34 },
    worldName: "aurora-blitz",
  },
  setupResult: null,
  tasks: [],
};

const readinessState: any = {
  bootToken: 1,
  hexCoordinates: null,
  hexReady: false,
  markHexReady: vi.fn(),
  markWorldmapConverged: vi.fn(),
  markWorldmapReady: vi.fn(),
  reset: vi.fn(),
  worldmapConverged: false,
  worldmapReady: false,
};

vi.mock("@/game-entry/play-route-boot", () => ({
  usePlayRouteBootSnapshot: () => snapshotState,
}));

vi.mock("@/game-entry/play-route-readiness-store", () => ({
  usePlayRouteReadinessStore: () => readinessState,
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (selector: (state: typeof uiStoreState) => unknown) => selector(uiStoreState),
}));

vi.mock("@bibliothecadao/react", () => ({
  usePlayerStructures: () => usePlayerStructuresMock(),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  Position: class MockPosition {
    constructor(private readonly input: { x: number; y: number }) {}

    getNormalized() {
      return { x: this.input.x, y: this.input.y };
    }
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  useLocation: () => useLocationMock(),
}));

const { PlaySceneHandoff } = await import("./play-scene-handoff");

const flushTimers = async () => {
  await act(async () => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });
  });
};

describe("PlaySceneHandoff", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    navigateMock.mockReset();
    setShowBlankOverlayMock.mockReset();
    usePlayerStructuresMock.mockReset();
    readinessState.hexReady = false;
    readinessState.worldmapConverged = false;
    readinessState.worldmapReady = false;
    snapshotState.phase = "wait_worldmap_ready";
    snapshotState.resolvedRequest = {
      bootScene: "map",
      chain: "sepolia",
      entryMode: "player",
      fallbackPolicy: "route",
      requestedScene: "map",
      resumeScene: null,
      routeWorldPosition: { col: 12, row: 34 },
      worldName: "aurora-blitz",
    };
    usePlayerStructuresMock.mockReturnValue([]);
    useLocationMock.mockReturnValue({
      pathname: "/play/appchain/aurora-blitz/map",
      search: "?col=12&row=34",
      hash: "",
      state: null,
      key: "test",
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("completes entry only when the canonical boot phase is ready", async () => {
    readinessState.worldmapReady = true;
    snapshotState.phase = "ready";

    await act(async () => {
      root.render(<PlaySceneHandoff />);
    });
    await flushTimers();

    expect(setShowBlankOverlayMock).toHaveBeenCalledWith(false);
  });

  it("keeps map-first handoff behind ambient worldmap convergence", async () => {
    readinessState.worldmapReady = true;
    snapshotState.phase = "handoff_scene";
    snapshotState.resolvedRequest = {
      ...snapshotState.resolvedRequest,
      requestedScene: "hex",
      resumeScene: "hex",
    };
    useLocationMock.mockReturnValue({
      pathname: "/play/appchain/aurora-blitz/map",
      search: "?col=12&row=34&boot=map-first&resumeScene=hex",
      hash: "",
      state: null,
      key: "test",
    });

    await act(async () => {
      root.render(<PlaySceneHandoff />);
    });

    expect(navigateMock).not.toHaveBeenCalled();
    expect(setShowBlankOverlayMock).not.toHaveBeenCalledWith(false);

    readinessState.worldmapConverged = true;
    await act(async () => {
      root.render(<PlaySceneHandoff />);
    });

    expect(navigateMock).toHaveBeenCalledWith(
      "/play/appchain/aurora-blitz/hex?col=12&row=34&boot=map-first&resumeScene=hex",
      { replace: true },
    );
    expect(setShowBlankOverlayMock).not.toHaveBeenCalledWith(false);
  });

  it("repairs map-first routes without coordinates from synced player structures", async () => {
    usePlayerStructuresMock.mockReturnValue([
      {
        entityId: 77,
        position: { x: 4, y: 9 },
      },
    ]);
    snapshotState.resolvedRequest = {
      ...snapshotState.resolvedRequest,
      fallbackPolicy: "synced-structure",
      routeWorldPosition: null,
    };
    useLocationMock.mockReturnValue({
      pathname: "/play/appchain/aurora-blitz/map",
      search: "?boot=map-first&resumeScene=hex",
      hash: "",
      state: null,
      key: "test",
    });

    await act(async () => {
      root.render(<PlaySceneHandoff />);
    });

    expect(navigateMock).toHaveBeenCalledWith(
      "/play/appchain/aurora-blitz/map?col=4&row=9&boot=map-first&resumeScene=hex",
      { replace: true },
    );
  });
});
