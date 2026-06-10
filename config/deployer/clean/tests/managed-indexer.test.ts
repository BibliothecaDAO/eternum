import { afterEach, describe, expect, mock, test } from "bun:test";

const env = process.env;

afterEach(() => {
  process.env = { ...env };
  mock.restore();
});

describe("resolveManagedIndexerProvider", () => {
  test("uses Railway when MANAGED_INDEXER_PROVIDER=railway", async () => {
    process.env.MANAGED_INDEXER_PROVIDER = "railway";

    const railwayProvider = {
      kind: "railway",
    };
    const slotProvider = {
      kind: "slot",
    };

    mock.module("../indexing/railway-torii", () => ({
      createRailwayManagedIndexerProvider: () => railwayProvider,
    }));

    mock.module("../indexing/slot-torii", () => ({
      createSlotManagedIndexerProvider: () => slotProvider,
    }));

    const { resolveManagedIndexerProvider } = await import("../indexing/managed-indexer");

    expect(resolveManagedIndexerProvider()).toBe(railwayProvider);
  });

  test("defaults to Slot when MANAGED_INDEXER_PROVIDER is unset", async () => {
    delete process.env.MANAGED_INDEXER_PROVIDER;

    const railwayProvider = {
      kind: "railway",
    };
    const slotProvider = {
      kind: "slot",
    };

    mock.module("../indexing/railway-torii", () => ({
      createRailwayManagedIndexerProvider: () => railwayProvider,
    }));

    mock.module("../indexing/slot-torii", () => ({
      createSlotManagedIndexerProvider: () => slotProvider,
    }));

    const { resolveManagedIndexerProvider } = await import("../indexing/managed-indexer");

    expect(resolveManagedIndexerProvider()).toBe(slotProvider);
  });

  test("throws on unrecognized MANAGED_INDEXER_PROVIDER values", async () => {
    process.env.MANAGED_INDEXER_PROVIDER = "railways";

    const { resolveManagedIndexerProviderKind } = await import("../indexing/managed-indexer");

    expect(() => resolveManagedIndexerProviderKind()).toThrow(/Unrecognized MANAGED_INDEXER_PROVIDER "railways"/);
  });
});
