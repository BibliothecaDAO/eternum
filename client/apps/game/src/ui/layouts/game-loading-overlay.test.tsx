import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recordPlayRouteHandoff } from "@/play/navigation/play-route-handoff";

const { waitForHexceptionGridReadyMock, waitForFastTravelSceneReadyMock, waitForWorldmapSceneReadyMock } = vi.hoisted(
  () => ({
    waitForHexceptionGridReadyMock: vi.fn(),
    waitForFastTravelSceneReadyMock: vi.fn(),
    waitForWorldmapSceneReadyMock: vi.fn(),
  }),
);

const navigateMock = vi.fn();
const setShowBlankOverlayMock = vi.fn();
const setStructureEntityIdMock = vi.fn();
const usePlayerStructuresMock = vi.fn();
const useLocationMock = vi.fn();

const uiStoreState = {
  isSpectating: false,
  loadingStates: {},
  setShowBlankOverlay: setShowBlankOverlayMock,
};

const useUIStoreMock = Object.assign(
  vi.fn((selector: (state: typeof uiStoreState) => unknown) => selector(uiStoreState)),
  {
    getState: () => ({
      setStructureEntityId: setStructureEntityIdMock,
    }),
  },
);

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: useUIStoreMock,
}));

vi.mock("@bibliothecadao/react", () => ({
  usePlayerStructures: () => usePlayerStructuresMock(),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  FELT_CENTER: () => 0,
  configManager: {
    getMapCenter: () => 0,
  },
  Position: class MockPosition {
    private readonly x: number;
    private readonly y: number;

    constructor({ x, y }: { x: number; y: number }) {
      this.x = x;
      this.y = y;
    }

    getNormalized() {
      return { x: this.x, y: this.y };
    }

    getContract() {
      return { x: this.x + 100, y: this.y + 100 };
    }
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  useLocation: () => useLocationMock(),
}));

vi.mock("./game-loading-overlay.utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./game-loading-overlay.utils")>();
  return {
    ...actual,
    waitForHexceptionGridReady: (...args: Parameters<typeof actual.waitForHexceptionGridReady>) =>
      waitForHexceptionGridReadyMock(...args),
    waitForFastTravelSceneReady: (...args: Parameters<typeof actual.waitForFastTravelSceneReady>) =>
      waitForFastTravelSceneReadyMock(...args),
    waitForWorldmapSceneReady: (...args: Parameters<typeof actual.waitForWorldmapSceneReady>) =>
      waitForWorldmapSceneReadyMock(...args),
  };
});

const { GameLoadingOverlay } = await import("./game-loading-overlay");

const flushOverlayTimers = async () => {
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
    setStructureEntityIdMock.mockReset();
    usePlayerStructuresMock.mockReset();
    useLocationMock.mockReset();
    waitForHexceptionGridReadyMock.mockReset();
    waitForFastTravelSceneReadyMock.mockReset();
    waitForWorldmapSceneReadyMock.mockReset();
    uiStoreState.isSpectating = false;
    uiStoreState.loadingStates = {};
    sessionStorage.clear();
    waitForHexceptionGridReadyMock.mockResolvedValue(true);
    waitForFastTravelSceneReadyMock.mockResolvedValue(true);
    waitForWorldmapSceneReadyMock.mockResolvedValue(true);
    useLocationMock.mockReturnValue({ pathname: "/play/hex", search: "", hash: "", state: null, key: "test" });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("preserves a canonical player hex resume route on reload", async () => {
    useLocationMock.mockReturnValue({
      pathname: "/play/sepolia/aurora-blitz/hex",
      search: "?col=4&row=9",
      hash: "",
      state: null,
      key: "test",
    });
    usePlayerStructuresMock.mockReturnValue([
      {
        entityId: 77,
        position: { x: 4, y: 9 },
      },
    ]);

    await act(async () => {
      root.render(<GameLoadingOverlay />);
    });
    await flushOverlayTimers();

    expect(navigateMock).not.toHaveBeenCalled();
    expect(setStructureEntityIdMock).toHaveBeenCalledWith(77, {
      spectator: false,
      worldMapPosition: { col: 4, row: 9 },
    });
    expect(waitForHexceptionGridReadyMock).toHaveBeenCalledWith({ col: 104, row: 109 }, 1200);
  });

  it("does not redirect away from a canonical world map deep link once player structures sync", async () => {
    useLocationMock.mockReturnValue({
      pathname: "/play/sepolia/aurora-blitz/map",
      search: "?col=12&row=34",
      hash: "",
      state: null,
      key: "test",
    });
    usePlayerStructuresMock.mockReturnValue([
      {
        entityId: 77,
        position: { x: 4, y: 9 },
      },
    ]);

    await act(async () => {
      root.render(<GameLoadingOverlay />);
    });
    await flushOverlayTimers();

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("dismisses a canonical world map resume once the scene is ready even before player structures sync", async () => {
    useLocationMock.mockReturnValue({
      pathname: "/play/sepolia/aurora-blitz/map",
      search: "?col=12&row=34",
      hash: "",
      state: null,
      key: "test",
    });
    usePlayerStructuresMock.mockReturnValue([]);

    await act(async () => {
      root.render(<GameLoadingOverlay />);
    });
    await flushOverlayTimers();

    expect(setShowBlankOverlayMock).toHaveBeenCalledWith(false);
  });

  it("still rewrites first landing entry into the world map handoff", async () => {
    recordPlayRouteHandoff({
      chain: "sepolia",
      worldName: "aurora-blitz",
      scene: "hex",
      col: 4,
      row: 9,
      spectate: false,
    });
    useLocationMock.mockReturnValue({
      pathname: "/play/sepolia/aurora-blitz/hex",
      search: "?col=4&row=9",
      hash: "",
      state: null,
      key: "test",
    });
    usePlayerStructuresMock.mockReturnValue([
      {
        entityId: 77,
        position: { x: 4, y: 9 },
      },
    ]);

    await act(async () => {
      root.render(<GameLoadingOverlay />);
    });
    await flushOverlayTimers();

    expect(navigateMock).toHaveBeenCalledWith("/play/sepolia/aurora-blitz/map?col=4&row=9");
  });

  it("rewrites the first landing handoff into the world map immediately when the route already has coordinates", async () => {
    recordPlayRouteHandoff({
      chain: "mainnet",
      worldName: "bltz-blink-770",
      scene: "hex",
      col: 0,
      row: 0,
      spectate: false,
    });
    useLocationMock.mockReturnValue({
      pathname: "/play/mainnet/bltz-blink-770/hex",
      search: "?col=0&row=0",
      hash: "",
      state: null,
      key: "test",
    });
    usePlayerStructuresMock.mockReturnValue([]);

    await act(async () => {
      root.render(<GameLoadingOverlay />);
    });
    await flushOverlayTimers();

    expect(navigateMock).toHaveBeenCalledWith("/play/mainnet/bltz-blink-770/map?col=0&row=0");
  });

  it("preserves a canonical fast-travel resume route on reload", async () => {
    useLocationMock.mockReturnValue({
      pathname: "/play/sepolia/aurora-blitz/travel",
      search: "?col=4&row=9",
      hash: "",
      state: null,
      key: "test",
    });
    usePlayerStructuresMock.mockReturnValue([
      {
        entityId: 77,
        position: { x: 4, y: 9 },
      },
    ]);

    await act(async () => {
      root.render(<GameLoadingOverlay />);
    });
    await flushOverlayTimers();

    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("keeps the overlay up when a hex resume never reports scene readiness", async () => {
    waitForHexceptionGridReadyMock.mockResolvedValue(false);
    useLocationMock.mockReturnValue({
      pathname: "/play/sepolia/aurora-blitz/hex",
      search: "?col=4&row=9",
      hash: "",
      state: null,
      key: "test",
    });
    usePlayerStructuresMock.mockReturnValue([
      {
        entityId: 77,
        position: { x: 4, y: 9 },
      },
    ]);

    await act(async () => {
      root.render(<GameLoadingOverlay />);
    });
    await flushOverlayTimers();

    expect(setShowBlankOverlayMock).not.toHaveBeenCalled();
  });

  it("keeps the overlay up when a fast-travel resume times out waiting for scene readiness", async () => {
    waitForFastTravelSceneReadyMock.mockResolvedValue(false);
    useLocationMock.mockReturnValue({
      pathname: "/play/sepolia/aurora-blitz/travel",
      search: "?col=4&row=9",
      hash: "",
      state: null,
      key: "test",
    });
    usePlayerStructuresMock.mockReturnValue([
      {
        entityId: 77,
        position: { x: 4, y: 9 },
      },
    ]);

    await act(async () => {
      root.render(<GameLoadingOverlay />);
    });
    await flushOverlayTimers();

    expect(setShowBlankOverlayMock).not.toHaveBeenCalled();
  });
});
