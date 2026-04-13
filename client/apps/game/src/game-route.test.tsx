import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const usePlayRouteBootControllerMock = vi.fn();

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
  LoadingScreen: ({ title, subtitle }: { title?: string; subtitle?: string }) => (
    <div>
      <div>{title}</div>
      <div>{subtitle}</div>
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
  World: () => <div>World</div>,
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
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/mainnet/iron-age/hex?col=4&row=9"]}>
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
    });

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/play/mainnet/iron-age/hex?col=4&row=9"]}>
          <GameRoute backgroundImage="bg.png" />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Reconnect to Continue");
  });
});
