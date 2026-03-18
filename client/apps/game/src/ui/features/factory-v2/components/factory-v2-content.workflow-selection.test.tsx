import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFactoryV2 } from "../hooks/use-factory-v2";
import { FactoryV2Content } from "./factory-v2-content";

vi.mock("@/ui/design-system/atoms/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("../catalog", () => ({
  factoryModeDefinitions: [],
}));

vi.mock("../hooks/use-factory-v2", () => ({
  useFactoryV2: vi.fn(),
}));

vi.mock("../mode-appearance", () => ({
  resolveFactoryModeAppearance: vi.fn(() => ({
    canvasClassName: "",
    backdropClassName: "",
    sectionDividerClassName: "",
  })),
}));

vi.mock("./factory-v2-mode-switch", () => ({
  FactoryV2ModeSwitch: () => <div>Mode switch</div>,
}));

vi.mock("./factory-v2-start-workspace", () => ({
  FactoryV2StartWorkspace: () => <div>Start workspace</div>,
}));

vi.mock("./factory-v2-watch-workspace", () => ({
  FactoryV2WatchWorkspace: () => <div>Watch workspace</div>,
}));

vi.mock("./factory-v2-workflow-switch", () => ({
  FactoryV2WorkflowSwitch: ({
    selectedView,
    onSelect,
  }: {
    selectedView: "start" | "watch";
    onSelect: (view: "start" | "watch") => void;
  }) => (
    <div>
      <div data-testid="selected-workflow">{selectedView}</div>
      <button onClick={() => onSelect("start")}>Start a game</button>
      <button onClick={() => onSelect("watch")}>Check a game</button>
    </div>
  ),
}));

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const buildFactoryState = (overrides: Record<string, unknown> = {}) => ({
  selectedMode: "eternum",
  modeDefinition: { label: "Eternum" },
  environmentOptions: [],
  selectedEnvironmentId: "slot.eternum",
  selectedEnvironment: { id: "slot.eternum", label: "Slot", chain: "slot" },
  presets: [],
  selectedPresetId: "preset-1",
  selectedPreset: { id: "preset-1", defaults: {} },
  draftGameName: "etrn-sunrise-01",
  draftStartAt: "2026-03-18T12:00",
  draftDurationMinutes: null,
  showsDuration: false,
  durationOptions: [],
  twoPlayerMode: false,
  singleRealmMode: false,
  matchingRun: null,
  modeRuns: [],
  selectedRunId: null,
  selectedRun: null,
  watcher: null,
  pendingRunName: null,
  activeRunName: null,
  acceptedRunMessage: null,
  pollingState: { status: "idle", detail: "Idle", lastCheckedAt: null },
  isWatcherBusy: false,
  isLoadingRuns: false,
  isResolvingRunName: false,
  notice: null,
  shouldPreferWatchView: false,
  environmentUnavailableReason: null,
  moreOptions: {
    isOpen: false,
    sections: [],
    draft: {},
    errors: {},
    launchDisabledReason: null,
    toggleOpen: vi.fn(),
    setValue: vi.fn(),
  },
  selectMode: vi.fn(),
  selectEnvironment: vi.fn(),
  selectPreset: vi.fn(),
  selectRun: vi.fn(),
  setDraftGameName: vi.fn(),
  setDraftStartAt: vi.fn(),
  setDraftDurationMinutes: vi.fn(),
  toggleTwoPlayerMode: vi.fn(),
  toggleSingleRealmMode: vi.fn(),
  fandomizeGameName: vi.fn(),
  launchSelectedPreset: vi.fn(async () => true),
  continueSelectedRun: vi.fn(async () => true),
  retrySelectedRun: vi.fn(async () => true),
  bringIndexerLiveForSelectedRun: vi.fn(async () => true),
  refreshSelectedRun: vi.fn(async () => true),
  resolveRunByName: vi.fn(async () => false),
  ...overrides,
});

describe("FactoryV2Content workflow selection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await waitForAsyncWork();
    });

    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("keeps the start panel selected when the same deploying game refreshes", async () => {
    const run = {
      id: "run-1",
      name: "etrn-sunrise-01",
      environment: "slot.eternum",
      status: "running",
    };

    vi.mocked(useFactoryV2).mockReturnValue(
      buildFactoryState({
        activeRunName: "etrn-sunrise-01",
        matchingRun: { id: "run-1", name: "etrn-sunrise-01" },
        selectedRun: run,
        shouldPreferWatchView: true,
      }) as unknown as ReturnType<typeof useFactoryV2>,
    );

    await act(async () => {
      root.render(<FactoryV2Content />);
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Watch workspace");
    });

    const startButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Start a game"),
    );

    await act(async () => {
      (startButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Start workspace");

    vi.mocked(useFactoryV2).mockReturnValue(
      buildFactoryState({
        activeRunName: "etrn-sunrise-01",
        matchingRun: { id: "run-1-updated", name: "etrn-sunrise-01" },
        selectedRun: { ...run, id: "run-1-updated" },
        shouldPreferWatchView: true,
      }) as unknown as ReturnType<typeof useFactoryV2>,
    );

    await act(async () => {
      root.render(<FactoryV2Content />);
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Start workspace");
    expect(container.querySelector('[data-testid="selected-workflow"]')?.textContent).toBe("start");
  });

  it("still auto-opens watch for a different game after the user dismissed the previous one", async () => {
    vi.mocked(useFactoryV2).mockReturnValue(
      buildFactoryState({
        activeRunName: "etrn-sunrise-01",
        matchingRun: { id: "run-1", name: "etrn-sunrise-01" },
        selectedRun: { id: "run-1", name: "etrn-sunrise-01", environment: "slot.eternum", status: "running" },
        shouldPreferWatchView: true,
      }) as unknown as ReturnType<typeof useFactoryV2>,
    );

    await act(async () => {
      root.render(<FactoryV2Content />);
      await waitForAsyncWork();
    });

    const startButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Start a game"),
    );

    await act(async () => {
      (startButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    vi.mocked(useFactoryV2).mockReturnValue(
      buildFactoryState({
        activeRunName: "etrn-sunrise-02",
        matchingRun: { id: "run-2", name: "etrn-sunrise-02" },
        selectedRun: { id: "run-2", name: "etrn-sunrise-02", environment: "slot.eternum", status: "running" },
        shouldPreferWatchView: true,
      }) as unknown as ReturnType<typeof useFactoryV2>,
    );

    await act(async () => {
      root.render(<FactoryV2Content />);
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Watch workspace");
    expect(container.querySelector('[data-testid="selected-workflow"]')?.textContent).toBe("watch");
  });
});
