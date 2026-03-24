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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
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
    expect(container.textContent).not.toContain("Run now");
    expect(container.textContent).not.toContain("Stop auto retry");
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Run now");
    expect(container.textContent).toContain("Stop auto retry");
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).not.toContain("Run now");
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
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

    expect(searchPanel?.textContent).toContain(missingRunNotice);
    expect(selectedPanel?.textContent).not.toContain(missingRunNotice);
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).not.toContain("Continue");
  });

  it("lets operators check a child indexer without reopening the whole parent run", async () => {
    const onBringChildIndexerLive = vi.fn();
    const rotationRun = buildRun({
      kind: "rotation",
      status: "complete",
      name: "bltz-knicker",
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
        {
          id: "create-indexers" as const,
          title: "Create indexers",
          summary: "done",
          workflowName: "create-indexers",
          status: "succeeded" as const,
          verification: "done",
          latestEvent: "done",
        },
      ],
      children: [
        {
          id: "rotation-child-1",
          gameName: "bltz-knicker-01",
          seriesGameNumber: 1,
          startTimeIso: "2026-03-18T12:00:00.000Z",
          status: "succeeded",
          latestEvent: "Indexer is live",
          currentStepId: null,
          steps: [],
          worldAddress: "0x111",
          indexerCreated: true,
        },
        {
          id: "rotation-child-2",
          gameName: "bltz-knicker-02",
          seriesGameNumber: 2,
          startTimeIso: "2026-03-18T13:00:00.000Z",
          status: "failed",
          latestEvent: "Indexer needs attention",
          currentStepId: "create-indexers",
          steps: [],
          worldAddress: "0x222",
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={onBringChildIndexerLive}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Check indexer");
    expect(container.textContent).toContain("Retry indexer");

    const checkButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Check indexer"),
    );

    expect(checkButton).toBeTruthy();

    checkButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onBringChildIndexerLive).toHaveBeenCalledWith("bltz-knicker-01");
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
          onFundPrize={onFundPrize}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).not.toContain("Admin prize funding");

    await openPrizeFundingSection(container);

    const amountInput = container.querySelector('[data-testid="factory-prize-amount"]') as HTMLInputElement | null;
    const secretInput = container.querySelector('[data-testid="factory-prize-secret"]') as HTMLInputElement | null;
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
      if (!amountInput || !secretInput || !submitButton) {
        throw new Error("Expected prize funding controls to be rendered");
      }

      setInputValue(amountInput, "250");
      setInputValue(secretInput, "factory-secret");
      submitButton.click();
      await waitForAsyncWork();
    });

    expect(onFundPrize).toHaveBeenCalledWith({
      amount: "250",
      adminSecret: "factory-secret",
      selectedGameNames: ["bltz-weekend-cup-01"],
    });
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={onStopAutoRetry}
          onFundPrize={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const stopAutoRetryButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Stop auto retry"),
    );

    expect(stopAutoRetryButton).toBeTruthy();

    await act(async () => {
      (stopAutoRetryButton as HTMLButtonElement).click();
      await waitForAsyncWork();
    });

    expect(onStopAutoRetry).toHaveBeenCalledTimes(1);
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
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
          onBringIndexerLive={vi.fn()}
          onBringChildIndexerLive={vi.fn()}
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
