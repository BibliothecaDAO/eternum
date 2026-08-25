import { Position } from "@bibliothecadao/eternum";
import { BiomeType, HexEntityInfo } from "@bibliothecadao/types";
import GameWorker from "../workers/game-worker.ts?worker";
import type {
  GameWorkerPosition,
  GameWorkerRequestMessage,
  GameWorkerResponseMessage,
  GameWorkerWorldState,
} from "../workers/game-worker-messages";
import {
  incrementWorldmapRenderCounter,
  recordWorldmapRenderDuration,
} from "../three/perf/worldmap-render-diagnostics";

type PathRequest = {
  startedAt: number;
  resolve: (path: Position[]) => void;
  reject: (error: Error) => void;
};

type GameWorkerLike = Pick<Worker, "onerror" | "onmessage" | "postMessage" | "terminate">;

interface CreateGameWorkerManagerInput {
  createWorker?: () => GameWorkerLike;
  incrementCounter?: typeof incrementWorldmapRenderCounter;
  now?: () => number;
  recordDuration?: typeof recordWorldmapRenderDuration;
}

class GameWorkerManager {
  private worker: GameWorkerLike | null = null;
  private requestMap = new Map<number, PathRequest>();
  private nextRequestId = 1;

  constructor(private readonly input: Required<CreateGameWorkerManagerInput>) {}

  private ensureWorker(): GameWorkerLike {
    if (this.worker) {
      return this.worker;
    }

    const worker = this.input.createWorker();
    worker.onmessage = (event) => this.handleWorkerMessage(event.data as GameWorkerResponseMessage);
    worker.onerror = (event) =>
      this.handleWorkerFailure(event.error ?? new Error(event.message ?? "Unknown worker error"));
    this.worker = worker;
    return worker;
  }

  public updateExploredTile(col: number, row: number, biome: BiomeType | null) {
    this.postWorkerMessage({
      type: "UPDATE_EXPLORED",
      col,
      row,
      biome,
    });
  }

  public updateStructureHex(col: number, row: number, info: HexEntityInfo | null) {
    this.postWorkerMessage({
      type: "UPDATE_STRUCTURE",
      col,
      row,
      info,
    });
  }

  public updateArmyHex(col: number, row: number, info: HexEntityInfo | null) {
    this.postWorkerMessage({
      type: "UPDATE_ARMY",
      col,
      row,
      info,
    });
  }

  public resetWorldState() {
    this.worker?.postMessage({ type: "RESET_WORLD_STATE" });
  }

  public hydrateWorldState(worldState: GameWorkerWorldState) {
    if (!this.worker && !hasWorldStateEntries(worldState)) {
      return;
    }

    this.postWorkerMessage({ type: "HYDRATE_WORLD_STATE", ...worldState });
  }

  public findPath(start: Position, end: Position, maxDistance: number): Promise<Position[]> {
    return new Promise((resolve, reject) => {
      const requestId = this.registerPathRequest(resolve, reject);
      const startNorm = start.getNormalized();
      const endNorm = end.getNormalized();

      this.postWorkerMessage({
        type: "FIND_PATH",
        requestId,
        start: { x: startNorm.x, y: startNorm.y },
        end: { x: endNorm.x, y: endNorm.y },
        maxDistance,
      });
    });
  }

  public terminate() {
    this.disposeWorker(new Error("Game worker terminated"));
  }

  private registerPathRequest(resolve: PathRequest["resolve"], reject: PathRequest["reject"]): number {
    const requestId = this.nextRequestId++;
    this.input.incrementCounter("workerFindPathCalls");
    this.requestMap.set(requestId, {
      startedAt: this.input.now(),
      resolve,
      reject,
    });
    return requestId;
  }

  private postWorkerMessage(message: GameWorkerRequestMessage) {
    this.ensureWorker().postMessage(message);
  }

  private handleWorkerMessage(message: GameWorkerResponseMessage) {
    if (message.type !== "PATH_RESULT") {
      return;
    }

    const request = this.requestMap.get(message.requestId);
    if (!request) {
      return;
    }

    request.resolve(this.buildResolvedPath(message.path));
    this.finishPathRequest(message.requestId);
  }

  private buildResolvedPath(path: GameWorkerPosition[]): Position[] {
    return path.map((position) => new Position({ x: position.x, y: position.y }));
  }

  private finishPathRequest(requestId: number) {
    const request = this.requestMap.get(requestId);
    if (!request) {
      return;
    }

    this.input.recordDuration("workerFindPath", this.input.now() - request.startedAt);
    this.requestMap.delete(requestId);
  }

  private handleWorkerFailure(error: unknown) {
    console.error("GameWorkerManager worker failure", error);
    this.disposeWorker(new Error("Game worker failed"));
  }

  private disposeWorker(error: Error) {
    this.rejectPendingPathRequests(error);
    this.worker?.terminate();
    this.worker = null;
  }

  private rejectPendingPathRequests(error: Error) {
    for (const [requestId, request] of this.requestMap.entries()) {
      request.reject(error);
      this.finishPathRequest(requestId);
    }
  }
}

function hasWorldStateEntries(worldState: GameWorkerWorldState): boolean {
  return worldState.armies.length > 0 || worldState.exploredTiles.length > 0 || worldState.structures.length > 0;
}

export const createGameWorkerManager = (input: CreateGameWorkerManagerInput = {}): GameWorkerManager =>
  new GameWorkerManager({
    createWorker: input.createWorker ?? (() => new GameWorker()),
    incrementCounter: input.incrementCounter ?? incrementWorldmapRenderCounter,
    now: input.now ?? (() => performance.now()),
    recordDuration: input.recordDuration ?? recordWorldmapRenderDuration,
  });

export const gameWorkerManager = createGameWorkerManager();

export type {
  GameWorkerEntityHex,
  GameWorkerExploredTile,
  GameWorkerWorldState,
} from "../workers/game-worker-messages";
