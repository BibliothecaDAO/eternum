import type { BiomeType, HexEntityInfo } from "@bibliothecadao/types";

export interface GameWorkerPosition {
  x: number;
  y: number;
}

export interface GameWorkerExploredTile {
  biome: BiomeType;
  col: number;
  row: number;
}

export interface GameWorkerEntityHex {
  col: number;
  info: HexEntityInfo;
  row: number;
}

export interface GameWorkerWorldState {
  armies: GameWorkerEntityHex[];
  exploredTiles: GameWorkerExploredTile[];
  structures: GameWorkerEntityHex[];
}

export type GameWorkerRequestMessage =
  | { type: "UPDATE_ARMY"; col: number; row: number; info: HexEntityInfo | null }
  | { type: "UPDATE_EXPLORED"; col: number; row: number; biome: BiomeType | null }
  | { type: "UPDATE_STRUCTURE"; col: number; row: number; info: HexEntityInfo | null }
  | ({ type: "HYDRATE_WORLD_STATE" } & GameWorkerWorldState)
  | { type: "RESET_WORLD_STATE" }
  | {
      type: "FIND_PATH";
      requestId: number;
      start: GameWorkerPosition;
      end: GameWorkerPosition;
      maxDistance: number;
    };

export type GameWorkerResponseMessage = {
  path: GameWorkerPosition[];
  requestId: number;
  type: "PATH_RESULT";
};
