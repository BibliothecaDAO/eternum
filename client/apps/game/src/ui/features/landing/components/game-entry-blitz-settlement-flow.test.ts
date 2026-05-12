// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { runBlitzSettlementFlow } from "./game-entry-blitz-settlement-flow";
import { deriveSettlementStatus, type SettlementSnapshot } from "./game-entry-settlement.utils";

const snapshot = (partial: Partial<SettlementSnapshot> = {}): SettlementSnapshot => ({
  registered: false,
  onceRegistered: false,
  hasSettledStructure: false,
  coordsCount: 0,
  settledCount: 0,
  ...partial,
});

describe("runBlitzSettlementFlow", () => {
  it("recovers to success when indexed completion appears after a verification error", async () => {
    const readSettlementSnapshot = vi
      .fn<() => Promise<SettlementSnapshot | null>>()
      .mockResolvedValueOnce(snapshot({ registered: true }))
      .mockResolvedValueOnce(snapshot({ onceRegistered: true, settledCount: 1 }));
    const runAssignAndSettle = vi.fn<(_: number) => Promise<void>>().mockResolvedValue(undefined);
    const runSingleSettle = vi.fn<(_: number, __: number) => Promise<void>>().mockResolvedValue(undefined);
    const waitForSettlementTarget = vi
      .fn<(_: number) => Promise<SettlementSnapshot | null>>()
      .mockRejectedValue(new Error("verification timeout"));
    const onStageChange = vi.fn();

    const result = await runBlitzSettlementFlow({
      isMainnet: true,
      singleRealmMode: true,
      readSettlementSnapshot,
      syncSettlementStateFromSnapshot: deriveSettlementStatus,
      waitForSettlementTarget,
      onStageChange,
      runAssignAndSettle,
      runSingleSettle,
    });

    expect(result).toMatchObject({
      status: "completed",
      recovered: true,
    });
    if (result.status !== "completed") {
      throw new Error("expected recovered settlement success");
    }
    expect(result.finalStatus.canPlay).toBe(true);
    expect(onStageChange).toHaveBeenCalledWith("assigning");
    expect(runAssignAndSettle).toHaveBeenCalledWith(1);
    expect(runSingleSettle).not.toHaveBeenCalled();
  });

  it("keeps confirmed settlement submissions in syncing state while indexing catches up", async () => {
    const readSettlementSnapshot = vi
      .fn<() => Promise<SettlementSnapshot | null>>()
      .mockResolvedValueOnce(snapshot({ registered: true }))
      .mockResolvedValueOnce(snapshot({ onceRegistered: true, settledCount: 0 }));
    const waitForSettlementTarget = vi
      .fn<(_: number) => Promise<SettlementSnapshot | null>>()
      .mockRejectedValue(new Error("verification timeout"));

    const result = await runBlitzSettlementFlow({
      isMainnet: true,
      singleRealmMode: true,
      readSettlementSnapshot,
      syncSettlementStateFromSnapshot: deriveSettlementStatus,
      waitForSettlementTarget,
      onStageChange: vi.fn(),
      runAssignAndSettle: vi.fn<(_: number) => Promise<void>>().mockResolvedValue(undefined),
      runSingleSettle: vi.fn<(_: number, __: number) => Promise<void>>().mockResolvedValue(undefined),
    });

    expect(result).toMatchObject({
      status: "syncing",
    });
    if (result.status !== "syncing") {
      throw new Error("expected syncing settlement recovery");
    }
    expect(result.pendingTargetSettleCount).toBe(1);
    expect(result.error.message).toContain("verification timeout");
    expect(result.recoveryStatus?.canPlay).toBe(false);
  });

  it("does not submit extra mainnet settlement calls before initial progress is indexed", async () => {
    const readSettlementSnapshot = vi
      .fn<() => Promise<SettlementSnapshot | null>>()
      .mockResolvedValueOnce(snapshot({ registered: true }))
      .mockResolvedValueOnce(snapshot({ onceRegistered: true, settledCount: 0 }));
    const runAssignAndSettle = vi.fn<(_: number) => Promise<void>>().mockResolvedValue(undefined);
    const runSingleSettle = vi.fn<(_: number, __: number) => Promise<void>>().mockResolvedValue(undefined);
    const waitForSettlementTarget = vi
      .fn<(_: number) => Promise<SettlementSnapshot | null>>()
      .mockResolvedValue(snapshot({ onceRegistered: true, settledCount: 0 }));

    const result = await runBlitzSettlementFlow({
      isMainnet: true,
      singleRealmMode: false,
      readSettlementSnapshot,
      syncSettlementStateFromSnapshot: deriveSettlementStatus,
      waitForSettlementTarget,
      onStageChange: vi.fn(),
      runAssignAndSettle,
      runSingleSettle,
    });

    expect(result).toMatchObject({
      status: "syncing",
      pendingTargetSettleCount: 3,
    });
    expect(runAssignAndSettle).toHaveBeenCalledWith(1);
    expect(runSingleSettle).not.toHaveBeenCalled();
  });

  it("fails when verification breaks before any settlement submission is confirmed", async () => {
    const readSettlementSnapshot = vi
      .fn<() => Promise<SettlementSnapshot | null>>()
      .mockResolvedValue(snapshot({ registered: false }));

    const result = await runBlitzSettlementFlow({
      isMainnet: true,
      singleRealmMode: true,
      readSettlementSnapshot,
      syncSettlementStateFromSnapshot: deriveSettlementStatus,
      waitForSettlementTarget: vi.fn<(_: number) => Promise<SettlementSnapshot | null>>(),
      onStageChange: vi.fn(),
      runAssignAndSettle: vi.fn<(_: number) => Promise<void>>().mockResolvedValue(undefined),
      runSingleSettle: vi.fn<(_: number, __: number) => Promise<void>>().mockResolvedValue(undefined),
    });

    expect(result).toMatchObject({
      status: "failed",
    });
    if (result.status !== "failed") {
      throw new Error("expected failed settlement without confirmed submission");
    }
    expect(result.error.message).toContain("registered state");
  });
});
