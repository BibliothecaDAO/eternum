// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExplorationAutomationWindow } from "./exploration-automation-dashboard";

const mocks = vi.hoisted(() => ({
  explorationStore: {
    entries: {} as Record<string, any>,
    toggleActive: vi.fn(),
    runNow: vi.fn(),
    remove: vi.fn(),
    pauseAll: vi.fn(),
    resumeAll: vi.fn(),
  },
  uiStore: {
    togglePopup: vi.fn(),
    isPopupOpen: vi.fn(() => true),
  },
  dojo: {
    components: {
      ExplorerTroops: {
        byEntity: {} as Record<string, any>,
      },
    },
  },
  navigateToMapView: vi.fn(),
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/store/use-exploration-automation-store", () => ({
  EXPLORATION_AUTOMATION_INTERVAL_MS: 120_000,
  useExplorationAutomationStore: (selector: (state: typeof mocks.explorationStore) => unknown) =>
    selector(mocks.explorationStore),
}));

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (selector: (state: typeof mocks.uiStore) => unknown) => selector(mocks.uiStore),
}));

vi.mock("@/hooks/helpers/use-navigate", () => ({
  useNavigateToMapView: () => mocks.navigateToMapView,
}));

vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({
    setup: {
      components: mocks.dojo.components,
    },
  }),
}));

vi.mock("@bibliothecadao/eternum", () => ({
  Position: class Position {
    constructor(readonly value: { x: number; y: number }) {}
  },
}));

vi.mock("@dojoengine/recs", () => ({
  getComponentValue: (component: { byEntity?: Record<string, unknown> }, entity: string) =>
    component.byEntity?.[entity],
}));

vi.mock("@dojoengine/utils", () => ({
  getEntityIdFromKeys: ([id]: [bigint]) => id.toString(),
}));

vi.mock("@/ui/design-system/atoms/button", () => ({
  default: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/ui/features/world", () => ({
  OSWindow: ({ children, show }: { children: React.ReactNode; show: boolean }) =>
    show ? <div data-testid="os-window">{children}</div> : null,
  explorationAutomation: "explorationAutomation",
}));

vi.mock("@/ui/design-system/atoms/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("lucide-react", () => {
  const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    Bot: Icon,
    MapPin: Icon,
    Pause: Icon,
    Play: Icon,
    RotateCw: Icon,
    Square: Icon,
    Trash2: Icon,
  };
});

vi.mock("sonner", () => ({
  toast: mocks.toast,
}));

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const buildEntry = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "entry-1",
  explorerId: "1",
  active: true,
  createdAt: Date.now(),
  gameId: "game-1",
  scopeRadius: 24,
  strategyId: "basic-frontier",
  lastRunAt: Date.now() - 10_000,
  nextRunAt: Date.now() + 120_000,
  lastAction: null,
  blockedReason: null,
  lastError: null,
  ...overrides,
});

describe("ExplorationAutomationWindow", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T10:00:00.000Z"));

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    mocks.explorationStore.entries = {
      "entry-1": buildEntry(),
    };
    mocks.explorationStore.toggleActive.mockReset();
    mocks.explorationStore.runNow.mockReset();
    mocks.explorationStore.remove.mockReset();
    mocks.explorationStore.pauseAll.mockReset();
    mocks.explorationStore.resumeAll.mockReset();

    mocks.uiStore.togglePopup.mockReset();
    mocks.uiStore.isPopupOpen.mockReset();
    mocks.uiStore.isPopupOpen.mockReturnValue(true);

    mocks.navigateToMapView.mockReset();
    mocks.toast.success.mockReset();
    mocks.toast.info.mockReset();
    mocks.toast.error.mockReset();

    mocks.dojo.components.ExplorerTroops.byEntity = {
      "1": {
        coord: { x: 12, y: 34 },
      },
    };
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await waitForAsyncWork();
    });

    container.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("updates the active countdown every second", async () => {
    await act(async () => {
      root.render(<ExplorationAutomationWindow />);
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("120s");

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("119s");
  });

  it("enables go-to-location immediately when an explorer position is available", async () => {
    await act(async () => {
      root.render(<ExplorationAutomationWindow />);
      await waitForAsyncWork();
    });

    const goToButton = container.querySelector('button[title="Go to location"]');

    expect(goToButton).not.toBeNull();
    expect(goToButton?.hasAttribute("disabled")).toBe(false);
  });
});
