import { act } from "react";
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

function buildLiveIndexerEntry(gameName: string, tier: "basic" | "pro" | "legendary" | "epic") {
  return {
    gameName,
    updatedAt: "2026-03-24T10:00:00.000Z",
    liveState: {
      state: "existing" as const,
      stateSource: "describe" as const,
      currentTier: tier,
      branch: "main",
      url: `https://torii.example/${gameName}`,
    },
  };
}

describe("FactoryV2ManageIndexersWorkspace", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
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
    window.localStorage.clear();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("auto-loads the saved list when a stored admin secret already exists", async () => {
    const onLoadLiveIndexers = vi.fn(async () => {});
    window.localStorage.setItem("factory-v2-admin-secret", "saved-secret");

    await act(async () => {
      root.render(
        <FactoryV2ManageIndexersWorkspace
          environmentLabel="Slot"
          liveIndexers={[buildLiveIndexerEntry("bltz-franky-01", "pro")]}
          liveIndexersUpdatedAt="2026-03-24T10:00:00.000Z"
          notice="Loaded from the stored live snapshot."
          isBusy={false}
          onLoadLiveIndexers={onLoadLiveIndexers}
          onRefreshLiveIndexers={vi.fn()}
          onCreateIndexers={vi.fn()}
          onUpdateIndexerTier={vi.fn()}
          onDeleteIndexers={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("Refresh the live list, tap the games, choose one action.");
    expect(container.textContent).toContain("Saved on this browser.");
    expect(container.textContent).toContain("bltz-franky-01");
    expect(container.textContent).toContain("pro");
    expect(onLoadLiveIndexers).toHaveBeenCalledWith({
      adminSecret: "saved-secret",
      gameNames: [],
    });
  });

  it("saves and clears the admin secret from localStorage", async () => {
    await act(async () => {
      root.render(
        <FactoryV2ManageIndexersWorkspace
          environmentLabel="Slot"
          liveIndexers={[]}
          liveIndexersUpdatedAt={null}
          notice={null}
          isBusy={false}
          onLoadLiveIndexers={vi.fn()}
          onRefreshLiveIndexers={vi.fn()}
          onCreateIndexers={vi.fn()}
          onUpdateIndexerTier={vi.fn()}
          onDeleteIndexers={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const secretField = container.querySelector('[data-testid="factory-indexer-admin-secret"]') as HTMLInputElement;
    const saveButton = container.querySelector('[data-testid="factory-indexer-admin-save"]') as HTMLButtonElement;
    const clearButton = container.querySelector('[data-testid="factory-indexer-admin-clear"]') as HTMLButtonElement;

    await act(async () => {
      setControlValue(secretField, "factory-secret");
      await waitForAsyncWork();
    });

    await act(async () => {
      saveButton.click();
      await waitForAsyncWork();
    });

    expect(window.localStorage.getItem("factory-v2-admin-secret")).toBe("factory-secret");

    await act(async () => {
      clearButton.click();
      await waitForAsyncWork();
    });

    expect(window.localStorage.getItem("factory-v2-admin-secret")).toBeNull();
    expect(secretField.value).toBe("");
  });

  it("loads and refreshes typed names only after the manual lookup is opened", async () => {
    const onLoadLiveIndexers = vi.fn(async () => {});
    const onRefreshLiveIndexers = vi.fn(async () => {});

    await act(async () => {
      root.render(
        <FactoryV2ManageIndexersWorkspace
          environmentLabel="Slot"
          liveIndexers={[]}
          liveIndexersUpdatedAt={null}
          notice={null}
          isBusy={false}
          onLoadLiveIndexers={onLoadLiveIndexers}
          onRefreshLiveIndexers={onRefreshLiveIndexers}
          onCreateIndexers={vi.fn()}
          onUpdateIndexerTier={vi.fn()}
          onDeleteIndexers={vi.fn()}
        />,
      );
      await waitForAsyncWork();
    });

    const secretField = container.querySelector('[data-testid="factory-indexer-admin-secret"]') as HTMLInputElement;
    const openLookupButton = container.querySelector(
      '[data-testid="factory-indexer-open-lookup"]',
    ) as HTMLButtonElement;
    const loadButton = container.querySelector('[data-testid="factory-indexer-load"]') as HTMLButtonElement;
    const refreshButton = container.querySelector('[data-testid="factory-indexer-refresh"]') as HTMLButtonElement;

    await act(async () => {
      setControlValue(secretField, "factory-secret");
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

  it("runs recreate, tier change, and delete against the selected indexers", async () => {
    const onCreateIndexers = vi.fn(async () => {});
    const onUpdateIndexerTier = vi.fn(async () => {});
    const onDeleteIndexers = vi.fn(async () => {});

    await act(async () => {
      root.render(
        <FactoryV2ManageIndexersWorkspace
          environmentLabel="Mainnet"
          liveIndexers={[
            buildLiveIndexerEntry("etrn-season-01", "basic"),
            buildLiveIndexerEntry("etrn-season-02", "pro"),
          ]}
          liveIndexersUpdatedAt="2026-03-24T10:00:00.000Z"
          notice={null}
          isBusy={false}
          onLoadLiveIndexers={vi.fn()}
          onRefreshLiveIndexers={vi.fn()}
          onCreateIndexers={onCreateIndexers}
          onUpdateIndexerTier={onUpdateIndexerTier}
          onDeleteIndexers={onDeleteIndexers}
        />,
      );
      await waitForAsyncWork();
    });

    const secretField = container.querySelector('[data-testid="factory-indexer-admin-secret"]') as HTMLInputElement;
    const firstRow = container.querySelector(
      '[data-testid="factory-indexer-select-etrn-season-01"]',
    ) as HTMLButtonElement;
    const secondRow = container.querySelector(
      '[data-testid="factory-indexer-select-etrn-season-02"]',
    ) as HTMLButtonElement;
    const createButton = container.querySelector('[data-testid="factory-indexer-action-create"]') as HTMLButtonElement;
    const deleteButton = container.querySelector('[data-testid="factory-indexer-action-delete"]') as HTMLButtonElement;
    const legendaryButton = container.querySelector(
      '[data-testid="factory-indexer-action-legendary"]',
    ) as HTMLButtonElement;

    await act(async () => {
      setControlValue(secretField, "factory-secret");
      await waitForAsyncWork();
    });

    await act(async () => {
      firstRow.click();
      secondRow.click();
      await waitForAsyncWork();
    });

    expect(container.textContent).toContain("2 indexers selected");

    await act(async () => {
      createButton.click();
      legendaryButton.click();
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
});
