import { type HexPosition, getNeighborHexes } from "@bibliothecadao/types";
import type GUI from "lil-gui";
import {
  AdditiveBlending,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
  Texture,
  Vector3,
} from "three";
import { HEX_SIZE } from "../constants";
import { getWorldPositionForHex } from "../utils";
import {
  loadWeatherSpriteSheet,
  spriteSheetFrame,
  spriteSheetOffset,
  WEATHER_SPRITE_SHEETS,
} from "../effects/weather-sprite-sheet";

interface ThunderBoltConfig {
  radius: number;
  count: number;
}
interface ActiveThunderBolt {
  group: Group;
  materials: MeshBasicMaterial[];
  textures: Texture[];
  startTime: number;
  variant: number;
}
const tempCameraTarget = new Vector3();

export class ThunderBoltManager {
  private readonly thunderBolts = new Group();
  private readonly boltSheet = loadWeatherSpriteSheet(WEATHER_SPRITE_SHEETS.lightning);
  private readonly flashSheet = loadWeatherSpriteSheet(WEATHER_SPRITE_SHEETS.flash);
  private readonly boltGeometry = new PlaneGeometry(16, 16).translate(0, 16 * (0.5 - 0.14), 0);
  private readonly flashGeometry = new PlaneGeometry(5, 5).rotateX(-Math.PI / 2);
  private activeThunderBolts: ActiveThunderBolt[] = [];
  private config: ThunderBoltConfig = { radius: 2, count: 5 };
  private disposed = false;
  private lastVariant = -1;

  constructor(
    private scene: Scene,
    private controls: { target: Vector3; object?: { position: Vector3 } },
    private sampleHeight: (x: number, z: number) => number = () => 0,
  ) {
    this.thunderBolts.name = "ThunderBolts";
    scene.add(this.thunderBolts);
  }

  setConfig(config: Partial<ThunderBoltConfig>): void {
    Object.assign(this.config, config);
  }

  private getCenterHexFromCamera(): HexPosition {
    // Use module-level temp vector to avoid allocation
    // Get camera target from controls
    if (this.controls && this.controls.target) {
      tempCameraTarget.copy(this.controls.target);
    } else {
      // Fallback: use controls object position
      tempCameraTarget.copy(this.controls.object?.position ?? new Vector3());
      tempCameraTarget.y = 0;
    }

    // Convert world position to hex coordinates
    const hexRadius = HEX_SIZE;
    const hexHeight = hexRadius * 2;
    const hexWidth = Math.sqrt(3) * hexRadius;
    const vertDist = hexHeight * 0.75;
    const horizDist = hexWidth;

    const row = Math.round(tempCameraTarget.z / vertDist);
    const rowOffset = ((row % 2) * Math.sign(row) * horizDist) / 2;
    const col = Math.round((tempCameraTarget.x + rowOffset) / horizDist);

    return { col, row };
  }

  private createThunderBolt(hexPosition: HexPosition): void {
    if (this.disposed) return;
    const variant = this.chooseVariant();
    const boltMaterial = this.createSheetMaterial(
      this.boltSheet,
      WEATHER_SPRITE_SHEETS.lightning,
      variant * WEATHER_SPRITE_SHEETS.lightning.frames,
    );
    const flashMaterial = this.createSheetMaterial(this.flashSheet, WEATHER_SPRITE_SHEETS.flash);
    const group = new Group();
    group.name = "Lightning strike";
    group.position.copy(getWorldPositionForHex(hexPosition));
    group.position.y = this.sampleHeight(group.position.x, group.position.z) + 0.05;
    // Face the camera at birth, but stay upright and fixed in world space for the strike.
    const front = new Mesh(this.boltGeometry, boltMaterial);
    const cameraPosition = this.controls.object?.position;
    if (cameraPosition) {
      front.rotation.y = Math.atan2(cameraPosition.x - group.position.x, cameraPosition.z - group.position.z);
    }
    const flash = new Mesh(this.flashGeometry, flashMaterial);
    flash.name = "Lightning ground flash";
    group.add(front, flash);
    this.thunderBolts.add(group);
    this.activeThunderBolts.push({
      group,
      materials: [boltMaterial, flashMaterial],
      textures: [boltMaterial.map!, flashMaterial.map!],
      startTime: performance.now(),
      variant,
    });
  }

  private chooseVariant(): number {
    const variants = WEATHER_SPRITE_SHEETS.lightning.variants;
    const choices = this.lastVariant < 0 ? variants : variants - 1;
    const choice = Math.floor(Math.random() * choices);
    const variant = this.lastVariant >= 0 && choice >= this.lastVariant ? choice + 1 : choice;
    this.lastVariant = variant;
    return variant;
  }

  private createSheetMaterial(
    source: Texture,
    sheet: Parameters<typeof loadWeatherSpriteSheet>[0],
    firstFrame = 0,
  ): MeshBasicMaterial {
    const texture = source.clone();
    texture.repeat.set(1 / sheet.columns, 1 / sheet.rows);
    const offset = spriteSheetOffset(sheet, firstFrame);
    texture.offset.set(offset.x, offset.y);
    return new MeshBasicMaterial({
      map: texture,
      side: DoubleSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
  }

  private getRandomHexesAroundCenter(centerHex: HexPosition, radius: number, count: number): HexPosition[] {
    const positions: HexPosition[] = [];
    const positionSet = new Set<string>();

    let currentLayer = [centerHex];
    for (let i = 0; i < radius; i++) {
      const nextLayer: HexPosition[] = [];
      currentLayer.forEach((pos) => {
        getNeighborHexes(pos.col, pos.row).forEach((neighbor) => {
          const key = `${neighbor.col},${neighbor.row}`;
          if (!positionSet.has(key)) {
            positions.push(neighbor);
            positionSet.add(key);
            nextLayer.push(neighbor);
          }
        });
      });
      currentLayer = nextLayer;
    }

    const shuffled = positions.toSorted(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  spawnThunderBolts(): void {
    const positions = this.getRandomHexesAroundCenter(
      this.getCenterHexFromCamera(),
      this.config.radius,
      this.config.count,
    );
    for (const position of positions) this.createThunderBolt(position);
  }

  spawnThunderBoltAt(position: HexPosition): void {
    this.createThunderBolt(position);
  }

  update(): void {
    const now = performance.now();
    this.activeThunderBolts = this.activeThunderBolts.filter((bolt) => {
      const frame = spriteSheetFrame(WEATHER_SPRITE_SHEETS.lightning, now - bolt.startTime, false);
      if (frame === null) {
        this.disposeBolt(bolt);
        return false;
      }
      const boltOffset = spriteSheetOffset(
        WEATHER_SPRITE_SHEETS.lightning,
        bolt.variant * WEATHER_SPRITE_SHEETS.lightning.frames + frame,
      );
      const flashOffset = spriteSheetOffset(WEATHER_SPRITE_SHEETS.flash, frame);
      bolt.textures[0].offset.set(boltOffset.x, boltOffset.y);
      bolt.textures[1].offset.set(flashOffset.x, flashOffset.y);
      return true;
    });
  }

  private disposeBolt(bolt: ActiveThunderBolt): void {
    this.thunderBolts.remove(bolt.group);
    bolt.materials.forEach((material) => material.dispose());
    bolt.textures.forEach((texture) => texture.dispose());
  }

  cleanup(): void {
    this.activeThunderBolts.forEach((bolt) => this.disposeBolt(bolt));
    this.activeThunderBolts = [];
  }

  getActiveCount(): number {
    return this.activeThunderBolts.length;
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cleanup();
    this.boltSheet.dispose();
    this.flashSheet.dispose();
    this.boltGeometry.dispose();
    this.flashGeometry.dispose();
    this.scene.remove(this.thunderBolts);
  }

  setupGUI(folder: GUI): void {
    const thunder = folder.addFolder("Thunder Bolts");
    thunder.add(this.config, "radius", 1, 20, 1).name("Radius");
    thunder.add(this.config, "count", 1, 20, 1).name("Count");
    thunder
      .add({ strike: () => this.spawnThunderBoltAt(this.getCenterHexFromCamera()) }, "strike")
      .name("Strike at camera");
    thunder.add({ clear: () => this.cleanup() }, "clear").name("Clear strikes");
    thunder.close();
  }
}
