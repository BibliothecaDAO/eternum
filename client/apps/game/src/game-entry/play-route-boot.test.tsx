import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connectAsyncMock = vi.fn();
const retryMock = vi.fn();
const setAccountNameMock = vi.fn();
const setShowBlankOverlayMock = vi.fn();
const useGameEntryBootstrapControllerMock = vi.fn();

vi.mock("@starknet-react/core", () => ({
  useAccount: () => ({
    account: null,
    connector: null,
    isConnected: false,
    isConnecting: false,
  }),
  useConnect: () => ({
    connectAsync: connectAsyncMock,
    connectors: [],
  }),
}));

vi.mock("@/game-entry/bootstrap-controller", () => ({
  useGameEntryBootstrapController: (...args: unknown[]) => useGameEntryBootstrapControllerMock(...args),
}));

vi.mock("@/hooks/context/use-controller-account", () => ({
  useControllerAccount: () => null,
}));

vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (selector: (state: { setAccountName: typeof setAccountNameMock }) => unknown) =>
    selector({ setAccountName: setAccountNameMock }),
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (
    selector: (state: { setShowBlankOverlay: typeof setShowBlankOverlayMock; showBlankOverlay: boolean }) => unknown,
  ) =>
    selector({
      setShowBlankOverlay: setShowBlankOverlayMock,
      showBlankOverlay: false,
    }),
}));

vi.mock("@/hooks/use-cartridge-username", () => ({
  useCartridgeUsername: () => ({ username: null }),
}));

const { usePlayRouteBootController } = await import("./play-route-boot");
const { usePlayRouteReadinessStore } = await import("./play-route-readiness-store");

const BootControllerHarness = () => {
  usePlayRouteBootController();
  return null;
};

const createIdleBootstrapControllerState = () => ({
  currentTask: null,
  error: null,
  progress: 0,
  retry: retryMock,
  session: null,
  setupResult: null,
  start: vi.fn(),
  status: "idle",
  tasks: [],
});

const getRenderPhaseUpdateWarnings = (consoleErrorMock: ReturnType<typeof vi.spyOn>) =>
  consoleErrorMock.mock.calls.filter(([message]) => String(message).includes("Cannot update a component"));

describe("usePlayRouteBootController", () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleErrorMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});

    connectAsyncMock.mockReset();
    retryMock.mockReset();
    setAccountNameMock.mockReset();
    setShowBlankOverlayMock.mockReset();
    useGameEntryBootstrapControllerMock.mockReset();
    useGameEntryBootstrapControllerMock.mockReturnValue(createIdleBootstrapControllerState());
    usePlayRouteReadinessStore.getState().reset(0);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    consoleErrorMock.mockRestore();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("resets play-route readiness without updating the store during render", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/mainnet/iron-age/map"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    expect(getRenderPhaseUpdateWarnings(consoleErrorMock)).toEqual([]);
    expect(usePlayRouteReadinessStore.getState().bootToken).toBe(1);
    expect(setShowBlankOverlayMock).toHaveBeenCalledWith(true);
  });
});
