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
  fastTravelReady: false,
  hexCoordinates: null,
  hexReady: false,
  markFastTravelReady: vi.fn(),
  markHexReady: vi.fn(),
  markWorldmapReady: vi.fn(),
  reset: vi.fn(),
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

vi.mock("@/ui/modules/boot-loader", () => ({
  BootLoaderShell: ({ title, subtitle }: { title?: string; subtitle?: string }) => (
    <div>
      <div>{title}</div>
      <div>{subtitle}</div>
    </div>
  ),
}));

const { GameLoadingOverlay } = await import("./game-loading-overlay");

const flushTimers = async () => {
  await act(async () => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });
  });
};

describe("GameLoadingOverlay", () => {
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
    readinessState.fastTravelReady = false;
    readinessState.hexReady = false;
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
      pathname: "/play/sepolia/aurora-blitz/map",
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

  it("dismisses once the shared worldmap readiness state is set", async () => {
    readinessState.worldmapReady = true;
    snapshotState.phase = "ready";

    await act(async () => {
      root.render(<GameLoadingOverlay />);
    });
    await flushTimers();

    expect(setShowBlankOverlayMock).toHaveBeenCalledWith(false);
  });

  it("hands off from canonical map-first boot routes into the requested scene", async () => {
    readinessState.worldmapReady = true;
    snapshotState.phase = "handoff_scene";
    snapshotState.resolvedRequest = {
      ...snapshotState.resolvedRequest,
      requestedScene: "hex",
      resumeScene: "hex",
    };
    useLocationMock.mockReturnValue({
      pathname: "/play/sepolia/aurora-blitz/map",
      search: "?col=12&row=34&boot=map-first&resumeScene=hex",
      hash: "",
      state: null,
      key: "test",
    });

    await act(async () => {
      root.render(<GameLoadingOverlay />);
    });

    expect(navigateMock).toHaveBeenCalledWith(
      "/play/sepolia/aurora-blitz/hex?col=12&row=34&boot=map-first&resumeScene=hex",
      { replace: true },
    );
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
      pathname: "/play/sepolia/aurora-blitz/map",
      search: "?boot=map-first&resumeScene=hex",
      hash: "",
      state: null,
      key: "test",
    });

    await act(async () => {
      root.render(<GameLoadingOverlay />);
    });

    expect(navigateMock).toHaveBeenCalledWith(
      "/play/sepolia/aurora-blitz/map?col=4&row=9&boot=map-first&resumeScene=hex",
      { replace: true },
    );
  });
});
