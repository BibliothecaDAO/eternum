import { BiomeType } from "@bibliothecadao/types";
import * as THREE from "three";
import { BiomeTilePosition, BiomeTileRenderer } from "./biome-tile-renderer";

export interface TilePosition {
  col: number;
  row: number;
  biome?: BiomeType;
  isExplored: boolean;
}

export class TileRenderer {
  private biomeTileRenderer: BiomeTileRenderer;

  constructor(scene: THREE.Scene) {
    this.biomeTileRenderer = new BiomeTileRenderer(scene);
  }

  public renderTilesForHexes(hexes: TilePosition[]): void {
    const biomeHexes: BiomeTilePosition[] = hexes.map((hex) => ({
      col: hex.col,
      row: hex.row,
      biome: hex.biome,
      isExplored: hex.isExplored,
    }));

    this.biomeTileRenderer.renderTilesForHexes(biomeHexes);
  }

  public clearTiles(): void {
    this.biomeTileRenderer.clearTiles();
  }

  public removeTile(col: number, row: number): void {
    this.biomeTileRenderer.removeTile(col, row);
  }

  public addTile(col: number, row: number, biome?: BiomeType, isExplored: boolean = true): void {
    this.biomeTileRenderer.addTile(col, row, biome, isExplored);
  }

  public updateTilesForHexes(hexes: TilePosition[]): void {
    const biomeHexes: BiomeTilePosition[] = hexes.map((hex) => ({
      col: hex.col,
      row: hex.row,
      biome: hex.biome,
      isExplored: hex.isExplored,
    }));

    this.biomeTileRenderer.updateTilesForHexes(biomeHexes);
  }

  public getTileCount(): number {
    return this.biomeTileRenderer.getTileCount();
  }

  public dispose(): void {
    this.biomeTileRenderer.dispose();
  }
}
