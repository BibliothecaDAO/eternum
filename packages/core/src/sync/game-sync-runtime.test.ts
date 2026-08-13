import { afterEach, describe, expect, it, vi } from "vitest";
import { configManager } from "../managers/config-manager";
import {
  disposeActiveGameSyncRuntime,
  GameSyncRuntime,
  getActiveGameSyncRuntime,
  installGameSyncRuntime,
  SupersededGameSyncStartError,
  type GameSyncWriter,
} from "./game-sync-runtime";

const writer = (): GameSyncWriter & { cancel: ReturnType<typeof vi.fn> } => ({ cancel: vi.fn() });

afterEach(() => disposeActiveGameSyncRuntime());

describe("GameSyncRuntime", () => {
  it("owns the global writer before hydrating the snapshot", async () => {
    const runtime = new GameSyncRuntime();
    const globalWriter = writer();
    const order: string[] = [];

    await runtime.startSession({
      startGlobalWriter: async () => {
        order.push("stream");
        return globalWriter;
      },
      hydrateSpatialSnapshot: async () => {
        order.push("snapshot");
      },
    });

    expect(order).toEqual(["stream", "snapshot"]);
    expect(runtime.getStatus()).toBe("running");
    runtime.dispose();
    expect(globalWriter.cancel).toHaveBeenCalledOnce();
  });

  it("fences and cancels a writer that resolves after disposal", async () => {
    const runtime = new GameSyncRuntime();
    const lateWriter = writer();
    let resolveWriter!: (value: GameSyncWriter) => void;

    const start = runtime.startSession({
      startGlobalWriter: () => new Promise((resolve) => (resolveWriter = resolve)),
      hydrateSpatialSnapshot: vi.fn(),
    });
    runtime.dispose();
    resolveWriter(lateWriter);

    await expect(start).rejects.toBeInstanceOf(SupersededGameSyncStartError);
    expect(lateWriter.cancel).toHaveBeenCalledOnce();
    expect(runtime.getStatus()).toBe("stopped");
  });

  it("preserves the bootstrap cancellation guard but force-cancels on dispose", async () => {
    const runtime = new GameSyncRuntime();
    const globalWriter = writer();
    let finishSnapshot!: () => void;

    const start = runtime.startSession({
      startGlobalWriter: async () => globalWriter,
      hydrateSpatialSnapshot: () => new Promise<void>((resolve) => (finishSnapshot = resolve)),
    });
    await Promise.resolve();

    runtime.cancelGlobalWriter();
    expect(globalWriter.cancel).not.toHaveBeenCalled();
    runtime.dispose();
    expect(globalWriter.cancel).toHaveBeenCalledOnce();
    finishSnapshot();
    await expect(start).rejects.toBeInstanceOf(SupersededGameSyncStartError);
  });

  it("tears down the previous session when the active game changes", () => {
    const runtime = installGameSyncRuntime(new GameSyncRuntime());
    const playerWriter = writer();
    runtime.installPlayerWriter(playerWriter);

    configManager.setActiveGame(14, 6);

    expect(playerWriter.cancel).toHaveBeenCalledOnce();
    expect(getActiveGameSyncRuntime()).toBeNull();
  });
});
