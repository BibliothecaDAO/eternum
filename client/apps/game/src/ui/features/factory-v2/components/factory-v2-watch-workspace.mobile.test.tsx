import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FactoryRun } from "../types";
import { FactoryV2WatchWorkspace } from "./factory-v2-watch-workspace";

vi.mock("@/ui/design-system/atoms/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("../mode-appearance", () => ({
  resolveFactoryModeAppearance: vi.fn(() => ({
    featureSurfaceClassName: "",
    quietSurfaceClassName: "",
    listItemClassName: "",
    artGlowClassName: "",
    primaryButtonClassName: "",
    secondaryButtonClassName: "",
  })),
}));

vi.mock("./factory-v2-deployer-wallet-card", () => ({
  FactoryV2DeployerWalletCard: ({ chain, environmentLabel }: { chain: string; environmentLabel: string }) => (
    <div data-testid="factory-deployer-wallet-card">
      {environmentLabel} deployer wallet {chain}
    </div>
  ),
}));

const clipboardWriteText = vi.fn();

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const setInputValue = (input: HTMLInputElement, value: string) => {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

  if (!valueSetter) {
    throw new Error("Expected HTMLInputElement value setter to exist");
  }

  valueSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const openPrizeFundingSection = async (container: HTMLDivElement) => {
  const toggleButton = container.querySelector('[data-testid="factory-prize-toggle"]') as HTMLButtonElement | null;

  if (!toggleButton) {
    throw new Error("Expected prize funding toggle to be rendered");
  }

  await act(async () => {
    toggleButton.click();
    await waitForAsyncWork();
  });
};

const buildRun = (overrides: Partial<FactoryRun> = {}): FactoryRun => ({
  ...buildRunBase(),
  ...overrides,
});

const buildRunBase = (): FactoryRun => ({
  id: "run-1",
  syncKey: "sync-1",
  kind: "game",
  mode: "blitz" as const,
  name: "bltz-sprint-01",
  environment: "slot.blitz",
  owner: "0x1",
  presetId: "preset-1",
  status: "running" as const,
  summary: "In progress",
  updatedAt: "2026-03-18T12:00:00Z",
  steps: [
    {
      id: "create-world" as const,
      title: "Create world",
      summary: "Create world",
      workflowName: "launch-world",
      status: "succeeded" as const,
      verification: "done",
      latestEvent: "done",
    },
    {
      id: "configure-world" as const,
      title: "Configure world",
      summary: "Configure world",
      workflowName: "configure-world",
      status: "running" as const,
      verification: "running",
      latestEvent: "running",
    },
    {
      id: "create-indexer" as const,
      title: "Create indexer",
      summary: "Create indexer",
      workflowName: "create-indexer",
      status: "pending" as const,
      verification: "pending",
      latestEvent: "pending",
    },
  ],
});

describe("FactoryV2WatchWorkspace mobile layout", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
    clipboardWriteText.mockReset();

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

  it("uses a wider layout and keeps the watch actions in a sticky mobile bar", async () => {
    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[buildRun()]}
          selectedRun={buildRun()}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const article = container.querySelector("article");
    const actionBar = container.querySelector('[data-testid="factory-watch-action-bar"]');
    const searchPanel = container.querySelector('[data-testid="factory-watch-search-panel"]');
    const selectedPanel = container.querySelector('[data-testid="factory-watch-selected-panel"]');
    const gameNameInput = container.querySelector("#factory-watch-game") as HTMLInputElement | null;
    const currentProgressTrack = container.querySelector('[data-testid="factory-watch-current-progress-track"]');
    const currentProgressFill = container.querySelector('[data-testid="factory-watch-current-progress-fill"]');
    const doneMoment = container.querySelector('[data-step-tone="done"]');
    const nowMoment = container.querySelector('[data-step-tone="now"]');
    const nextMoment = container.querySelector('[data-step-tone="next"]');

    expect(article?.className).toContain("w-full");
    expect(article?.className).toContain("md:max-w-md");
    expect(searchPanel?.textContent).toContain("Find a run");
    expect(searchPanel?.textContent).toContain("recent runs");
    expect(container.textContent).toContain("Slot deployer wallet slot");
    expect(selectedPanel?.textContent).toContain("Slot deployer wallet slot");
    expect(selectedPanel?.textContent).toContain("Setup progress");
    expect(selectedPanel?.textContent).toContain("In progress");
    expect(selectedPanel?.textContent).toContain("3 of 4 parts");
    expect(selectedPanel?.textContent).toContain("Step 3 of 4");
    expect(gameNameInput?.className).toContain("text-center");
    expect(doneMoment?.className).toContain("opacity-45");
    expect(nowMoment?.className).toContain("border-[#c6a777]/60");
    expect(nextMoment?.className).toContain("border-dashed");
    expect(nextMoment?.className).toContain("opacity-70");
    expect(currentProgressTrack?.className).toContain("bg-[#d9cabd]");
    expect(currentProgressFill?.className).toContain("bg-[#7a4b22]");
    expect(currentProgressTrack?.textContent).toBe("");
    expect(actionBar?.className).toContain("sticky");
  });

  it("places the deployer wallet under prize funding controls", async () => {
    const seriesRun = buildRun({
      kind: "series",
      mode: "eternum",
      status: "attention",
      summary: "Needs attention",
      name: "bltz-weekend-cup",
      steps: [
        {
          id: "create-series" as const,
          title: "Create series",
          summary: "done",
          workflowName: "create-series",
          status: "succeeded" as const,
          verification: "done",
          latestEvent: "done",
        },
      ],
      children: [
        {
          id: "series-child-1",
          gameName: "bltz-weekend-cup-01",
          seriesGameNumber: 1,
          startTimeIso: "2026-03-18T12:00:00.000Z",
          status: "succeeded",
          latestEvent: "Ready",
          currentStepId: null,
          steps: [],
          configReady: true,
          worldAddress: "0x111",
        },
      ],
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[seriesRun]}
          selectedRun={seriesRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn(async () => true)}
        />,
      );
      await waitForAsyncWork();
    });

    const prizeFundingToggle = container.querySelector(
      '[data-testid="factory-prize-toggle"]',
    ) as HTMLButtonElement | null;
    const walletCard = container.querySelector('[data-testid="factory-deployer-wallet-card"]') as HTMLDivElement | null;

    expect(prizeFundingToggle?.textContent).toContain("Open prize funding");
    expect(walletCard?.textContent).toContain("Slot deployer wallet slot");
    expect(
      prizeFundingToggle?.compareDocumentPosition(walletCard as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows recent runs in the picker without auto-selecting one", async () => {
    const recentRun = buildRun({
      id: "recent-run-1",
      name: "bltz-recent-01",
      status: "complete",
      summary: "Complete",
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[recentRun]}
          selectedRun={null}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const searchInput = container.querySelector("#factory-watch-game") as HTMLInputElement | null;
    const emptyPanel = container.querySelector('[data-testid="factory-watch-empty-panel"]');

    if (!searchInput) {
      throw new Error("Expected watch search controls to be rendered");
    }

    expect(searchInput.value).toBe("");
    expect(emptyPanel?.textContent).toContain("Type a run name and press Enter to check its status.");

    const searchPanel = container.querySelector('[data-testid="factory-watch-search-panel"]');
    const selectedPanel = container.querySelector('[data-testid="factory-watch-selected-panel"]');

    expect(searchPanel?.textContent).toContain("bltz-recent-01");
    expect(selectedPanel).toBeNull();
    expect(emptyPanel?.textContent).toContain("Find a run");
  });

  it("keeps recent runs visible even when the search panel is showing an error notice", async () => {
    const noticeMessage = "Something went wrong while checking this game. We kept your place here.";
    const recentRun = buildRun({
      id: "recent-run-2",
      name: "bltz-recent-02",
      status: "attention",
      summary: "Needs attention",
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[recentRun]}
          selectedRun={null}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={noticeMessage}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const searchPanel = container.querySelector('[data-testid="factory-watch-search-panel"]');
    const searchNotice = container.querySelector('[data-testid="factory-watch-search-notice"]');

    expect(searchPanel?.textContent).toContain(noticeMessage);
    expect(searchNotice?.textContent).toContain("Run details");
    expect(searchNotice?.textContent).toContain(noticeMessage);
    expect(searchPanel?.textContent).toContain("bltz-recent-02");
    expect(searchPanel?.textContent).toContain("Needs attention");

    const copyButton = container.querySelector(
      '[data-testid="factory-watch-search-notice-copy"]',
    ) as HTMLButtonElement | null;

    await act(async () => {
      copyButton?.click();
      await waitForAsyncWork();
    });

    expect(clipboardWriteText).toHaveBeenCalledWith(noticeMessage);
  });

  it("shows the pending launch request as the first setup step", async () => {
    const pendingRun = buildRun({
      id: "pending:slot.blitz:bltz-sprint-01",
      steps: [
        {
          id: "launch-request" as const,
          title: "Launch the game",
          summary: "Starting the launch now.",
          workflowName: "launch-request",
          status: "running" as const,
          verification: "running",
          latestEvent: "running",
        },
        {
          id: "create-world" as const,
          title: "Create world",
          summary: "Create world",
          workflowName: "launch-world",
          status: "pending" as const,
          verification: "pending",
          latestEvent: "pending",
        },
        {
          id: "wait-for-factory-index" as const,
          title: "Wait for factory index",
          summary: "Wait for factory index",
          workflowName: "wait-for-factory-index",
          status: "pending" as const,
          verification: "pending",
          latestEvent: "pending",
        },
        {
          id: "configure-world" as const,
          title: "Configure world",
          summary: "Configure world",
          workflowName: "configure-world",
          status: "pending" as const,
          verification: "pending",
          latestEvent: "pending",
        },
        {
          id: "grant-lootchest-role" as const,
          title: "Grant loot chest role",
          summary: "Grant loot chest role",
          workflowName: "grant-lootchest-role",
          status: "pending" as const,
          verification: "pending",
          latestEvent: "pending",
        },
        {
          id: "create-indexer" as const,
          title: "Create indexer",
          summary: "Create indexer",
          workflowName: "create-indexer",
          status: "pending" as const,
          verification: "pending",
          latestEvent: "pending",
        },
      ],
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[pendingRun]}
          selectedRun={pendingRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const selectedPanel = container.querySelector('[data-testid="factory-watch-selected-panel"]');

    expect(selectedPanel?.textContent).toContain("1 of 6 parts");
    expect(selectedPanel?.textContent).toContain("Step 1 of 6");
  });

  it("hides rotation maintenance actions while a rotation is still in progress", async () => {
    const onNudge = vi.fn();
    const rotationRun = buildRun({
      kind: "rotation",
      name: "bltz-ladder-loop",
      autoRetry: {
        enabled: true,
        intervalMinutes: 15,
        nextRetryAt: "2026-03-18T12:15:00.000Z",
        lastRetryAt: null,
        cancelledAt: null,
        cancelReason: null,
      },
      evaluation: {
        intervalMinutes: 30,
        nextEvaluationAt: "2026-03-18T12:30:00.000Z",
        lastEvaluatedAt: "2026-03-18T12:00:00.000Z",
        lastNudgedAt: null,
      },
      rotation: {
        rotationName: "bltz-ladder-loop",
        maxGames: 12,
        advanceWindowGames: 5,
        createdGameCount: 4,
        queuedGameCount: 3,
        gameIntervalMinutes: 60,
        firstGameStartTimeIso: "2026-03-18T12:00:00.000Z",
      },
      children: [
        {
          id: "rotation-child-1",
          gameName: "bltz-ladder-loop-01",
          seriesGameNumber: 1,
          startTimeIso: "2026-03-18T12:00:00.000Z",
          status: "running",
          latestEvent: "Queued for setup.",
          currentStepId: "configure-worlds",
          steps: [],
          worldAddress: "0xabc",
        },
      ],
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[rotationRun]}
          selectedRun={rotationRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={onNudge}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Rotation schedule");
    expect(container.textContent).toContain("Created");
    expect(container.textContent).toContain("4 of 12");
    expect(container.textContent).toContain("Queued ahead");
    expect(container.textContent).toContain("Next evaluation");
    expect(container.textContent).toContain("Rotation games");
    expect(container.textContent).not.toContain("Auto-retry");
    expect(container.querySelector('button[aria-label="Run now"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Stop auto retry"]')).toBeNull();
  });

  it("shows stop auto retry for stalled rotations that still report running", async () => {
    const onStopAutoRetry = vi.fn();
    const rotationRun = buildRun({
      kind: "rotation",
      name: "bltz-bakers",
      autoRetry: {
        enabled: true,
        intervalMinutes: 15,
        nextRetryAt: null,
        lastRetryAt: null,
        cancelledAt: null,
        cancelReason: null,
      },
      recovery: {
        state: "stalled",
        canContinue: true,
        continueStepId: "create-worlds",
      },
      evaluation: {
        intervalMinutes: 15,
        nextEvaluationAt: "2026-03-24T15:22:03.341Z",
        lastEvaluatedAt: "2026-03-24T15:07:03.341Z",
        lastNudgedAt: null,
      },
      rotation: {
        rotationName: "bltz-bakers",
        maxGames: 4,
        advanceWindowGames: 2,
        createdGameCount: 2,
        queuedGameCount: 1,
        gameIntervalMinutes: 60,
        firstGameStartTimeIso: "2026-03-24T15:00:00.000Z",
      },
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[rotationRun]}
          selectedRun={rotationRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={onStopAutoRetry}
          hasAdminSecret
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const stopAutoRetryButton = container.querySelector('button[aria-label="Stop auto retry"]');

    expect(stopAutoRetryButton).toBeTruthy();

    await act(async () => {
      (stopAutoRetryButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    expect(onStopAutoRetry).toHaveBeenCalledTimes(1);
  });

  it("shows rotation maintenance actions once the run needs attention", async () => {
    const rotationRun = buildRun({
      kind: "rotation",
      status: "attention",
      autoRetry: {
        enabled: true,
        intervalMinutes: 15,
        nextRetryAt: "2026-03-18T12:15:00.000Z",
        lastRetryAt: null,
        cancelledAt: null,
        cancelReason: null,
      },
      evaluation: {
        intervalMinutes: 30,
        nextEvaluationAt: "2026-03-18T12:30:00.000Z",
        lastEvaluatedAt: "2026-03-18T12:00:00.000Z",
        lastNudgedAt: null,
      },
      rotation: {
        rotationName: "bltz-ladder-loop",
        maxGames: 12,
        advanceWindowGames: 5,
        createdGameCount: 4,
        queuedGameCount: 3,
        gameIntervalMinutes: 60,
        firstGameStartTimeIso: "2026-03-18T12:00:00.000Z",
      },
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[rotationRun]}
          selectedRun={rotationRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.querySelector('button[aria-label="Run now"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Stop auto retry"]')).toBeTruthy();
  });

  it("hides run now when a rotation is already complete", async () => {
    const rotationRun = buildRun({
      kind: "rotation",
      status: "complete",
      evaluation: {
        intervalMinutes: 30,
        nextEvaluationAt: "2026-03-18T12:30:00.000Z",
        lastEvaluatedAt: "2026-03-18T12:00:00.000Z",
        lastNudgedAt: null,
      },
      rotation: {
        rotationName: "bltz-ladder-loop",
        maxGames: 12,
        advanceWindowGames: 5,
        createdGameCount: 12,
        queuedGameCount: 0,
        gameIntervalMinutes: 60,
        firstGameStartTimeIso: "2026-03-18T12:00:00.000Z",
      },
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[rotationRun]}
          selectedRun={rotationRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.querySelector('button[aria-label="Run now"]')).toBeNull();
  });

  it("shows all set instead of updating automatically for completed runs", async () => {
    const completedRun = buildRun({
      status: "complete",
      summary: "Ready",
      steps: buildRunBase().steps.map((step) => ({
        ...step,
        status: "succeeded" as const,
        verification: "done",
        latestEvent: "done",
      })),
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[completedRun]}
          selectedRun={completedRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "live", detail: "Updating automatically.", lastCheckedAt: Date.now() }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("All set");
    expect(container.textContent).not.toContain("Updating automatically");
  });

  it("shows waiting for retry instead of updating automatically for scheduled retry runs", async () => {
    const retryRun = buildRun({
      kind: "series",
      status: "attention",
      autoRetry: {
        enabled: true,
        intervalMinutes: 15,
        nextRetryAt: "2026-03-18T12:15:00.000Z",
        lastRetryAt: null,
        cancelledAt: null,
        cancelReason: null,
      },
      steps: [
        {
          id: "create-worlds" as const,
          title: "Create worlds",
          summary: "failed",
          workflowName: "create-worlds",
          status: "failed" as const,
          verification: "failed",
          latestEvent: "failed",
        },
      ],
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[retryRun]}
          selectedRun={retryRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "live", detail: "Updating automatically.", lastCheckedAt: Date.now() }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Waiting for retry");
    expect(container.textContent).not.toContain("Updating automatically");
  });

  it("keeps running fallback copy aligned when no current step is resolved", async () => {
    const staleRunningRun = buildRun({
      status: "running",
      steps: buildRunBase().steps.map((step) => ({
        ...step,
        status: "succeeded" as const,
        verification: "done",
        latestEvent: "done",
      })),
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[staleRunningRun]}
          selectedRun={staleRunningRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const selectedPanel = container.querySelector('[data-testid="factory-watch-selected-panel"]');

    expect(selectedPanel?.textContent).toContain("In progress");
    expect(selectedPanel?.textContent).toContain("Working through setup");
    expect(selectedPanel?.textContent).toContain("We’re still moving through setup.");
    expect(selectedPanel?.textContent).not.toContain("Everything is ready");
  });

  it("shows missing-run lookup errors in the search panel instead of the selected run card", async () => {
    const selectedRun = buildRun();
    const missingRunNotice = "No game, series, or rotation named bltz-missing-01 was found here yet.";

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[selectedRun]}
          selectedRun={selectedRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={missingRunNotice}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const searchInput = container.querySelector("#factory-watch-game") as HTMLInputElement | null;

    if (!searchInput) {
      throw new Error("Expected watch search input to be rendered");
    }

    await act(async () => {
      setInputValue(searchInput, "bltz-missing-01");
      await waitForAsyncWork();
    });

    const searchPanel = container.querySelector('[data-testid="factory-watch-search-panel"]');
    const selectedPanel = container.querySelector('[data-testid="factory-watch-selected-panel"]');
    const searchNotice = container.querySelector('[data-testid="factory-watch-search-notice"]');

    expect(searchPanel?.textContent).toContain(missingRunNotice);
    expect(searchNotice?.textContent).toContain(missingRunNotice);
    expect(selectedPanel?.textContent).not.toContain(missingRunNotice);
  });

  it("shows opening-run errors inside a compact copyable box", async () => {
    const openingNotice = "Slot timed out while opening bltz-opening-01. Check again in a moment.";

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[]}
          selectedRun={null}
          activeRunName="bltz-opening-01"
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "checking", detail: "Updating automatically", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={openingNotice}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const pendingPanel = container.querySelector('[data-testid="factory-watch-pending-panel"]');
    const pendingNotice = container.querySelector('[data-testid="factory-watch-pending-notice"]');

    expect(pendingPanel?.textContent).toContain("Opening bltz-opening-01");
    expect(pendingNotice?.textContent).toContain("Run details");
    expect(pendingNotice?.textContent).toContain(openingNotice);

    const copyButton = container.querySelector(
      '[data-testid="factory-watch-pending-notice-copy"]',
    ) as HTMLButtonElement | null;

    await act(async () => {
      copyButton?.click();
      await waitForAsyncWork();
    });

    expect(clipboardWriteText).toHaveBeenCalledWith(openingNotice);
  });

  it("hides continue when a game is already complete", async () => {
    const completedRun = buildRun({
      status: "complete",
      recovery: {
        state: "stalled",
        canContinue: true,
        continueStepId: "create-indexer",
      },
      steps: [
        {
          id: "create-world" as const,
          title: "Create world",
          summary: "done",
          workflowName: "create-world",
          status: "succeeded" as const,
          verification: "done",
          latestEvent: "done",
        },
        {
          id: "create-indexer" as const,
          title: "Create indexer",
          summary: "done",
          workflowName: "create-indexer",
          status: "succeeded" as const,
          verification: "done",
          latestEvent: "done",
        },
      ],
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[completedRun]}
          selectedRun={completedRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.querySelector('button[aria-label="Continue"]')).toBeNull();
  });

  it("defaults series prize funding to ready unfunded games and forwards the secret", async () => {
    const onFundPrize = vi.fn();
    const seriesRun = buildRun({
      kind: "series",
      mode: "eternum",
      status: "attention",
      summary: "Needs attention",
      name: "bltz-weekend-cup",
      steps: [
        {
          id: "create-series" as const,
          title: "Create series",
          summary: "done",
          workflowName: "create-series",
          status: "succeeded" as const,
          verification: "done",
          latestEvent: "done",
        },
      ],
      children: [
        {
          id: "series-child-1",
          gameName: "bltz-weekend-cup-01",
          seriesGameNumber: 1,
          startTimeIso: "2026-03-18T12:00:00.000Z",
          status: "succeeded",
          latestEvent: "Ready",
          currentStepId: null,
          steps: [],
          configReady: true,
          worldAddress: "0x111",
        },
        {
          id: "series-child-2",
          gameName: "bltz-weekend-cup-02",
          seriesGameNumber: 2,
          startTimeIso: "2026-03-18T13:00:00.000Z",
          status: "succeeded",
          latestEvent: "Ready",
          currentStepId: null,
          steps: [],
          configReady: true,
          worldAddress: "0x222",
          prizeFunding: {
            transfers: [
              {
                id: "0xabc",
                tokenAddress: "0x123",
                amountRaw: "100",
                amountDisplay: "1",
                decimals: 18,
                transactionHash: "0xabc",
                fundedAt: "2026-03-18T11:00:00.000Z",
              },
            ],
          },
        },
        {
          id: "series-child-3",
          gameName: "bltz-weekend-cup-03",
          seriesGameNumber: 3,
          startTimeIso: "2026-03-18T14:00:00.000Z",
          status: "pending",
          latestEvent: "Pending",
          currentStepId: "configure-worlds",
          steps: [],
          configReady: false,
          worldAddress: "0x333",
        },
      ],
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[seriesRun]}
          selectedRun={seriesRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          adminSecret="factory-secret"
          hasAdminSecret
          onFundPrize={onFundPrize}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).not.toContain("Admin prize funding");

    await openPrizeFundingSection(container);

    const amountInput = container.querySelector('[data-testid="factory-prize-amount"]') as HTMLInputElement | null;
    const firstGameCheckbox = container.querySelector(
      '[data-testid="factory-prize-game-bltz-weekend-cup-01"]',
    ) as HTMLInputElement | null;
    const secondGameCheckbox = container.querySelector(
      '[data-testid="factory-prize-game-bltz-weekend-cup-02"]',
    ) as HTMLInputElement | null;
    const thirdGameCheckbox = container.querySelector(
      '[data-testid="factory-prize-game-bltz-weekend-cup-03"]',
    ) as HTMLInputElement | null;
    const submitButton = container.querySelector('[data-testid="factory-prize-submit"]') as HTMLButtonElement | null;

    expect(container.textContent).toContain("Admin prize funding");
    expect(container.textContent).toContain("trusted prize distribution address");
    expect(firstGameCheckbox?.checked).toBe(true);
    expect(secondGameCheckbox?.checked).toBe(false);
    expect(thirdGameCheckbox?.disabled).toBe(true);
    expect(container.textContent).toContain("World config not finished");

    await act(async () => {
      if (!amountInput || !submitButton) {
        throw new Error("Expected prize funding controls to be rendered");
      }

      setInputValue(amountInput, "250");
      submitButton.click();
      await waitForAsyncWork();
    });

    expect(onFundPrize).toHaveBeenCalledWith({
      amount: "250",
      adminSecret: "factory-secret",
      selectedGameNames: ["bltz-weekend-cup-01"],
    });
  });

  it("shows a resend cooldown after successful series prize funding", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-24T12:00:00.000Z"));

    const onFundPrize = vi.fn(async () => true);
    const seriesRun = buildRun({
      kind: "series",
      mode: "eternum",
      status: "attention",
      summary: "Needs attention",
      name: "bltz-weekend-cup",
      steps: [
        {
          id: "create-series" as const,
          title: "Create series",
          summary: "done",
          workflowName: "create-series",
          status: "succeeded" as const,
          verification: "done",
          latestEvent: "done",
        },
      ],
      children: [
        {
          id: "series-child-1",
          gameName: "bltz-weekend-cup-01",
          seriesGameNumber: 1,
          startTimeIso: "2026-03-18T12:00:00.000Z",
          status: "succeeded",
          latestEvent: "Ready",
          currentStepId: null,
          steps: [],
          configReady: true,
          worldAddress: "0x111",
        },
      ],
    });

    try {
      await act(async () => {
        root.render(
          <FactoryV2WatchWorkspace
            mode="blitz"
            runs={[seriesRun]}
            selectedRun={seriesRun}
            activeRunName={null}
            acceptedRunMessage={null}
            watcher={null}
            pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
            isWatcherBusy={false}
            isResolvingRunName={false}
            notice={null}
            lookupDisabledReason={null}
            onSelectRun={vi.fn()}
            onResolveRunByName={vi.fn(async () => false)}
            onContinue={vi.fn()}
            onRefresh={vi.fn()}
            onNudge={vi.fn()}
            onStopAutoRetry={vi.fn()}
            adminSecret="factory-secret"
            hasAdminSecret
            onFundPrize={onFundPrize}
          />,
        );
        await waitForAsyncWork();
      });

      await openPrizeFundingSection(container);

      const amountInput = container.querySelector('[data-testid="factory-prize-amount"]') as HTMLInputElement | null;
      const submitButton = container.querySelector('[data-testid="factory-prize-submit"]') as HTMLButtonElement | null;

      await act(async () => {
        if (!amountInput || !submitButton) {
          throw new Error("Expected prize funding controls to be rendered");
        }

        setInputValue(amountInput, "250");
        submitButton.click();
        await waitForAsyncWork();
      });

      expect(onFundPrize).toHaveBeenCalledWith({
        amount: "250",
        adminSecret: "factory-secret",
        selectedGameNames: ["bltz-weekend-cup-01"],
      });
      expect(container.textContent).toContain("Prize funding sent for 1 game. Wait 30 seconds before sending again.");
      expect(submitButton?.disabled).toBe(true);
      expect(submitButton?.textContent).toContain("Wait 30s");

      await act(async () => {
        vi.advanceTimersByTime(30_000);
        await waitForAsyncWork();
      });

      expect(container.textContent).not.toContain("Prize funding sent for 1 game.");
      expect(submitButton?.disabled).toBe(false);
      expect(submitButton?.textContent).toContain("Fund selected games");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows prize funding for an incomplete game once world config has succeeded", async () => {
    const onFundPrize = vi.fn();
    const gameRun = buildRun({
      mode: "eternum",
      status: "attention",
      summary: "Indexer failed after setup.",
      worldAddress: "0xabc",
      steps: [
        {
          id: "create-world" as const,
          title: "Create world",
          summary: "done",
          workflowName: "create-world",
          status: "succeeded" as const,
          verification: "done",
          latestEvent: "done",
        },
        {
          id: "configure-world" as const,
          title: "Configure world",
          summary: "done",
          workflowName: "configure-world",
          status: "succeeded" as const,
          verification: "done",
          latestEvent: "done",
        },
        {
          id: "create-indexer" as const,
          title: "Create indexer",
          summary: "failed",
          workflowName: "create-indexer",
          status: "failed" as const,
          verification: "failed",
          latestEvent: "failed",
        },
      ],
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="eternum"
          runs={[gameRun]}
          selectedRun={gameRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={onFundPrize}
        />,
      );
      await waitForAsyncWork();
    });

    await openPrizeFundingSection(container);

    const submitButton = container.querySelector('[data-testid="factory-prize-submit"]') as HTMLButtonElement | null;

    expect(container.textContent).toContain("Admin prize funding");
    expect(container.textContent).toContain("Fund this game");
    expect(submitButton?.disabled).toBe(true);
  });

  it("shows rotation prize funding with only ready unfunded games selected by default", async () => {
    const onFundPrize = vi.fn();
    const rotationRun = buildRun({
      kind: "rotation",
      status: "attention",
      summary: "Waiting for the next rotation check.",
      name: "bltz-ladder-loop",
      children: [
        {
          id: "rotation-child-1",
          gameName: "bltz-ladder-loop-01",
          seriesGameNumber: 1,
          startTimeIso: "2026-03-18T12:00:00.000Z",
          status: "succeeded",
          latestEvent: "Ready",
          currentStepId: null,
          steps: [],
          configReady: true,
          worldAddress: "0x111",
        },
        {
          id: "rotation-child-2",
          gameName: "bltz-ladder-loop-02",
          seriesGameNumber: 2,
          startTimeIso: "2026-03-18T13:00:00.000Z",
          status: "failed",
          latestEvent: "Indexer failed",
          currentStepId: "create-indexers",
          steps: [],
          configReady: true,
          worldAddress: "0x222",
          prizeFunding: {
            transfers: [
              {
                id: "0xpaid",
                tokenAddress: "0x123",
                amountRaw: "100",
                amountDisplay: "1",
                decimals: 18,
                transactionHash: "0xpaid",
                fundedAt: "2026-03-18T11:00:00.000Z",
              },
            ],
          },
        },
        {
          id: "rotation-child-3",
          gameName: "bltz-ladder-loop-03",
          seriesGameNumber: 3,
          startTimeIso: "2026-03-18T14:00:00.000Z",
          status: "running",
          latestEvent: "Configuring",
          currentStepId: "configure-worlds",
          steps: [],
          configReady: false,
          worldAddress: "0x333",
        },
      ],
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[rotationRun]}
          selectedRun={rotationRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={onFundPrize}
        />,
      );
      await waitForAsyncWork();
    });

    await openPrizeFundingSection(container);

    const firstGameCheckbox = container.querySelector(
      '[data-testid="factory-prize-game-bltz-ladder-loop-01"]',
    ) as HTMLInputElement | null;
    const secondGameCheckbox = container.querySelector(
      '[data-testid="factory-prize-game-bltz-ladder-loop-02"]',
    ) as HTMLInputElement | null;
    const thirdGameCheckbox = container.querySelector(
      '[data-testid="factory-prize-game-bltz-ladder-loop-03"]',
    ) as HTMLInputElement | null;

    expect(container.textContent).toContain("Rotation games");
    expect(firstGameCheckbox?.checked).toBe(true);
    expect(secondGameCheckbox?.checked).toBe(false);
    expect(thirdGameCheckbox?.disabled).toBe(true);
  });

  it("stops auto retry from the watch action bar for stalled multi-game runs", async () => {
    const onStopAutoRetry = vi.fn();
    const seriesRun = buildRun({
      kind: "series",
      status: "attention",
      name: "bltz-weekend-cup",
      autoRetry: {
        enabled: true,
        intervalMinutes: 15,
        nextRetryAt: "2026-03-18T12:15:00.000Z",
        lastRetryAt: null,
        cancelledAt: null,
        cancelReason: null,
      },
      children: [
        {
          id: "series-child-1",
          gameName: "bltz-weekend-cup-01",
          seriesGameNumber: 1,
          startTimeIso: "2026-03-18T12:00:00.000Z",
          status: "running",
          latestEvent: "Configuring world.",
          currentStepId: "configure-worlds",
          steps: [],
          worldAddress: "0xabc",
        },
      ],
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[seriesRun]}
          selectedRun={seriesRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={onStopAutoRetry}
          hasAdminSecret
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const stopAutoRetryButton = container.querySelector('button[aria-label="Stop auto retry"]');

    expect(stopAutoRetryButton).toBeTruthy();

    await act(async () => {
      (stopAutoRetryButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    expect(onStopAutoRetry).toHaveBeenCalledTimes(1);
  });

  it("shows a delete run action for a selected stored run", async () => {
    const onDeleteRun = vi.fn();
    const run = buildRun({
      status: "attention",
      name: "bltz-trashfire",
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[run]}
          selectedRun={run}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onDeleteRun={onDeleteRun}
          hasAdminSecret
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const deleteRunButton = container.querySelector('button[aria-label="Delete run"]');

    expect(deleteRunButton).toBeTruthy();

    await act(async () => {
      (deleteRunButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    expect(onDeleteRun).toHaveBeenCalledTimes(1);
  });

  it("hides continue after auto-retry was cancelled for a failed series", async () => {
    const cancelledRun = buildRun({
      kind: "series",
      status: "attention",
      name: "bltz-weekend-cup",
      autoRetry: {
        enabled: false,
        intervalMinutes: 15,
        nextRetryAt: null,
        lastRetryAt: null,
        cancelledAt: "2026-03-24T10:00:00.000Z",
        cancelReason: "Paused by admin",
      },
      recovery: {
        state: "failed",
        canContinue: true,
        continueStepId: "create-worlds",
      },
      steps: [
        {
          id: "create-worlds" as const,
          title: "Create worlds",
          summary: "Create worlds",
          workflowName: "create-worlds",
          status: "failed" as const,
          verification: "failed",
          latestEvent: "failed",
        },
      ],
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[cancelledRun]}
          selectedRun={cancelledRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          hasAdminSecret
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.querySelector('button[aria-label="Continue"]')).toBeNull();
    expect(container.textContent).toContain("This series stopped and auto-retry is off.");
  });

  it("shows completed and pending child steps instead of a raw latest-event tx hash", async () => {
    const rotationRun = buildRun({
      kind: "rotation",
      status: "attention",
      name: "bltz-franky",
      children: [
        {
          id: "rotation-child-1",
          gameName: "bltz-franky-01",
          seriesGameNumber: 1,
          startTimeIso: "2026-03-18T12:00:00.000Z",
          status: "running",
          latestEvent: "Completed create-indexers (0xdeadbeef)",
          currentStepId: "configure-worlds",
          steps: [
            {
              id: "create-worlds",
              status: "succeeded",
              latestEvent: "World created.",
            },
            {
              id: "create-series",
              status: "pending",
              latestEvent: "Waiting for series.",
            },
            {
              id: "wait-for-factory-indexes",
              status: "succeeded",
              latestEvent: "Indexed.",
            },
            {
              id: "configure-worlds",
              status: "running",
              latestEvent: "Applying config.",
            },
            {
              id: "create-indexers",
              status: "pending",
              latestEvent: "Waiting for indexer setup.",
            },
          ],
          worldAddress: "0xabc",
        },
      ],
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[rotationRun]}
          selectedRun={rotationRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Done");
    expect(container.textContent).toContain("Deploying games");
    expect(container.textContent).toContain("Now");
    expect(container.textContent).toContain("Applying settings");
    expect(container.textContent).toContain("Pending");
    expect(container.textContent).toContain("Deploying indexers");
    expect(container.textContent).not.toContain("Waiting for games");
    expect(container.textContent).not.toContain("Creating series");
    expect(container.textContent).not.toContain("0xdeadbeef");
  });

  it("renders child and parent errors inside copyable boxes", async () => {
    const failedRun = buildRun({
      kind: "series",
      status: "attention",
      steps: [
        {
          id: "create-worlds" as const,
          title: "Create worlds",
          summary: "Create worlds",
          workflowName: "create-worlds",
          status: "failed" as const,
          verification: "estimate_fee timeout",
          latestEvent: "estimate_fee timeout",
        },
      ],
      children: [
        {
          id: "series-child-1",
          gameName: "bltz-error-01",
          seriesGameNumber: 1,
          startTimeIso: "2026-03-18T12:00:00.000Z",
          status: "failed",
          latestEvent: "deployment already completed",
          currentStepId: "create-worlds",
          steps: [
            {
              id: "create-worlds",
              status: "failed",
              latestEvent: "deployment already completed",
              errorMessage: "deployment already completed",
            },
          ],
          worldAddress: "0xabc",
        },
      ],
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[failedRun]}
          selectedRun={failedRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const childErrorBox = container.querySelector('[data-testid="factory-child-error-bltz-error-01"]');

    expect(childErrorBox?.textContent).toContain("Error details");
    expect(childErrorBox?.textContent).toContain("deployment already completed");

    const stepErrorBox = container.querySelector('[data-testid="factory-step-error-create-worlds"]');

    expect(stepErrorBox?.textContent).toContain("estimate_fee timeout");

    const copyButtons = Array.from(container.querySelectorAll("button")).filter((button) =>
      button.textContent?.includes("Copy"),
    );

    await act(async () => {
      copyButtons[0]?.click();
      await waitForAsyncWork();
    });

    expect(clipboardWriteText).toHaveBeenCalledWith("deployment already completed");
  });

  it("shows compact multi-game highlights in the main launch card", async () => {
    const seriesRun = buildRun({
      kind: "series",
      name: "bltz-knicker",
      status: "running",
      steps: [
        {
          id: "create-series" as const,
          title: "Create series",
          summary: "Series ready.",
          workflowName: "create-series",
          status: "succeeded" as const,
          verification: "Series ready.",
          latestEvent: "Series ready.",
        },
        {
          id: "create-worlds" as const,
          title: "Create worlds",
          summary: "Deploying games.",
          workflowName: "create-worlds",
          status: "running" as const,
          verification: "Deploying games.",
          latestEvent: "Deploying games.",
        },
        {
          id: "configure-worlds" as const,
          title: "Configure worlds",
          summary: "Pending.",
          workflowName: "configure-worlds",
          status: "pending" as const,
          verification: "Pending.",
          latestEvent: "Pending.",
        },
      ],
      children: [
        {
          id: "series-child-1",
          gameName: "bltz-knicker-01",
          seriesGameNumber: 1,
          startTimeIso: "2026-03-18T12:00:00.000Z",
          status: "succeeded",
          latestEvent: "Ready",
          currentStepId: null,
          steps: [],
          worldAddress: "0x111",
        },
        {
          id: "series-child-2",
          gameName: "bltz-knicker-02",
          seriesGameNumber: 2,
          startTimeIso: "2026-03-18T13:00:00.000Z",
          status: "running",
          latestEvent: "Configuring",
          currentStepId: "configure-worlds",
          steps: [],
          worldAddress: "0x222",
        },
        {
          id: "series-child-3",
          gameName: "bltz-knicker-03",
          seriesGameNumber: 3,
          startTimeIso: "2026-03-18T14:00:00.000Z",
          status: "pending",
          latestEvent: "Queued",
          currentStepId: "create-worlds",
          steps: [],
        },
      ],
    });

    await act(async () => {
      root.render(
        <FactoryV2WatchWorkspace
          mode="blitz"
          runs={[seriesRun]}
          selectedRun={seriesRun}
          activeRunName={null}
          acceptedRunMessage={null}
          watcher={null}
          pollingState={{ status: "idle", detail: "Idle", lastCheckedAt: null }}
          isWatcherBusy={false}
          isResolvingRunName={false}
          notice={null}
          lookupDisabledReason={null}
          onSelectRun={vi.fn()}
          onResolveRunByName={vi.fn(async () => false)}
          onContinue={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const selectedPanel = container.querySelector('[data-testid="factory-watch-selected-panel"]');

    expect(selectedPanel?.textContent).toContain("1 ready");
    expect(selectedPanel?.textContent).toContain("1 working");
    expect(selectedPanel?.textContent).toContain("1 pending");
    expect(selectedPanel?.textContent).toContain("We’re still moving through setup.");
  });
});
