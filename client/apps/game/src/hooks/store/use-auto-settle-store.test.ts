import { beforeEach, describe, expect, it } from "vitest";

import {
  AUTO_SETTLE_STORAGE_KEY,
  createAutoSettleEntryKey,
  useAutoSettleStore,
  type AutoSettleEntryRecord,
} from "./use-auto-settle-store";

const baseEntry: AutoSettleEntryRecord = {
  enabled: true,
  walletAddress: "0x123",
  chain: "mainnet",
  worldName: "aurora-blitz",
  worldKey: "mainnet:aurora-blitz",
  unlockAtSec: 1_234,
  armedAtMs: 100,
  opensOnUnlockEdge: true,
  status: "armed",
  lastError: null,
  lastAttemptAtMs: null,
};

describe("useAutoSettleStore", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    useAutoSettleStore.setState({ entries: {} });
    await useAutoSettleStore.persist.clearStorage();
  });

  it("builds stable keys from world and wallet identity", () => {
    expect(
      createAutoSettleEntryKey({
        chain: "mainnet",
        worldName: "aurora-blitz",
        walletAddress: "0xABC",
      }),
    ).toBe("mainnet:aurora-blitz:0xabc");
  });

  it("arms auto-settle by default and lets the player turn it off again", () => {
    const key = createAutoSettleEntryKey(baseEntry);

    useAutoSettleStore.getState().armEntry(key, baseEntry);
    expect(useAutoSettleStore.getState().getEntry(key)).toEqual(baseEntry);

    useAutoSettleStore.getState().setEnabled(key, false);

    expect(useAutoSettleStore.getState().getEntry(key)).toMatchObject({
      enabled: false,
      status: "idle",
    });
  });

  it("tracks opening, failure, and completion for a single armed entry", () => {
    const key = createAutoSettleEntryKey(baseEntry);
    useAutoSettleStore.getState().armEntry(key, baseEntry);

    useAutoSettleStore.getState().markOpening(key, 200);
    expect(useAutoSettleStore.getState().getEntry(key)).toMatchObject({
      status: "opening",
      lastAttemptAtMs: 200,
    });

    useAutoSettleStore.getState().markFailed(key, "Wallet rejected the transaction");
    expect(useAutoSettleStore.getState().getEntry(key)).toMatchObject({
      enabled: true,
      status: "failed",
      lastError: "Wallet rejected the transaction",
    });

    useAutoSettleStore.getState().markCompleted(key);
    expect(useAutoSettleStore.getState().getEntry(key)).toMatchObject({
      enabled: false,
      status: "completed",
      lastError: null,
    });
  });

  it("persists armed entries in local storage so reloads can resume the watcher", () => {
    const key = createAutoSettleEntryKey(baseEntry);
    useAutoSettleStore.getState().armEntry(key, baseEntry);

    const persisted = window.localStorage.getItem(AUTO_SETTLE_STORAGE_KEY);
    expect(persisted).toContain('"mainnet:aurora-blitz:0x123"');
    expect(JSON.parse(persisted ?? "{}")).toMatchObject({
      state: {
        entries: {
          [key]: baseEntry,
        },
      },
    });
  });

  it("stores arming policy for entries that should wait for a future unlock edge", () => {
    const key = createAutoSettleEntryKey(baseEntry);

    useAutoSettleStore.getState().armEntry(key, {
      ...baseEntry,
      opensOnUnlockEdge: true,
    });

    expect(useAutoSettleStore.getState().getEntry(key)).toMatchObject({
      status: "armed",
      enabled: true,
      opensOnUnlockEdge: true,
    });
  });

  it("stores manual-ready entries without future auto-open eligibility", () => {
    const key = createAutoSettleEntryKey(baseEntry);

    useAutoSettleStore.getState().armEntry(key, {
      ...baseEntry,
      opensOnUnlockEdge: false,
    });

    expect(useAutoSettleStore.getState().getEntry(key)).toMatchObject({
      status: "armed",
      enabled: true,
      opensOnUnlockEdge: false,
    });
  });

  it("migrates persisted entries by backfilling unlock-edge policy from unlock timing", async () => {
    const key = createAutoSettleEntryKey(baseEntry);
    window.localStorage.setItem(
      AUTO_SETTLE_STORAGE_KEY,
      JSON.stringify({
        state: {
          entries: {
            [key]: {
              ...baseEntry,
              opensOnUnlockEdge: undefined,
            },
            stale: {
              ...baseEntry,
              worldName: "late-world",
              worldKey: "mainnet:late-world",
              unlockAtSec: 50,
              armedAtMs: 100_000,
            },
          },
        },
        version: 2,
      }),
    );

    await useAutoSettleStore.persist.rehydrate();

    expect(useAutoSettleStore.getState().getEntry(key)?.opensOnUnlockEdge).toBe(true);
    expect(useAutoSettleStore.getState().getEntry("stale")?.opensOnUnlockEdge).toBe(true);
  });
});
