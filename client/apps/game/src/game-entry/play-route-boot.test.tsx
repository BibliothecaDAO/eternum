import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useNavigate, type NavigateFunction } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SetupResult } from "@/init/bootstrap";

const connectAsyncMock = vi.fn();
const retryMock = vi.fn();
const setAccountNameMock = vi.fn();
const setShowBlankOverlayMock = vi.fn();
const useGameEntryBootstrapControllerMock = vi.fn();
const uiStoreState = vi.hoisted(() => ({
  showBlankOverlay: false,
}));
const starknetReactState = vi.hoisted(() => ({
  account: null as unknown,
  connector: null as unknown,
  controllerAccount: null as unknown,
  connectors: [] as unknown[],
  isConnected: false,
  isConnecting: false,
}));

vi.mock("@starknet-react/core", () => ({
  useAccount: () => ({
    account: starknetReactState.account,
    connector: starknetReactState.connector,
    isConnected: starknetReactState.isConnected,
    isConnecting: starknetReactState.isConnecting,
  }),
  useConnect: () => ({
    connectAsync: connectAsyncMock,
    connectors: starknetReactState.connectors,
  }),
}));

vi.mock("starknet", () => ({
  Account: class {},
}));

vi.mock("@/game-entry/bootstrap-controller", () => ({
  useGameEntryBootstrapController: (...args: unknown[]) => useGameEntryBootstrapControllerMock(...args),
}));

vi.mock("@/config/game-modes", () => ({
  getGameModeId: () => "eternum",
}));

vi.mock("@/hooks/context/use-controller-account", () => ({
  useControllerAccount: () => starknetReactState.controllerAccount,
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
      showBlankOverlay: uiStoreState.showBlankOverlay,
    }),
}));

vi.mock("@/hooks/use-cartridge-username", () => ({
  useCartridgeUsername: () => ({ username: null }),
}));

const { usePlayRouteBootController } = await import("./play-route-boot");
const { usePlayRouteReadinessStore } = await import("./play-route-readiness-store");

let latestBootController: ReturnType<typeof usePlayRouteBootController> | null = null;
let navigate: NavigateFunction | null = null;

const BootControllerHarness = () => {
  navigate = useNavigate();
  latestBootController = usePlayRouteBootController();
  return null;
};

type BootstrapControllerTestState = {
  currentTask: string | null;
  error: Error | null;
  progress: number;
  retry: typeof retryMock;
  session: null;
  setupResult: SetupResult | null;
  start: ReturnType<typeof vi.fn>;
  status: "idle" | "ready";
  tasks: [];
};

const createIdleBootstrapControllerState = (): BootstrapControllerTestState => ({
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

const createSetupResult = (): SetupResult =>
  ({
    network: {
      provider: {
        provider: {},
      },
    },
  }) as SetupResult;

let bootstrapControllerState: BootstrapControllerTestState;

const getRenderPhaseUpdateWarnings = (consoleErrorMock: ReturnType<typeof vi.spyOn>) =>
  consoleErrorMock.mock.calls.filter(([message]) => String(message).includes("Cannot update a component"));

const getLatestBootstrapControllerInput = () => {
  const calls = useGameEntryBootstrapControllerMock.mock.calls;
  return calls[calls.length - 1]?.[0] as
    | { context: { chain: string; intent: string; worldName: string } | null; enabled: boolean }
    | undefined;
};

describe("usePlayRouteBootController", () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleErrorMock: ReturnType<typeof vi.spyOn>;

  const renderPlayerRoute = async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/mainnet/iron-age/map"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });
  };

  const advanceTimers = async (milliseconds: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(milliseconds);
    });
  };

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
    bootstrapControllerState = createIdleBootstrapControllerState();
    useGameEntryBootstrapControllerMock.mockImplementation(() => bootstrapControllerState);
    uiStoreState.showBlankOverlay = false;
    starknetReactState.account = null;
    starknetReactState.connector = null;
    starknetReactState.controllerAccount = null;
    starknetReactState.connectors = [];
    starknetReactState.isConnected = false;
    starknetReactState.isConnecting = false;
    latestBootController = null;
    navigate = null;
    usePlayRouteReadinessStore.getState().reset(0);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    consoleErrorMock.mockRestore();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    vi.useRealTimers();
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

  it("keeps one readiness generation while setup resolves and the entry overlay is dismissed", async () => {
    starknetReactState.controllerAccount = { address: "0x123" };
    uiStoreState.showBlankOverlay = true;

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/mainnet/iron-age/map"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    expect(usePlayRouteReadinessStore.getState().bootToken).toBe(1);
    usePlayRouteReadinessStore.getState().markWorldmapReady(1);

    bootstrapControllerState = {
      ...bootstrapControllerState,
      progress: 100,
      setupResult: createSetupResult(),
      status: "ready",
    };
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/mainnet/iron-age/map"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    uiStoreState.showBlankOverlay = false;
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/mainnet/iron-age/map"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    expect(usePlayRouteReadinessStore.getState()).toMatchObject({
      bootToken: 1,
      worldmapReady: true,
    });
    expect(setShowBlankOverlayMock).toHaveBeenCalledTimes(1);
  });

  it("keeps one readiness generation across scenes and coordinate changes in the same entry", async () => {
    starknetReactState.controllerAccount = { address: "0x123" };

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/mainnet/iron-age/map?boot=map-first&resumeScene=hex&col=4&row=9"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      navigate?.("/play/mainnet/iron-age/hex?col=4&row=9");
    });
    await act(async () => {
      navigate?.("/play/mainnet/iron-age/map?boot=map-first&resumeScene=travel&col=7&row=11");
    });
    await act(async () => {
      navigate?.("/play/mainnet/iron-age/travel?col=7&row=11");
    });
    await act(async () => {
      navigate?.("/play/mainnet/iron-age/map?col=12&row=3");
    });

    expect(usePlayRouteReadinessStore.getState().bootToken).toBe(1);
    expect(setShowBlankOverlayMock).toHaveBeenCalledTimes(1);
  });

  it("starts one new readiness generation for each chain, world, or entry-intent change", async () => {
    starknetReactState.controllerAccount = { address: "0x123" };

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/mainnet/iron-age/map"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });
    expect(usePlayRouteReadinessStore.getState().bootToken).toBe(1);

    await act(async () => {
      navigate?.("/play/appchain/iron-age/map");
    });
    expect(usePlayRouteReadinessStore.getState().bootToken).toBe(2);

    await act(async () => {
      navigate?.("/play/appchain/bronze-age/map");
    });
    expect(usePlayRouteReadinessStore.getState().bootToken).toBe(3);

    await act(async () => {
      navigate?.("/play/appchain/bronze-age/map?spectate=true");
    });
    expect(usePlayRouteReadinessStore.getState().bootToken).toBe(4);
    expect(setShowBlankOverlayMock).toHaveBeenCalledTimes(4);
  });

  it("waits for a controller account before bootstrapping player routes", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/mainnet/iron-age/map"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    expect(getLatestBootstrapControllerInput()).toMatchObject({
      context: null,
      enabled: false,
    });
  });

  it("bootstraps spectator routes without a controller account", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/mainnet/iron-age/map?spectate=true"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    expect(getLatestBootstrapControllerInput()).toMatchObject({
      context: {
        chain: "mainnet",
        intent: "spectate",
        worldName: "iron-age",
      },
      enabled: true,
    });
  });

  it("bootstraps player routes once the controller account is resolved", async () => {
    starknetReactState.controllerAccount = { address: "0x123" };

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/mainnet/iron-age/map"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    expect(getLatestBootstrapControllerInput()).toMatchObject({
      context: {
        chain: "mainnet",
        intent: "play",
        worldName: "iron-age",
      },
      enabled: true,
    });
  });

  it("retries controller connection when Starknet is connected without a resolved controller account", async () => {
    const connector = { id: "controller", isReady: () => true };
    starknetReactState.connectors = [connector];
    starknetReactState.isConnected = true;
    connectAsyncMock.mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/mainnet/iron-age/map"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      latestBootController?.connectWallet();
      await Promise.resolve();
    });

    expect(connectAsyncMock).toHaveBeenCalledWith({ connector });
  });

  it("does not reconnect when Starknet and the controller account are both resolved", async () => {
    starknetReactState.connectors = [{ id: "controller" }];
    starknetReactState.controllerAccount = { address: "0x123" };
    starknetReactState.isConnected = true;

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/mainnet/iron-age/map"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    latestBootController?.connectWallet();

    expect(connectAsyncMock).not.toHaveBeenCalled();
  });

  it("keeps a slow automatic account restoration in the restoring state", async () => {
    vi.useFakeTimers();
    starknetReactState.isConnecting = true;

    await renderPlayerRoute();
    await advanceTimers(10_000);

    expect(latestBootController).toMatchObject({
      isReconnectRequired: false,
      phase: "await_account",
      reconnectError: null,
      reconnectStatus: "restoring",
    });

    starknetReactState.controllerAccount = { address: "0x123" };
    starknetReactState.isConnecting = false;
    await renderPlayerRoute();

    expect(latestBootController?.reconnectStatus).toBe("connected");
    expect(getLatestBootstrapControllerInput()).toMatchObject({ enabled: true });
  });
});
