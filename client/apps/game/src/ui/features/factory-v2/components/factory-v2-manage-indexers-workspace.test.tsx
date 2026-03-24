import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FactoryV2ManageIndexersWorkspace } from "./factory-v2-manage-indexers-workspace";

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function setControlValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set;

  if (!descriptor) {
    throw new Error("Expected value setter to exist");
  }

  descriptor.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function buildLiveIndexerEntry(
  gameName: string,
  options: {
    state?: "existing" | "missing" | "indeterminate";
    tier?: "basic" | "pro" | "legendary" | "epic";
  } = {},
) {
  const state = options.state ?? "existing";

  if (state === "missing") {
    return {
      gameName,
      updatedAt: "2026-03-24T10:00:00.000Z",
      liveState: {
        state: "missing" as const,
        stateSource: "describe-not-found" as const,
      },
    };
  }

  if (state === "indeterminate") {
    return {
      gameName,
      updatedAt: "2026-03-24T10:00:00.000Z",
      liveState: {
        state: "indeterminate" as const,
        stateSource: "describe-and-list-failed" as const,
        describeError: "timed out",
      },
    };
  }

  return {
    gameName,
    updatedAt: "2026-03-24T10:00:00.000Z",
    liveState: {
      state: "existing" as const,
      stateSource: "describe" as const,
      currentTier: options.tier ?? "pro",
      branch: "main",
      url: `https://torii.example/${gameName}`,
    },
  };
}

function buildProps(
  overrides: Partial<ComponentProps<typeof FactoryV2ManageIndexersWorkspace>> = {},
): ComponentProps<typeof FactoryV2ManageIndexersWorkspace> {
  return {
    mode: "eternum",
    watcher: null,
    adminSecret: "factory-secret",
    hasSavedAdminSecret: false,
    environmentLabel: "Slot",
    liveIndexers: [],
    liveIndexersUpdatedAt: null,
    notice: null,
    isBusy: false,
    onLoadLiveIndexers: vi.fn(async () => {}),
    onRefreshLiveIndexers: vi.fn(async () => {}),
    onCreateIndexers: vi.fn(async () => {}),
    onUpdateIndexerTier: vi.fn(async () => {}),
    onDeleteIndexers: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("FactoryV2ManageIndexersWorkspace", () => {
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

  it("starts with access only and hides games and actions until a snapshot exists", async () => {
    await act(async () => {
      root.render(
        <FactoryV2ManageIndexersWorkspace
          {...buildProps({
            mode: "blitz",
          })}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Access");
    expect(container.textContent).not.toContain("Games");
    expect(container.textContent).not.toContain("Action");
    expect(container.querySelector('[data-testid="factory-indexer-lookup-names"]')).toBeNull();
    expect(container.querySelector('[data-testid="factory-indexer-action-delete"]')).toBeNull();
    expect(container.querySelector('[data-testid="factory-indexer-open-delete"]')).toBeNull();
    expect(container.querySelector('[data-testid="factory-indexer-filter-all"]')).toBeNull();
  });

  it("auto-loads the saved list when a stored admin secret already exists", async () => {
    const onLoadLiveIndexers = vi.fn(async () => {});

    await act(async () => {
      root.render(
        <FactoryV2ManageIndexersWorkspace
          {...buildProps({
            adminSecret: "saved-secret",
            hasSavedAdminSecret: true,
            liveIndexers: [buildLiveIndexerEntry("bltz-franky-01", { tier: "pro" })],
            liveIndexersUpdatedAt: "2026-03-24T10:00:00.000Z",
            notice: "Loaded from the stored live snapshot.",
            onLoadLiveIndexers,
          })}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("bltz-franky-01");
    expect(container.textContent).toContain("pro");
    expect(onLoadLiveIndexers).toHaveBeenCalledWith({
      adminSecret: "saved-secret",
      gameNames: [],
    });
  });

  it("gates refresh controls on the shared admin secret", async () => {
    await act(async () => {
      root.render(
        <FactoryV2ManageIndexersWorkspace
          {...buildProps({
            adminSecret: "",
          })}
        />,
      );
      await waitForAsyncWork();
    });

    let loadButton = container.querySelector('[data-testid="factory-indexer-load"]') as HTMLButtonElement;
    let refreshButton = container.querySelector('[data-testid="factory-indexer-refresh"]') as HTMLButtonElement;

    expect(loadButton.disabled).toBe(true);
    expect(refreshButton.disabled).toBe(true);

    await act(async () => {
      root.render(<FactoryV2ManageIndexersWorkspace {...buildProps()} />);
      await waitForAsyncWork();
    });

    loadButton = container.querySelector('[data-testid="factory-indexer-load"]') as HTMLButtonElement;
    refreshButton = container.querySelector('[data-testid="factory-indexer-refresh"]') as HTMLButtonElement;

    expect(loadButton.disabled).toBe(false);
    expect(refreshButton.disabled).toBe(false);
  });

  it("loads and refreshes typed names only after the manual lookup is opened", async () => {
    const onLoadLiveIndexers = vi.fn(async () => {});
    const onRefreshLiveIndexers = vi.fn(async () => {});

    await act(async () => {
      root.render(
        <FactoryV2ManageIndexersWorkspace
          {...buildProps({
            onLoadLiveIndexers,
            onRefreshLiveIndexers,
          })}
        />,
      );
      await waitForAsyncWork();
    });

    const openLookupButton = container.querySelector(
      '[data-testid="factory-indexer-open-lookup"]',
    ) as HTMLButtonElement;
    const loadButton = container.querySelector('[data-testid="factory-indexer-load"]') as HTMLButtonElement;
    const refreshButton = container.querySelector('[data-testid="factory-indexer-refresh"]') as HTMLButtonElement;

    await act(async () => {
      openLookupButton.click();
      await waitForAsyncWork();
    });

    const namesField = container.querySelector('[data-testid="factory-indexer-lookup-names"]') as HTMLTextAreaElement;

    await act(async () => {
      setControlValue(namesField, "bltz-franky-01\nbltz-franky-02\nbltz-franky-01");
      await waitForAsyncWork();
    });

    await act(async () => {
      loadButton.click();
      refreshButton.click();
      await waitForAsyncWork();
    });

    expect(onLoadLiveIndexers).toHaveBeenCalledWith({
      adminSecret: "factory-secret",
      gameNames: ["bltz-franky-01", "bltz-franky-02"],
    });
    expect(onRefreshLiveIndexers).toHaveBeenCalledWith({
      adminSecret: "factory-secret",
      gameNames: ["bltz-franky-01", "bltz-franky-02"],
    });
  });

  it("filters the live list and drops selections that disappear from the data", async () => {
    await act(async () => {
      root.render(
        <FactoryV2ManageIndexersWorkspace
          {...buildProps({
            liveIndexers: [
              buildLiveIndexerEntry("etrn-live-01", { state: "existing", tier: "basic" }),
              buildLiveIndexerEntry("etrn-missing-01", { state: "missing" }),
              buildLiveIndexerEntry("etrn-check-01", { state: "indeterminate" }),
            ],
          })}
        />,
      );
      await waitForAsyncWork();
    });

    const missingFilter = container.querySelector(
      '[data-testid="factory-indexer-filter-missing"]',
    ) as HTMLButtonElement;

    await act(async () => {
      missingFilter.click();
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("etrn-missing-01");
    expect(container.textContent).not.toContain("etrn-live-01");
    expect(container.textContent).not.toContain("etrn-check-01");

    const missingRow = container.querySelector(
      '[data-testid="factory-indexer-select-etrn-missing-01"]',
    ) as HTMLButtonElement;

    await act(async () => {
      missingRow.click();
      await waitForAsyncWork();
    });

    expect(container.querySelector('[data-testid="factory-indexer-action-create"]')).not.toBeNull();

    await act(async () => {
      root.render(
        <FactoryV2ManageIndexersWorkspace
          {...buildProps({
            liveIndexers: [buildLiveIndexerEntry("etrn-live-01", { state: "existing", tier: "basic" })],
          })}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.querySelector('[data-testid="factory-indexer-action-create"]')).toBeNull();
  });

  it("shows the action card only after at least one game is selected", async () => {
    await act(async () => {
      root.render(
        <FactoryV2ManageIndexersWorkspace
          {...buildProps({
            liveIndexers: [buildLiveIndexerEntry("etrn-live-01", { state: "existing", tier: "basic" })],
          })}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.querySelector('[data-testid="factory-indexer-action-create"]')).toBeNull();
    expect(container.querySelector('[data-testid="factory-indexer-open-delete"]')).toBeNull();

    const liveRow = container.querySelector('[data-testid="factory-indexer-select-etrn-live-01"]') as HTMLButtonElement;

    await act(async () => {
      liveRow.click();
      await waitForAsyncWork();
    });

    expect(container.querySelector('[data-testid="factory-indexer-action-create"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="factory-indexer-open-delete"]')).not.toBeNull();
  });

  it("runs recreate, tier change, and delete against the selected indexers", async () => {
    const onCreateIndexers = vi.fn(async () => {});
    const onUpdateIndexerTier = vi.fn(async () => {});
    const onDeleteIndexers = vi.fn(async () => {});

    await act(async () => {
      root.render(
        <FactoryV2ManageIndexersWorkspace
          {...buildProps({
            environmentLabel: "Mainnet",
            liveIndexers: [
              buildLiveIndexerEntry("etrn-season-01", { tier: "basic" }),
              buildLiveIndexerEntry("etrn-season-02", { tier: "pro" }),
            ],
            liveIndexersUpdatedAt: "2026-03-24T10:00:00.000Z",
            onCreateIndexers,
            onUpdateIndexerTier,
            onDeleteIndexers,
          })}
        />,
      );
      await waitForAsyncWork();
    });
    const firstRow = container.querySelector(
      '[data-testid="factory-indexer-select-etrn-season-01"]',
    ) as HTMLButtonElement;
    const secondRow = container.querySelector(
      '[data-testid="factory-indexer-select-etrn-season-02"]',
    ) as HTMLButtonElement;

    await act(async () => {
      firstRow.click();
      secondRow.click();
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("2 indexers selected");

    const createButton = container.querySelector('[data-testid="factory-indexer-action-create"]') as HTMLButtonElement;

    await act(async () => {
      createButton.click();
      await waitForAsyncWork();
    });

    const tierModeButton = container.querySelector('[data-testid="factory-indexer-mode-tier"]') as HTMLButtonElement;

    await act(async () => {
      tierModeButton.click();
      await waitForAsyncWork();
    });

    const legendaryButton = container.querySelector(
      '[data-testid="factory-indexer-action-legendary"]',
    ) as HTMLButtonElement;
    const updateTierButton = container.querySelector(
      '[data-testid="factory-indexer-action-update-tier"]',
    ) as HTMLButtonElement;

    await act(async () => {
      legendaryButton.click();
      await waitForAsyncWork();
    });

    await act(async () => {
      updateTierButton.click();
      await waitForAsyncWork();
    });

    const openDeleteButton = container.querySelector(
      '[data-testid="factory-indexer-open-delete"]',
    ) as HTMLButtonElement;

    await act(async () => {
      openDeleteButton.click();
      await waitForAsyncWork();
    });

    const confirmDeleteButton = container.querySelector(
      '[data-testid="factory-indexer-confirm-delete"]',
    ) as HTMLButtonElement;

    await act(async () => {
      confirmDeleteButton.click();
      await waitForAsyncWork();
    });

    const deleteButton = container.querySelector('[data-testid="factory-indexer-action-delete"]') as HTMLButtonElement;

    await act(async () => {
      deleteButton.click();
      await waitForAsyncWork();
    });

    expect(onCreateIndexers).toHaveBeenCalledWith({
      adminSecret: "factory-secret",
      gameNames: ["etrn-season-01", "etrn-season-02"],
    });
    expect(onUpdateIndexerTier).toHaveBeenCalledWith({
      adminSecret: "factory-secret",
      gameNames: ["etrn-season-01", "etrn-season-02"],
      tier: "legendary",
    });
    expect(onDeleteIndexers).toHaveBeenCalledWith({
      adminSecret: "factory-secret",
      gameNames: ["etrn-season-01", "etrn-season-02"],
    });
  });

  it("shows watcher detail while indexer work is running", async () => {
    await act(async () => {
      root.render(
        <FactoryV2ManageIndexersWorkspace
          {...buildProps({
            isBusy: true,
            liveIndexers: [buildLiveIndexerEntry("etrn-season-01", { tier: "basic" })],
            watcher: {
              kind: "create_indexers",
              runName: "Slot",
              title: "Creating indexers",
              detail: "Creating or recreating 1 listed indexer.",
              workflowName: "factory-indexer-maintenance.yml",
              statusLabel: "Creating",
            },
          })}
        />,
      );
      await waitForAsyncWork();
    });

    const watcherCard = container.querySelector('[data-testid="factory-indexer-watcher"]') as HTMLDivElement;
    const refreshButton = container.querySelector('[data-testid="factory-indexer-refresh"]') as HTMLButtonElement;
    const createButton = container.querySelector('[data-testid="factory-indexer-action-create"]');

    expect(watcherCard.textContent).toContain("Creating indexers");
    expect(watcherCard.textContent).toContain("Creating or recreating 1 listed indexer.");
    expect(refreshButton.disabled).toBe(true);
    expect(createButton).toBeNull();
    expect(container.textContent).toContain("etrn-season-01");
  });
});
