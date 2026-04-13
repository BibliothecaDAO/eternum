import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAccountMock = vi.fn();
const useConnectMock = vi.fn();
const useControllerAccountMock = vi.fn();
const useCartridgeUsernameMock = vi.fn();
const useAccountStoreMock = vi.fn();
const useUIStoreMock = vi.fn();
const useEagerBootstrapMock = vi.fn();
const parsePlayRouteMock = vi.fn();
const getActiveWorldMock = vi.fn();
const setActiveWorldNameMock = vi.fn();
const useSpectatorModeClickMock = vi.fn();

vi.mock("@starknet-react/core", () => ({
  useAccount: () => useAccountMock(),
  useConnect: () => useConnectMock(),
}));

vi.mock("starknet", () => ({
  Account: class MockAccount {
    constructor(public readonly value: unknown) {
      this.value = value;
    }
  },
}));

vi.mock("@/hooks/context/use-controller-account", () => ({
  useControllerAccount: () => useControllerAccountMock(),
}));

vi.mock("@/hooks/context/controller-connect", () => ({
  connectWithControllerRetry: vi.fn(),
  pickPrimaryConnector: vi.fn(),
}));

vi.mock("@/hooks/helpers/use-navigate", () => ({
  useSpectatorModeClick: () => useSpectatorModeClickMock(),
}));

vi.mock("@/hooks/use-cartridge-username", () => ({
  useCartridgeUsername: () => useCartridgeUsernameMock(),
}));

vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (selector: (state: { setAccountName: ReturnType<typeof vi.fn> }) => unknown) =>
    useAccountStoreMock(selector),
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (
    selector: (state: { showBlankOverlay: boolean; setShowBlankOverlay: ReturnType<typeof vi.fn> }) => unknown,
  ) => useUIStoreMock(selector),
}));

vi.mock("./use-eager-bootstrap", () => ({
  useEagerBootstrap: () => useEagerBootstrapMock(),
}));

vi.mock("@/play/navigation/play-route", () => ({
  parsePlayRoute: (...args: unknown[]) => parsePlayRouteMock(...args),
}));

vi.mock("@/runtime/world", () => ({
  getActiveWorld: () => getActiveWorldMock(),
  setActiveWorldName: (...args: unknown[]) => setActiveWorldNameMock(...args),
}));

const HookProbe = () => {
  const { phase } = useUnifiedOnboarding("bg.png");
  return <div>{phase}</div>;
};

const { useUnifiedOnboarding } = await import("./use-unified-onboarding");

describe("useUnifiedOnboarding", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useAccountMock.mockReset();
    useConnectMock.mockReset();
    useControllerAccountMock.mockReset();
    useCartridgeUsernameMock.mockReset();
    useAccountStoreMock.mockReset();
    useUIStoreMock.mockReset();
    useEagerBootstrapMock.mockReset();
    parsePlayRouteMock.mockReset();
    getActiveWorldMock.mockReset();
    setActiveWorldNameMock.mockReset();
    useSpectatorModeClickMock.mockReset();

    useAccountMock.mockReturnValue({ isConnected: true, isConnecting: false });
    useConnectMock.mockReturnValue({ connectAsync: vi.fn(), connectors: [] });
    useControllerAccountMock.mockReturnValue({ address: "0x123" });
    useCartridgeUsernameMock.mockReturnValue({ username: null });
    useAccountStoreMock.mockImplementation(
      (selector: (state: { setAccountName: ReturnType<typeof vi.fn> }) => unknown) =>
        selector({ setAccountName: vi.fn() }),
    );
    useUIStoreMock.mockImplementation(
      (selector: (state: { showBlankOverlay: boolean; setShowBlankOverlay: ReturnType<typeof vi.fn> }) => unknown) =>
        selector({ showBlankOverlay: true, setShowBlankOverlay: vi.fn() }),
    );
    useEagerBootstrapMock.mockReturnValue({
      status: "loading",
      setupResult: null,
      progress: 0,
      tasks: [],
      currentTask: null,
      error: null,
      retry: vi.fn(),
      startBootstrap: vi.fn(),
    });
    parsePlayRouteMock.mockReturnValue({
      chain: "mainnet",
      worldName: "iron-age",
      scene: "hex",
      col: 4,
      row: 9,
      spectate: false,
    });
    getActiveWorldMock.mockReturnValue(null);
    useSpectatorModeClickMock.mockReturnValue(vi.fn());
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("skips avatar gating during direct play-route resume", async () => {
    await act(async () => {
      root.render(<HookProbe />);
    });

    expect(container.textContent).toBe("loading");
  });
});
