import { BiomeType, BuildingType, TroopTier, TroopType } from "@bibliothecadao/types";
import * as THREE from "three";
import { BiomeTilePosition, BiomeTileRenderer } from "./biome-tile-renderer";
import { BuildingTilePosition, BuildingTileRenderer } from "./building-tile-renderer";
import { UnitTilePosition, UnitTileRenderer } from "./unit-tile-renderer";

export interface MultiTilePosition {
  col: number;
  row: number;
  isExplored: boolean;
  biome?: BiomeType;
  buildingType?: BuildingType;
  troopType?: TroopType;
  troopTier?: TroopTier;
  isDonkey?: boolean;
}

export class MultiTileRenderer {
  private biomeTileRenderer: BiomeTileRenderer;
  private buildingTileRenderer: BuildingTileRenderer;
  private unitTileRenderer: UnitTileRenderer;

  constructor(scene: THREE.Scene) {
    this.biomeTileRenderer = new BiomeTileRenderer(scene);
    this.buildingTileRenderer = new BuildingTileRenderer(scene);
    this.unitTileRenderer = new UnitTileRenderer(scene);
  }

  public renderTilesForHexes(hexes: MultiTilePosition[]): void {
    const biomeHexes: BiomeTilePosition[] = hexes.map((hex) => ({
      col: hex.col,
      row: hex.row,
      biome: hex.biome,
      isExplored: hex.isExplored,
    }));

    const buildingHexes: BuildingTilePosition[] = hexes
      .filter((hex) => hex.buildingType !== undefined && hex.buildingType !== BuildingType.None)
      .map((hex) => ({
        col: hex.col,
        row: hex.row,
        buildingType: hex.buildingType,
        isExplored: hex.isExplored,
      }));

    const unitHexes: UnitTilePosition[] = hexes
      .filter((hex) => hex.isDonkey || (hex.troopType && hex.troopTier))
      .map((hex) => ({
        col: hex.col,
        row: hex.row,
        troopType: hex.troopType,
        troopTier: hex.troopTier,
        isDonkey: hex.isDonkey,
        isExplored: hex.isExplored,
      }));

    this.biomeTileRenderer.renderTilesForHexes(biomeHexes);
    this.buildingTileRenderer.renderTilesForHexes(buildingHexes);
    this.unitTileRenderer.renderTilesForHexes(unitHexes);
  }

  public updateTilesForHexes(hexes: MultiTilePosition[]): void {
    const biomeHexes: BiomeTilePosition[] = hexes.map((hex) => ({
      col: hex.col,
      row: hex.row,
      biome: hex.biome,
      isExplored: hex.isExplored,
    }));

    const buildingHexes: BuildingTilePosition[] = hexes.map((hex) => ({
      col: hex.col,
      row: hex.row,
      buildingType: hex.buildingType,
      isExplored: hex.isExplored,
    }));

    const unitHexes: UnitTilePosition[] = hexes.map((hex) => ({
      col: hex.col,
      row: hex.row,
      troopType: hex.troopType,
      troopTier: hex.troopTier,
      isDonkey: hex.isDonkey,
      isExplored: hex.isExplored,
    }));

    this.biomeTileRenderer.updateTilesForHexes(biomeHexes);
    this.buildingTileRenderer.updateTilesForHexes(buildingHexes);
    this.unitTileRenderer.updateTilesForHexes(unitHexes);
  }

  public clearAllTiles(): void {
    this.biomeTileRenderer.clearTiles();
    this.buildingTileRenderer.clearTiles();
    this.unitTileRenderer.clearTiles();
  }

  public getTotalTileCount(): number {
    return (
      this.biomeTileRenderer.getTileCount() +
      this.buildingTileRenderer.getTileCount() +
      this.unitTileRenderer.getTileCount()
    );
  }

  public getBiomeTileRenderer(): BiomeTileRenderer {
    return this.biomeTileRenderer;
  }

  public getBuildingTileRenderer(): BuildingTileRenderer {
    return this.buildingTileRenderer;
  }

  public getUnitTileRenderer(): UnitTileRenderer {
    return this.unitTileRenderer;
  }

  public dispose(): void {
    this.biomeTileRenderer.dispose();
    this.buildingTileRenderer.dispose();
    this.unitTileRenderer.dispose();
  }
}
