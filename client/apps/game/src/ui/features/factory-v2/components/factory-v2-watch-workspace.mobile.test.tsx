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
    const doneMoment = container.querySelector('[data-step-tone="done"]');
    const nowMoment = container.querySelector('[data-step-tone="now"]');
    const nextMoment = container.querySelector('[data-step-tone="next"]');

    expect(article?.className).toContain("w-full");
    expect(article?.className).toContain("md:max-w-md");
    expect(searchPanel?.textContent).toContain("Find a game");
    expect(searchPanel?.textContent).toContain("recent games");
    expect(selectedPanel?.textContent).toContain("Setup progress");
    expect(selectedPanel?.textContent).toContain("In progress");
    expect(selectedPanel?.textContent).toContain("3 of 4 parts");
    expect(selectedPanel?.textContent).toContain("Step 3 of 4");
    expect(gameNameInput?.className).toContain("text-center");
    expect(doneMoment?.className).toContain("opacity-45");
    expect(nowMoment?.className).toContain("shadow-[0_20px_40px_rgba(157,107,36,0.14)]");
    expect(nextMoment?.className).toContain("border-dashed");
    expect(nextMoment?.className).toContain("opacity-70");
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
        />,
      );
      await waitForAsyncWork();
    });

    const selectedPanel = container.querySelector('[data-testid="factory-watch-selected-panel"]');

    expect(selectedPanel?.textContent).toContain("1 of 6 parts");
    expect(selectedPanel?.textContent).toContain("Step 1 of 6");
  });
});
