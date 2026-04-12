import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  useLocation: () => useLocationMock(),
}));

const { GameLoadingOverlay } = await import("./game-loading-overlay");

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
    uiStoreState.isSpectating = false;
    uiStoreState.loadingStates = {};
    useLocationMock.mockReturnValue({ pathname: "/play/hex", search: "", hash: "", state: null, key: "test" });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("opens player first load on the world map while selecting the first synced realm", async () => {
    useLocationMock.mockReturnValue({
      pathname: "/play/sepolia/aurora-blitz/hex",
      search: "",
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

    expect(setStructureEntityIdMock).toHaveBeenCalledWith(77, {
      spectator: false,
      worldMapPosition: { col: 4, row: 9 },
    });
    expect(navigateMock).toHaveBeenCalledWith("/play/sepolia/aurora-blitz/map?col=4&row=9");
    expect(container.textContent).toContain("Entering the Realm");
    expect(container.textContent).toContain("Assembling the known world");
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

    expect(navigateMock).not.toHaveBeenCalled();
  });
});
