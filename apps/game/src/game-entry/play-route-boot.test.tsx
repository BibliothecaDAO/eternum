import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useNavigate, type NavigateFunction } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SetupResult } from "@/init/bootstrap";

const retryMock = vi.fn();
const setShowBlankOverlayMock = vi.fn();
const useGameEntryBootstrapControllerMock = vi.fn();
const uiStoreState = vi.hoisted(() => ({
  showBlankOverlay: false,
}));
const accountStoreState = vi.hoisted(() => ({
  account: null as unknown,
  provisioningError: null as string | null,
}));

vi.mock("@/game-entry/bootstrap-controller", () => ({
  useGameEntryBootstrapController: (...args: unknown[]) => useGameEntryBootstrapControllerMock(...args),
}));

vi.mock("@/config/game-modes", () => ({
  getGameModeId: () => "eternum",
}));

vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (selector: (state: typeof accountStoreState) => unknown) => selector(accountStoreState),
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
        <MemoryRouter initialEntries={["/play/madara/iron-age/map"]}>
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

    retryMock.mockReset();
    setShowBlankOverlayMock.mockReset();
    useGameEntryBootstrapControllerMock.mockReset();
    bootstrapControllerState = createIdleBootstrapControllerState();
    useGameEntryBootstrapControllerMock.mockImplementation(() => bootstrapControllerState);
    uiStoreState.showBlankOverlay = false;
    accountStoreState.account = null;
    accountStoreState.provisioningError = null;
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
        <MemoryRouter initialEntries={["/play/madara/iron-age/map"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    expect(getRenderPhaseUpdateWarnings(consoleErrorMock)).toEqual([]);
    expect(usePlayRouteReadinessStore.getState().bootToken).toBe(1);
    expect(setShowBlankOverlayMock).toHaveBeenCalledWith(true);
  });

  it("keeps one readiness generation while setup resolves and the entry overlay is dismissed", async () => {
    accountStoreState.account = { address: "0x123" };
    uiStoreState.showBlankOverlay = true;

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/madara/iron-age/map"]}>
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
        <MemoryRouter initialEntries={["/play/madara/iron-age/map"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    uiStoreState.showBlankOverlay = false;
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/madara/iron-age/map"]}>
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
    accountStoreState.account = { address: "0x123" };

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/madara/iron-age/map?boot=map-first&resumeScene=hex&col=4&row=9"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      navigate?.("/play/madara/iron-age/hex?col=4&row=9");
    });
    await act(async () => {
      navigate?.("/play/madara/iron-age/map?boot=map-first&resumeScene=travel&col=7&row=11");
    });
    await act(async () => {
      navigate?.("/play/madara/iron-age/travel?col=7&row=11");
    });
    await act(async () => {
      navigate?.("/play/madara/iron-age/map?col=12&row=3");
    });

    expect(usePlayRouteReadinessStore.getState().bootToken).toBe(1);
    expect(setShowBlankOverlayMock).toHaveBeenCalledTimes(1);
  });

  it("starts one new readiness generation for each chain, world, or entry-intent change", async () => {
    accountStoreState.account = { address: "0x123" };

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/madara/iron-age/map"]}>
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

  it("waits for a gameplay account before bootstrapping player routes", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/madara/iron-age/map"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    expect(getLatestBootstrapControllerInput()).toMatchObject({
      context: null,
      enabled: false,
    });
  });

  it("bootstraps spectator routes without a gameplay account", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/madara/iron-age/map?spectate=true"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    expect(getLatestBootstrapControllerInput()).toMatchObject({
      context: {
        chain: "madara",
        intent: "spectate",
        worldName: "iron-age",
      },
      enabled: true,
    });
    expect(latestBootController?.account?.address).toBe("0x0");
    await expect(latestBootController?.account?.execute([])).rejects.toThrow(
      "Spectator sessions cannot submit transactions",
    );
  });

  it("bootstraps player routes once the gameplay account is resolved", async () => {
    accountStoreState.account = { address: "0x123" };

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/madara/iron-age/map"]}>
          <BootControllerHarness />
        </MemoryRouter>,
      );
    });

    expect(getLatestBootstrapControllerInput()).toMatchObject({
      context: {
        chain: "madara",
        intent: "play",
        worldName: "iron-age",
      },
      enabled: true,
    });
  });

  it("surfaces gameplay account provisioning failures after reconnect grace", async () => {
    vi.useFakeTimers();
    accountStoreState.provisioningError = "account class is not declared";

    await renderPlayerRoute();
    await advanceTimers(10_000);

    expect(latestBootController).toMatchObject({
      isReconnectRequired: true,
      phase: "reconnect_required",
      reconnectError: "account class is not declared",
      reconnectStatus: "idle",
    });
  });
});
