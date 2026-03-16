// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { Chain } from "@contracts";
import {
  buildDevPreviewWorldKey,
  createWorldPreviewEntryController,
  type DevPreviewEntryStateRecord,
} from "./use-world-preview-entry";

const createPreviewStore = () => {
  const entries = new Map<string, DevPreviewEntryStateRecord>();

  return {
    entries,
    setPreviewEntry: vi.fn((key: string, entry: DevPreviewEntryStateRecord) => {
      entries.set(key, entry);
    }),
  };
};

describe("buildDevPreviewWorldKey", () => {
  it("keys preview state by chain, world, and account", () => {
    expect(
      buildDevPreviewWorldKey({
        chain: "slot",
        worldName: "san-juan",
        address: "0xabcDEF",
      }),
    ).toBe("slot:san-juan:0xabcdef");
  });
});

describe("createWorldPreviewEntryController", () => {
  it("disables preview entry outside development builds", async () => {
    const previewStore = createPreviewStore();
    const controller = createWorldPreviewEntryController({
      isDev: false,
      address: "0x123",
      chain: "slot",
      worldName: "alpha",
      previewEntries: previewStore,
    });

    expect(controller.canPreviewEnter).toBe(false);
    await expect(controller.enterPreview()).rejects.toThrow("only available in development builds");
    expect(previewStore.setPreviewEntry).not.toHaveBeenCalled();
  });

  it("records preview entry state under an account and world scoped key", async () => {
    const previewStore = createPreviewStore();
    const now = vi.fn(() => 123456789);
    const chain: Chain = "mainnet";
    const controller = createWorldPreviewEntryController({
      isDev: true,
      enabled: true,
      address: "0x123",
      chain,
      worldName: "eternum-1",
      now,
      previewEntries: previewStore,
    });

    await controller.enterPreview();

    expect(previewStore.setPreviewEntry).toHaveBeenCalledWith("mainnet:eternum-1:0x123", {
      previewEntered: true,
      enteredAt: 123456789,
      loadoutWorldKey: "blitz:mainnet:eternum-1",
    });
  });
});
