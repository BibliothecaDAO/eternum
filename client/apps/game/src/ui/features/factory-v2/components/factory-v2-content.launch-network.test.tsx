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
  FactoryV2StartWorkspace: ({ onLaunch }: { onLaunch: () => void }) => <button onClick={onLaunch}>Launch</button>,
}));

vi.mock("./factory-v2-watch-workspace", () => ({
  FactoryV2WatchWorkspace: ({ onContinue }: { onContinue: () => void }) => (
    <button onClick={onContinue}>Continue</button>
  ),
}));

vi.mock("./factory-v2-developer-tools", () => ({
  FactoryV2DeveloperTools: () => <div>Developer tools</div>,
}));

vi.mock("./factory-v2-workflow-switch", () => ({
  FactoryV2WorkflowSwitch: ({ onSelect }: { onSelect: (view: "start" | "watch") => void }) => (
    <div>
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
  selectedEnvironmentId: "mainnet",
  selectedEnvironment: { id: "mainnet", label: "Mainnet", chain: "mainnet" },
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
  bringIndexerLiveForSelectedRunChild: vi.fn(async () => true),
  refreshSelectedRun: vi.fn(async () => true),
  fundSelectedRunPrize: vi.fn(async () => true),
  resolveRunByName: vi.fn(async () => false),
  ...overrides,
});

describe("FactoryV2Content network handling", () => {
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

  it("launches immediately without opening the switch prompt when the wallet is on another network", async () => {
    const factory = buildFactoryState();
    vi.mocked(useFactoryV2).mockReturnValue(factory as unknown as ReturnType<typeof useFactoryV2>);

    await act(async () => {
      root.render(<FactoryV2Content />);
      await waitForAsyncWork();
    });

    const launchButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Launch"),
    );
    expect(launchButton?.textContent).toContain("Launch");

    await act(async () => {
      (launchButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    expect(factory.launchSelectedPreset).toHaveBeenCalledTimes(1);
  });

  it("continues immediately without opening a network switch prompt", async () => {
    const factory = buildFactoryState({
      activeRunName: "etrn-sunrise-01",
      selectedRun: { id: "run-1", name: "etrn-sunrise-01", environment: "mainnet" },
    });
    vi.mocked(useFactoryV2).mockReturnValue(factory as unknown as ReturnType<typeof useFactoryV2>);

    await act(async () => {
      root.render(<FactoryV2Content />);
      await waitForAsyncWork();
    });

    await act(async () => {
      const watchButton = Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Check a game"),
      );
      (watchButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(container.textContent).toContain("Continue");
    });

    await act(async () => {
      const continueButton = Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Continue"),
      );
      (continueButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    expect(factory.continueSelectedRun).toHaveBeenCalledTimes(1);
  });
});
