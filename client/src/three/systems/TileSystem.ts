import { defineComponentSystem } from "@dojoengine/recs";
import { SetupResult } from "@/dojo/setup";
import { FELT_CENTER } from "@/ui/config";
import WorldmapScene from "../scenes/Worldmap";

export class TileSystem {
  private exploredTiles: Map<number, Set<number>> = new Map();
  private listeners: Set<(col: number, row: number) => void> = new Set();

  constructor(private dojo: SetupResult, private worldMapScene: WorldmapScene) {}

  setupSystem() {
    defineComponentSystem(this.dojo.network.world, this.dojo.components.Tile, (update) => {
      const { value } = update;

      if (!value[0]) return;

      this.updateTiles(Number(value[0].col), Number(value[0].row));
    });
  }

  private async updateTiles(col: number, row: number) {
    const normalizedCoord = { col: col - FELT_CENTER, row: row - FELT_CENTER };
    if (!this.exploredTiles.has(normalizedCoord.col)) {
      this.exploredTiles.set(normalizedCoord.col, new Set());
    }
    if (!this.exploredTiles.get(normalizedCoord.col)!.has(normalizedCoord.row)) {
      this.exploredTiles.get(normalizedCoord.col)!.add(normalizedCoord.row);
      // Notify listeners of the new explored tile
      this.listeners.forEach((listener) => listener(normalizedCoord.col, normalizedCoord.row));
    }
  }

  addListener(listener: (col: number, row: number) => void) {
    this.listeners.add(listener);
  }

  removeListener(listener: (col: number, row: number) => void) {
    this.listeners.delete(listener);
  }

  getExplored() {
    return this.exploredTiles;
  }
}
