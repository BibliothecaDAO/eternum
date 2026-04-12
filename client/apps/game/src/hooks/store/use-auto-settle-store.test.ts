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
  triggerAtSec: 1_234,
  armedAtMs: 100,
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

    useAutoSettleStore.getState().upsertEntry(key, baseEntry);
    expect(useAutoSettleStore.getState().getEntry(key)).toEqual(baseEntry);

    useAutoSettleStore.getState().setEnabled(key, false);

    expect(useAutoSettleStore.getState().getEntry(key)).toMatchObject({
      enabled: false,
      status: "idle",
    });
  });

  it("tracks opening, failure, and completion for a single armed entry", () => {
    const key = createAutoSettleEntryKey(baseEntry);
    useAutoSettleStore.getState().upsertEntry(key, baseEntry);

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
    useAutoSettleStore.getState().upsertEntry(key, baseEntry);

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
});
