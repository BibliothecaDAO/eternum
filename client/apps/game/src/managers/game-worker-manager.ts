import { Position } from "@bibliothecadao/eternum";
import { BiomeType, HexEntityInfo } from "@bibliothecadao/types";
import GameWorker from "../workers/game-worker.ts?worker";
import {
  incrementWorldmapRenderCounter,
  recordWorldmapRenderDuration,
} from "../three/perf/worldmap-render-diagnostics";

interface WorkerPosition {
  x: number;
  y: number;
}

type PathRequest = {
  resolve: (path: Position[]) => void;
  reject: (error: Error) => void;
};

class GameWorkerManager {
  private worker: Worker;
  private requestMap = new Map<number, PathRequest>();
  private nextRequestId = 1;

  constructor() {
    this.worker = new GameWorker();
    this.worker.onmessage = this.handleMessage.bind(this);
    console.log("GameWorkerManager initialized");
  }

  private handleMessage(event: MessageEvent) {
    const { type, requestId, path } = event.data;

    if (type === "PATH_RESULT") {
      const request = this.requestMap.get(requestId);
      if (request) {
        // Convert back to Position objects
        const positions = path.map((p: WorkerPosition) => new Position({ x: p.x, y: p.y }));
        request.resolve(positions);
        this.requestMap.delete(requestId);
      }
    }
  }

  public updateExploredTile(col: number, row: number, biome: BiomeType | null) {
    this.worker.postMessage({
      type: "UPDATE_EXPLORED",
      col,
      row,
      biome,
    });
  }

  public updateStructureHex(col: number, row: number, info: HexEntityInfo | null) {
    this.worker.postMessage({
      type: "UPDATE_STRUCTURE",
      col,
      row,
      info,
    });
  }

  public updateArmyHex(col: number, row: number, info: HexEntityInfo | null) {
    this.worker.postMessage({
      type: "UPDATE_ARMY",
      col,
      row,
      info,
    });
  }

  public findPath(start: Position, end: Position, maxDistance: number): Promise<Position[]> {
    return new Promise((resolve, reject) => {
      const requestId = this.nextRequestId++;
      const requestStartedAt = performance.now();
      incrementWorldmapRenderCounter("workerFindPathCalls");
      this.requestMap.set(requestId, {
        resolve: (path) => {
          recordWorldmapRenderDuration("workerFindPath", performance.now() - requestStartedAt);
          resolve(path);
        },
        reject: (error) => {
          recordWorldmapRenderDuration("workerFindPath", performance.now() - requestStartedAt);
          reject(error);
        },
      });

      const startNorm = start.getNormalized();
      const endNorm = end.getNormalized();

      this.worker.postMessage({
        type: "FIND_PATH",
        requestId,
        start: { x: startNorm.x, y: startNorm.y },
        end: { x: endNorm.x, y: endNorm.y },
        maxDistance,
      });
    });
  }

  public terminate() {
    this.worker.terminate();
  }
}

export const gameWorkerManager = new GameWorkerManager();
