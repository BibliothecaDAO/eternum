export interface GameSyncWriter {
  cancel: () => void;
}

export interface GameSyncSessionStart {
  startGlobalWriter: () => Promise<GameSyncWriter>;
  hydrateSpatialSnapshot: () => Promise<void>;
}

export type GameSyncRuntimeStatus = "idle" | "starting" | "running" | "stopped";

export class SupersededGameSyncStartError extends Error {
  constructor() {
    super("Game sync start was superseded by a newer session");
    this.name = "SupersededGameSyncStartError";
  }
}

/**
 * Owns the lifetime of every session-scoped sync writer.
 *
 * S1 deliberately keeps transport and RECS application behind injected
 * adapters. That preserves today's behavior while moving lifecycle ownership
 * out of React hooks and module globals. S2 replaces those adapters with the
 * convergent snapshot-and-buffer implementation.
 */
export class GameSyncRuntime {
  private generation = 0;
  private globalWriter: GameSyncWriter | null = null;
  private playerWriter: GameSyncWriter | null = null;
  private status: GameSyncRuntimeStatus = "idle";

  public getStatus(): GameSyncRuntimeStatus {
    return this.status;
  }

  public isStarting(): boolean {
    return this.status === "starting";
  }

  public async startSession(input: GameSyncSessionStart): Promise<void> {
    const generation = this.beginStart();

    try {
      const globalWriter = await input.startGlobalWriter();
      this.adoptGlobalWriter(generation, globalWriter);
      await input.hydrateSpatialSnapshot();
      this.finishStart(generation);
    } catch (error) {
      this.stopFailedStart(generation);
      throw error;
    }
  }

  public async restartGlobalWriter(startGlobalWriter: () => Promise<GameSyncWriter>): Promise<void> {
    const generation = this.beginStart();

    try {
      const globalWriter = await startGlobalWriter();
      this.adoptGlobalWriter(generation, globalWriter);
      this.finishStart(generation);
    } catch (error) {
      this.stopFailedStart(generation);
      throw error;
    }
  }

  /**
   * Preserve the existing bootstrap guard: UI cleanup must not interrupt a
   * half-built writer. A game change calls dispose(), which always fences and
   * cancels the old generation.
   */
  public cancelGlobalWriter(): void {
    if (this.isStarting()) {
      return;
    }
    this.cancelGlobalWriterImmediately();
  }

  public installPlayerWriter(playerWriter: GameSyncWriter): void {
    this.cancelPlayerWriter();
    if (this.status === "stopped") {
      playerWriter.cancel();
      return;
    }
    this.playerWriter = playerWriter;
  }

  public cancelPlayerWriter(expectedWriter?: GameSyncWriter): void {
    if (expectedWriter && this.playerWriter !== expectedWriter) {
      return;
    }
    this.playerWriter?.cancel();
    this.playerWriter = null;
  }

  public dispose(): void {
    this.generation += 1;
    this.cancelGlobalWriterImmediately();
    this.cancelPlayerWriter();
    this.status = "stopped";
  }

  private beginStart(): number {
    this.generation += 1;
    this.cancelGlobalWriterImmediately();
    this.status = "starting";
    return this.generation;
  }

  private adoptGlobalWriter(generation: number, writer: GameSyncWriter): void {
    if (!this.isCurrentGeneration(generation)) {
      writer.cancel();
      throw new SupersededGameSyncStartError();
    }

    this.globalWriter = writer;
  }

  private finishStart(generation: number): void {
    if (!this.isCurrentGeneration(generation)) {
      throw new SupersededGameSyncStartError();
    }
    this.status = "running";
  }

  private stopFailedStart(generation: number): void {
    if (!this.isCurrentGeneration(generation)) {
      return;
    }
    this.cancelGlobalWriterImmediately();
    this.status = "stopped";
  }

  private isCurrentGeneration(generation: number): boolean {
    return generation === this.generation;
  }

  private cancelGlobalWriterImmediately(): void {
    this.globalWriter?.cancel();
    this.globalWriter = null;
  }
}

let activeGameSyncRuntime: GameSyncRuntime | null = null;

export function getActiveGameSyncRuntime(): GameSyncRuntime | null {
  return activeGameSyncRuntime;
}

export function requireActiveGameSyncRuntime(): GameSyncRuntime {
  if (!activeGameSyncRuntime) {
    throw new Error("GameSyncRuntime has not been installed for the active game");
  }
  return activeGameSyncRuntime;
}

export function installGameSyncRuntime(runtime: GameSyncRuntime): GameSyncRuntime {
  activeGameSyncRuntime?.dispose();
  activeGameSyncRuntime = runtime;
  return runtime;
}

export function installFreshGameSyncRuntime(): GameSyncRuntime {
  return installGameSyncRuntime(new GameSyncRuntime());
}

export function disposeActiveGameSyncRuntime(): void {
  activeGameSyncRuntime?.dispose();
  activeGameSyncRuntime = null;
}
