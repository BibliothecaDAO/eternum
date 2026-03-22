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

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
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
          onRetry={vi.fn()}
          onBringIndexerLive={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
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
          onRetry={vi.fn()}
          onBringIndexerLive={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const selectedPanel = container.querySelector('[data-testid="factory-watch-selected-panel"]');

    expect(selectedPanel?.textContent).toContain("1 of 6 parts");
    expect(selectedPanel?.textContent).toContain("Step 1 of 6");
  });

  it("shows rotation schedule details and a run-now action for rotation runs", async () => {
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
          onRetry={vi.fn()}
          onBringIndexerLive={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={onNudge}
          onStopAutoRetry={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Rotation schedule");
    expect(container.textContent).toContain("Created");
    expect(container.textContent).toContain("4 of 12");
    expect(container.textContent).toContain("Queued ahead");
    expect(container.textContent).toContain("Rotation games");
    expect(container.textContent).toContain("Run now");
    expect(container.textContent).toContain("Stop auto retry");
  });

  it("stops auto retry from the watch action bar for active multi-game runs", async () => {
    const onStopAutoRetry = vi.fn();
    const seriesRun = buildRun({
      kind: "series",
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
          onRetry={vi.fn()}
          onBringIndexerLive={vi.fn()}
          onRefresh={vi.fn()}
          onNudge={vi.fn()}
          onStopAutoRetry={onStopAutoRetry}
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
});
