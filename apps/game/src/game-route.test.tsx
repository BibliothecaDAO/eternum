import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const usePlayRouteBootControllerMock = vi.fn();
const worldMountedMock = vi.hoisted(() => vi.fn());

vi.mock("./game-entry/play-route-boot", () => ({
  usePlayRouteBootController: (...args: unknown[]) => usePlayRouteBootControllerMock(...args),
}));

vi.mock("./hooks/context/dojo-context", () => ({
  DojoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./hooks/use-transaction-listener", () => ({
  useTransactionListener: vi.fn(),
}));

vi.mock("./ui/shared", () => ({
  ChunkTransitionIndicator: () => <div>ChunkTransitionIndicator</div>,
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Toaster: () => <div>Toaster</div>,
  TransactionNotification: () => <div>TransactionNotification</div>,
  WorldLoading: () => <div>WorldLoading</div>,
}));

vi.mock("./ui/features/news-headlines", () => ({
  NewsHeadlineBridge: () => <div>NewsHeadlineBridge</div>,
}));

vi.mock("./ui/features/story-events", () => ({
  StoryEventToastBridge: () => <div>StoryEventToastBridge</div>,
}));

vi.mock("./ui/modules/loading-screen", () => ({
  LoadingScreen: ({
    currentTaskLabel,
    title,
    subtitle,
  }: {
    currentTaskLabel?: string | null;
    title?: string;
    subtitle?: string;
  }) => (
    <div>
      <div>{title}</div>
      <div>{subtitle}</div>
      <div>{currentTaskLabel}</div>
    </div>
  ),
}));

vi.mock("./ui/modules/boot-loader", () => ({
  useBootDocumentState: vi.fn(),
  BootLoaderShell: ({ title, subtitle, detail }: { title?: string; subtitle?: string; detail?: React.ReactNode }) => (
    <div>
      <div>{title}</div>
      <div>{subtitle}</div>
      <div>{detail}</div>
    </div>
  ),
}));

vi.mock("./ui/layouts/world", () => ({
  World: () => {
    useEffect(() => {
      worldMountedMock();
    }, []);

    return <div>World</div>;
  },
}));

vi.mock("../env", () => ({
  env: {
    VITE_TRACING_ENABLED: false,
  },
}));

const { default: GameRoute } = await import("./game-route");

describe("GameRoute", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    usePlayRouteBootControllerMock.mockReset();
    worldMountedMock.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("keeps direct play-route reconnect grace on the game route instead of redirecting home", async () => {
    usePlayRouteBootControllerMock.mockReturnValue({
      phase: "await_account",
      progress: 24,
      setupResult: null,
      account: null,
      connectWallet: vi.fn(),
      retry: vi.fn(),
      isReconnectRequired: false,
      currentTask: null,
      tasks: [{ id: "account", label: "Resolving account session", status: "running" }],
      bootToken: 1,
      reconnectError: null,
      reconnectStatus: "idle",
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/madara/iron-age/hex?col=4&row=9"]}>
          <GameRoute backgroundImage="bg.png" />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Charting the World");
    expect(container.textContent).not.toContain("Reconnect to Continue");
  });

  it("renders an on-route reconnect screen for direct play routes after reconnect grace expires", async () => {
    usePlayRouteBootControllerMock.mockReturnValue({
      phase: "reconnect_required",
      progress: 0,
      setupResult: null,
      account: null,
      connectWallet: vi.fn(),
      retry: vi.fn(),
      isReconnectRequired: true,
      currentTask: null,
      tasks: [{ id: "account", label: "Resolving account session", status: "running" }],
      bootToken: 1,
      reconnectError: null,
      reconnectStatus: "idle",
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/madara/iron-age/hex?col=4&row=9"]}>
          <GameRoute backgroundImage="bg.png" />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Reconnect to Continue");
  });

  it("shows automatic gameplay-account restoration as restoring", async () => {
    usePlayRouteBootControllerMock.mockReturnValue({
      phase: "await_account",
      progress: 0,
      setupResult: null,
      account: null,
      connectWallet: vi.fn(),
      retry: vi.fn(),
      isReconnectRequired: false,
      currentTask: null,
      tasks: [{ id: "account", label: "Restoring gameplay account", status: "running" }],
      bootToken: 1,
      reconnectError: null,
      reconnectStatus: "restoring",
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/madara/iron-age/map"]}>
          <GameRoute backgroundImage="bg.png" />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Restoring gameplay account");
    expect(container.textContent).not.toContain("Reconnect to Continue");
  });

  it("keys the ready app by the active boot token so route rebootstrap remounts DojoProvider", () => {
    const source = readFileSync(resolve(process.cwd(), "src/game-route.tsx"), "utf8");

    expect(source).toContain("bootToken");
    expect(source).toContain("<ReadyApp key={bootToken}");
  });

  it("mounts the ready world once after the first readiness generation starts", async () => {
    const transactionProvider = {
      setTransactionSubmitGuard: vi.fn(),
    };
    let controllerState = {
      phase: "wait_worldmap_ready",
      progress: 92,
      setupResult: {
        network: {
          provider: transactionProvider,
        },
      } as { network: { provider: typeof transactionProvider } } | null,
      account: { address: "0x123" } as { address: string } | null,
      connectWallet: vi.fn(),
      retry: vi.fn(),
      isReconnectRequired: false,
      currentTask: "dojo",
      tasks: [],
      bootToken: 0,
      reconnectError: null,
      reconnectStatus: "connected",
    };
    usePlayRouteBootControllerMock.mockImplementation(() => controllerState);

    const renderRoute = () => (
      <MemoryRouter initialEntries={["/play/madara/iron-age/map"]}>
        <GameRoute backgroundImage="bg.png" />
      </MemoryRouter>
    );
    await act(async () => {
      root.render(renderRoute());
    });
    expect(worldMountedMock).not.toHaveBeenCalled();

    controllerState = {
      ...controllerState,
      bootToken: 1,
    };
    await act(async () => {
      root.render(renderRoute());
    });
    await act(async () => {
      root.render(renderRoute());
    });

    expect(container.textContent).toContain("World");
    expect(worldMountedMock).toHaveBeenCalledTimes(1);
  });
});
