import { beforeEach, describe, expect, it } from "vitest";

import {
  DEV_PREVIEW_ENTRY_STORAGE_KEY,
  useDevPreviewEntryStore,
  type DevPreviewEntryStateRecord,
} from "./use-dev-preview-entry-store";

const alphaEntry: DevPreviewEntryStateRecord = {
  previewEntered: true,
  enteredAt: 100,
  loadoutWorldKey: "blitz:slot:alpha",
};

describe("useDevPreviewEntryStore", () => {
  beforeEach(async () => {
    window.sessionStorage.clear();
    useDevPreviewEntryStore.setState({ entries: {} });
    await useDevPreviewEntryStore.persist.clearStorage();
  });

  it("supports set, get, and reset by preview world key", () => {
    useDevPreviewEntryStore.getState().setPreviewEntry("slot:alpha:0x123", alphaEntry);

    expect(useDevPreviewEntryStore.getState().getPreviewEntry("slot:alpha:0x123")).toEqual(alphaEntry);
    expect(useDevPreviewEntryStore.getState().hasPreviewEntry("slot:alpha:0x123")).toBe(true);

    useDevPreviewEntryStore.getState().clearPreviewEntry("slot:alpha:0x123");

    expect(useDevPreviewEntryStore.getState().getPreviewEntry("slot:alpha:0x123")).toBeUndefined();
    expect(useDevPreviewEntryStore.getState().hasPreviewEntry("slot:alpha:0x123")).toBe(false);
  });

  it("keeps preview entries isolated by account and world", () => {
    useDevPreviewEntryStore.getState().setPreviewEntry("slot:alpha:0x123", alphaEntry);
    useDevPreviewEntryStore.getState().setPreviewEntry("slot:beta:0x123", {
      previewEntered: true,
      enteredAt: 200,
      loadoutWorldKey: "blitz:slot:beta",
    });
    useDevPreviewEntryStore.getState().setPreviewEntry("slot:alpha:0x456", {
      previewEntered: true,
      enteredAt: 300,
      loadoutWorldKey: "blitz:slot:alpha",
    });

    expect(Object.keys(useDevPreviewEntryStore.getState().entries)).toEqual([
      "slot:alpha:0x123",
      "slot:beta:0x123",
      "slot:alpha:0x456",
    ]);
  });

  it("mirrors preview state into session storage for refresh restore within the current browser session", () => {
    useDevPreviewEntryStore.getState().setPreviewEntry("slot:alpha:0x123", alphaEntry);

    const persisted = window.sessionStorage.getItem(DEV_PREVIEW_ENTRY_STORAGE_KEY);
    expect(persisted).toContain('"slot:alpha:0x123"');
    expect(JSON.parse(persisted ?? "{}")).toMatchObject({
      state: {
        entries: {
          "slot:alpha:0x123": alphaEntry,
        },
      },
    });
  });
});
