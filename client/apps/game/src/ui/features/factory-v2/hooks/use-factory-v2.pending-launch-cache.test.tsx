import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FactoryWorkerGameRunRecord, FactoryWorkerSeriesRunRecord } from "../api/factory-worker";
import { readFactoryPendingLaunches, writeFactoryPendingLaunches } from "../pending-launch-storage";
import { useFactoryV2 } from "./use-factory-v2";

vi.mock("../api/factory-worker", () => {
  class MockFactoryWorkerApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly payload?: unknown,
    ) {
      super(message);
      this.name = "FactoryWorkerApiError";
    }
  }

  return {
    FactoryWorkerApiError: MockFactoryWorkerApiError,
    listFactoryRuns: vi.fn(),
    readFactoryRunIfPresent: vi.fn(),
    readFactoryRunByNameIfPresent: vi.fn(),
    readFactorySeriesRunIfPresent: vi.fn(),
    createFactoryRun: vi.fn(),
    createFactorySeriesRun: vi.fn(),
    continueFactoryRun: vi.fn(),
    continueFactorySeriesRun: vi.fn(),
    isFactoryWorkerEnvironmentSupported: vi.fn((environmentId: string) =>
      ["slot.eternum", "mainnet.eternum", "slot.blitz", "mainnet.blitz"].includes(environmentId),
    ),
  };
});

vi.mock("@/hooks/use-factory-series", () => ({
  useFactorySeries: vi.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
    error: null,
  })),
}));

vi.mock("../funny-names", () => ({
  buildFandomizedGameName: vi.fn((mode: string, sequenceNumber: number) => `${mode}-launch-${sequenceNumber}`),
}));

vi.mock("./use-factory-v2-map-options", () => ({
  useFactoryV2MoreOptions: vi.fn(() => ({
    isOpen: false,
    sections: [],
    draft: {},
    errors: {},
    launchDisabledReason: null,
    mapConfigOverrides: undefined,
    blitzRegistrationOverrides: undefined,
    hasInvalidValues: false,
    toggleOpen: vi.fn(),
    setValue: vi.fn(),
  })),
}));

import {
  FactoryWorkerApiError,
  createFactoryRun,
  createFactorySeriesRun,
  listFactoryRuns,
  readFactoryRunByNameIfPresent,
  readFactoryRunIfPresent,
  readFactorySeriesRunIfPresent,
} from "../api/factory-worker";

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

let latestFactory: ReturnType<typeof useFactoryV2> | null = null;

function HookHarness() {
  latestFactory = useFactoryV2();

  return (
    <div>
      <div data-testid="run-ids">{latestFactory.modeRuns.map((run) => run.id).join("|")}</div>
      <div data-testid="selected-run">{latestFactory.selectedRun?.id ?? ""}</div>
      <div data-testid="pending-run-name">{latestFactory.pendingRunName ?? ""}</div>
      <div data-testid="notice">{latestFactory.notice ?? ""}</div>
    </div>
  );
}

const buildRunRecord = (overrides: Partial<FactoryWorkerGameRunRecord> = {}): FactoryWorkerGameRunRecord => ({
  version: 1,
  runId: "run-1",
  environment: "slot.eternum",
  chain: "slot",
  gameType: "eternum",
  gameName: "eternum-launch-1",
  status: "running",
  executionMode: "fast_trial",
  requestedLaunchStep: "full",
  inputPath: "/tmp/input.json",
  latestLaunchRequestId: "launch-1",
  currentStepId: "create-world",
  createdAt: "2026-03-19T10:00:00.000Z",
  updatedAt: "2026-03-19T10:01:00.000Z",
  workflow: {
    workflowName: "game-launch.yml",
  },
  steps: [
    {
      id: "create-world",
      title: "Create the game",
      status: "running",
      workflowStepName: "create-world",
      latestEvent: "Creating the game.",
    },
    {
      id: "wait-for-factory-index",
      title: "Wait for the game to appear",
      status: "pending",
      workflowStepName: "wait-for-factory-index",
      latestEvent: "Waiting for the game to show up.",
    },
  ],
  artifacts: {},
  ...overrides,
});

const buildSeriesRunRecord = (overrides: Partial<FactoryWorkerSeriesRunRecord> = {}): FactoryWorkerSeriesRunRecord => ({
  version: 1,
  kind: "series",
  runId: "series-run-1",
  environment: "slot.blitz",
  chain: "slot",
  gameType: "blitz",
  seriesName: "bltz-weekend-cup",
  status: "running",
  executionMode: "fast_trial",
  requestedLaunchStep: "full",
  inputPath: "/tmp/series-input.json",
  latestLaunchRequestId: "series-launch-1",
  currentStepId: "create-worlds",
  createdAt: "2026-03-19T10:00:00.000Z",
  updatedAt: "2026-03-19T10:01:00.000Z",
  workflow: {
    workflowName: "game-launch.yml",
  },
  autoRetry: {
    enabled: true,
    intervalMinutes: 15,
  },
  steps: [
    {
      id: "create-series",
      title: "Create series",
      status: "succeeded",
      workflowStepName: "create-series",
      latestEvent: "Series created.",
    },
    {
      id: "create-worlds",
      title: "Create worlds",
      status: "running",
      workflowStepName: "create-worlds",
      latestEvent: "Creating worlds.",
    },
  ],
  summary: {
    environment: "slot.blitz",
    chain: "slot",
    gameType: "blitz",
    seriesName: "bltz-weekend-cup",
    rpcUrl: "http://localhost:5050",
    factoryAddress: "0x123",
    autoRetryEnabled: true,
    autoRetryIntervalMinutes: 15,
    dryRun: false,
    configMode: "batched",
    seriesCreated: true,
    games: [
      {
        gameName: "bltz-weekend-cup-01",
        startTime: 1773837600,
        startTimeIso: "2026-03-18T10:00:00.000Z",
        seriesGameNumber: 1,
        currentStepId: "create-worlds",
        latestEvent: "World created.",
        status: "succeeded",
        artifacts: {},
      },
    ],
  },
  artifacts: {},
  ...overrides,
});

const getFactory = () => {
  if (!latestFactory) {
    throw new Error("Factory hook did not render.");
  }

  return latestFactory;
};

describe("useFactoryV2 pending launch cache", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalLocalStorageDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latestFactory = null;
    originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");

    vi.mocked(listFactoryRuns).mockResolvedValue([]);
    vi.mocked(readFactoryRunIfPresent).mockResolvedValue(null);
    vi.mocked(readFactoryRunByNameIfPresent).mockImplementation(async (_environment, runName) =>
      buildRunRecord({ gameName: runName, runId: `run:${runName}` }),
    );
    vi.mocked(readFactorySeriesRunIfPresent).mockResolvedValue(null);
    vi.mocked(createFactoryRun).mockResolvedValue(undefined);
    vi.mocked(createFactorySeriesRun).mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await waitForAsyncWork();
    });

    if (originalLocalStorageDescriptor) {
      Object.defineProperty(window, "localStorage", originalLocalStorageDescriptor);
    }

    writeFactoryPendingLaunches([]);
    container.remove();
    vi.clearAllMocks();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("writes the pending cache before the existing-run preflight resolves", async () => {
    vi.mocked(readFactoryRunIfPresent).mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      root.render(<HookHarness />);
      await waitForAsyncWork();
    });

    await act(async () => {
      void getFactory().launchSelectedPreset();
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(readFactoryPendingLaunches()).toEqual([
        {
          environmentId: "slot.blitz",
          name: "blitz-launch-1",
          mode: "blitz",
          kind: "game",
          createdAt: expect.any(String),
        },
      ]);
    });

    expect(getFactory().selectedRun?.id).toBe("pending:game:slot.blitz:blitz-launch-1");
    expect(getFactory().pendingRunName).toBe("blitz-launch-1");
  });

  it("rehydrates a just-started pending launch after remount while preflight is still unresolved", async () => {
    vi.mocked(readFactoryRunIfPresent).mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      root.render(<HookHarness />);
      await waitForAsyncWork();
    });

    await act(async () => {
      void getFactory().launchSelectedPreset();
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(readFactoryPendingLaunches()).toEqual([
        {
          environmentId: "slot.blitz",
          name: "blitz-launch-1",
          mode: "blitz",
          kind: "game",
          createdAt: expect.any(String),
        },
      ]);
    });

    await act(async () => {
      root.unmount();
      await waitForAsyncWork();
    });

    root = createRoot(container);

    await act(async () => {
      root.render(<HookHarness />);
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(getFactory().selectedRun?.id).toBe("pending:game:slot.blitz:blitz-launch-1");
    });

    expect(getFactory().selectedMode).toBe("blitz");
    expect(getFactory().selectedEnvironmentId).toBe("slot.blitz");
    expect(getFactory().pendingRunName).toBe("blitz-launch-1");
  });

  it("writes a pending cache entry as soon as launch begins", async () => {
    vi.mocked(createFactoryRun).mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      root.render(<HookHarness />);
      await waitForAsyncWork();
    });

    await act(async () => {
      void getFactory().launchSelectedPreset();
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(readFactoryPendingLaunches()).toEqual([
        {
          environmentId: "slot.blitz",
          name: "blitz-launch-1",
          mode: "blitz",
          kind: "game",
          createdAt: expect.any(String),
        },
      ]);
    });

    expect(getFactory().selectedMode).toBe("blitz");
    expect(getFactory().modeRuns[0]?.id).toBe("pending:game:slot.blitz:blitz-launch-1");
    expect(getFactory().pendingRunName).toBe("blitz-launch-1");
    expect(getFactory().modeRuns[0]?.steps.map((step) => step.id)).toEqual([
      "launch-request",
      "create-world",
      "wait-for-factory-index",
      "configure-world",
      "grant-lootchest-role",
      "create-indexer",
    ]);
  });

  it("hydrates cached pending launches into the selected environment after remount", async () => {
    writeFactoryPendingLaunches([
      {
        environmentId: "slot.eternum",
        name: "cached-launch",
        mode: "eternum",
        kind: "game",
        createdAt: "2026-03-19T09:00:00.000Z",
      },
    ]);

    await act(async () => {
      root.render(<HookHarness />);
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(getFactory().modeRuns[0]?.id).toBe("pending:game:slot.eternum:cached-launch");
    });

    expect(getFactory().selectedMode).toBe("eternum");
    expect(getFactory().selectedEnvironmentId).toBe("slot.eternum");
    expect(getFactory().selectedRun?.id).toBe("pending:game:slot.eternum:cached-launch");
    expect(getFactory().pendingRunName).toBe("cached-launch");
  });

  it("adds the paymaster step to cached mainnet launches", async () => {
    writeFactoryPendingLaunches([
      {
        environmentId: "mainnet.eternum",
        name: "mainnet-launch",
        mode: "eternum",
        kind: "game",
        createdAt: "2026-03-21T09:00:00.000Z",
      },
    ]);

    await act(async () => {
      root.render(<HookHarness />);
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(getFactory().modeRuns[0]?.id).toBe("pending:game:mainnet.eternum:mainnet-launch");
    });

    expect(getFactory().selectedEnvironmentId).toBe("mainnet.eternum");
    expect(getFactory().environmentUnavailableReason).toBeNull();
    expect(getFactory().modeRuns[0]?.steps.map((step) => step.id)).toEqual([
      "launch-request",
      "create-world",
      "wait-for-factory-index",
      "configure-world",
      "grant-lootchest-role",
      "grant-village-pass-role",
      "create-banks",
      "create-indexer",
      "sync-paymaster",
    ]);
  });

  it("clears cached pending launches when the run list already contains the real run", async () => {
    const realRun = buildRunRecord({
      runId: "run-real-1",
      gameName: "cached-launch",
      updatedAt: "2026-03-19T11:00:00.000Z",
    });

    writeFactoryPendingLaunches([
      {
        environmentId: "slot.eternum",
        name: "cached-launch",
        mode: "eternum",
        kind: "game",
        createdAt: "2026-03-19T09:00:00.000Z",
      },
    ]);
    vi.mocked(listFactoryRuns).mockResolvedValue([realRun]);
    vi.mocked(readFactoryRunByNameIfPresent).mockResolvedValue(realRun);

    await act(async () => {
      root.render(<HookHarness />);
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(readFactoryPendingLaunches()).toEqual([]);
    });

    expect(getFactory().modeRuns[0]?.id).toBe("run-real-1");
    expect(getFactory().selectedRun?.id).toBe("run-real-1");
  });

  it("clears cached pending launches when polling finds the real run record", async () => {
    const realRun = buildRunRecord({
      runId: "run-real-2",
      gameName: "cached-launch",
      updatedAt: "2026-03-19T11:15:00.000Z",
    });

    writeFactoryPendingLaunches([
      {
        environmentId: "slot.eternum",
        name: "cached-launch",
        mode: "eternum",
        kind: "game",
        createdAt: "2026-03-19T09:00:00.000Z",
      },
    ]);
    vi.mocked(readFactoryRunIfPresent).mockResolvedValue(realRun);
    vi.mocked(readFactoryRunByNameIfPresent).mockResolvedValue(realRun);

    await act(async () => {
      root.render(<HookHarness />);
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(readFactoryPendingLaunches()).toEqual([]);
    });

    await vi.waitFor(() => {
      expect(getFactory().selectedRun?.id).toBe("run-real-2");
    });

    expect(getFactory().modeRuns[0]?.id).toBe("run-real-2");
  });

  it("clears the pending cache when a conflicting launch opens the real run", async () => {
    const realRun = buildRunRecord({
      runId: "run-conflict-1",
      environment: "slot.blitz",
      gameType: "blitz",
      gameName: "blitz-launch-1",
      updatedAt: "2026-03-19T11:30:00.000Z",
    });

    vi.mocked(readFactoryRunIfPresent).mockResolvedValueOnce(null).mockResolvedValueOnce(realRun);
    vi.mocked(readFactoryRunByNameIfPresent).mockResolvedValue(realRun);
    vi.mocked(createFactoryRun).mockRejectedValue(new FactoryWorkerApiError("Conflict", 409));

    await act(async () => {
      root.render(<HookHarness />);
      await waitForAsyncWork();
    });

    await act(async () => {
      await expect(getFactory().launchSelectedPreset()).resolves.toBe(true);
      await waitForAsyncWork();
    });

    expect(readFactoryPendingLaunches()).toEqual([]);
    expect(getFactory().selectedRun?.id).toBe("run-conflict-1");
    expect(createFactoryRun).toHaveBeenCalledTimes(1);
    expect(readFactoryRunIfPresent).toHaveBeenCalledTimes(3);
  });

  it("clears the pending cache when launch fails before a run appears", async () => {
    vi.mocked(readFactoryRunIfPresent).mockResolvedValue(null);
    vi.mocked(createFactoryRun).mockRejectedValue(new Error("Network exploded"));

    await act(async () => {
      root.render(<HookHarness />);
      await waitForAsyncWork();
    });

    await act(async () => {
      await expect(getFactory().launchSelectedPreset()).resolves.toBe(false);
      await waitForAsyncWork();
    });

    expect(readFactoryPendingLaunches()).toEqual([]);
    expect(getFactory().modeRuns).toEqual([]);
    expect(getFactory().notice).toBe("Network exploded");
  });

  it("keeps the in-memory pending run working when localStorage is unavailable", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("localStorage unavailable");
      },
    });
    vi.mocked(createFactoryRun).mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      root.render(<HookHarness />);
      await waitForAsyncWork();
    });

    await act(async () => {
      void getFactory().launchSelectedPreset();
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(getFactory().modeRuns[0]?.id).toBe("pending:game:slot.blitz:blitz-launch-1");
    });

    expect(getFactory().pendingRunName).toBe("blitz-launch-1");
  });

  it("still dispatches a series launch when the series already has a parent run", async () => {
    const existingSeriesRun = buildSeriesRunRecord();

    vi.mocked(listFactoryRuns).mockResolvedValue([existingSeriesRun]);
    vi.mocked(createFactorySeriesRun).mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      root.render(<HookHarness />);
      await waitForAsyncWork();
    });

    await act(async () => {
      getFactory().selectLaunchKind("series");
      getFactory().setDraftSeriesName("bltz-weekend-cup");
      await waitForAsyncWork();
    });

    await act(async () => {
      void getFactory().launchSelectedPreset();
      await waitForAsyncWork();
    });

    await vi.waitFor(() => {
      expect(createFactorySeriesRun).toHaveBeenCalledTimes(1);
    });

    expect(createFactorySeriesRun).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: "slot.blitz",
        seriesName: "bltz-weekend-cup",
      }),
    );
    expect(getFactory().pendingRunName).toBe("bltz-weekend-cup");
    expect(getFactory().selectedRun?.id).toBe("pending:series:slot.blitz:bltz-weekend-cup");
  });
});
