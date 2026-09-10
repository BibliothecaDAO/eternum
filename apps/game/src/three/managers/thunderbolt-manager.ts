import { type HexPosition, getNeighborHexes } from "@bibliothecadao/types";
import type GUI from "lil-gui";
import { AdditiveBlending, DoubleSide, Group, Mesh, PlaneGeometry, Scene, Vector2, Vector3 } from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { uniform, uv, vec2 } from "three/tsl";
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
  materials: MeshBasicNodeMaterial[];
  frameOffsets: Vector2[];
  startTime: number;
  variant: number;
}
const tempCameraTarget = new Vector3();
const MAX_IDLE_STRIKES = 20;

export class ThunderBoltManager {
  private readonly thunderBolts = new Group();
  private readonly boltSheet = loadWeatherSpriteSheet(WEATHER_SPRITE_SHEETS.lightning);
  private readonly flashSheet = loadWeatherSpriteSheet(WEATHER_SPRITE_SHEETS.flash);
  private readonly boltGeometry = new PlaneGeometry(16, 16).translate(0, 16 * (0.5 - 0.14), 0);
  private readonly flashGeometry = new PlaneGeometry(5, 5).rotateX(-Math.PI / 2);
  private activeThunderBolts: ActiveThunderBolt[] = [];
  private readonly idleThunderBolts: ActiveThunderBolt[] = [];
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
    const bolt = this.idleThunderBolts.pop() ?? this.createStrikeResources();
    bolt.variant = this.chooseVariant();
    bolt.startTime = performance.now();
    const boltOffset = spriteSheetOffset(
      WEATHER_SPRITE_SHEETS.lightning,
      bolt.variant * WEATHER_SPRITE_SHEETS.lightning.frames,
    );
    const flashOffset = spriteSheetOffset(WEATHER_SPRITE_SHEETS.flash, 0);
    bolt.frameOffsets[0].set(boltOffset.x, boltOffset.y);
    bolt.frameOffsets[1].set(flashOffset.x, flashOffset.y);
    bolt.group.position.copy(getWorldPositionForHex(hexPosition));
    bolt.group.position.y = this.sampleHeight(bolt.group.position.x, bolt.group.position.z) + 0.05;
    // Face the camera at birth, but stay upright and fixed in world space for the strike.
    const cameraPosition = this.controls.object?.position;
    bolt.group.children[0].rotation.y = cameraPosition
      ? Math.atan2(cameraPosition.x - bolt.group.position.x, cameraPosition.z - bolt.group.position.z)
      : 0;
    this.thunderBolts.add(bolt.group);
    this.activeThunderBolts.push(bolt);
  }

  private createStrikeResources(): ActiveThunderBolt {
    const boltOffset = new Vector2();
    const flashOffset = new Vector2();
    const boltMaterial = this.createSheetMaterial(this.boltSheet, WEATHER_SPRITE_SHEETS.lightning, boltOffset);
    const flashMaterial = this.createSheetMaterial(this.flashSheet, WEATHER_SPRITE_SHEETS.flash, flashOffset);
    const group = new Group();
    group.name = "Lightning strike";
    const front = new Mesh(this.boltGeometry, boltMaterial);
    const flash = new Mesh(this.flashGeometry, flashMaterial);
    flash.name = "Lightning ground flash";
    group.add(front, flash);
    return {
      group,
      materials: [boltMaterial, flashMaterial],
      frameOffsets: [boltOffset, flashOffset],
      startTime: 0,
      variant: 0,
    };
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
    source: ReturnType<typeof loadWeatherSpriteSheet>,
    sheet: Parameters<typeof loadWeatherSpriteSheet>[0],
    frameOffset: Vector2,
  ): MeshBasicNodeMaterial {
    const offset = spriteSheetOffset(sheet, 0);
    frameOffset.set(offset.x, offset.y);
    // Animate UVs per strike while sharing the compressed sheet.
    const sample = source.sample(
      uv()
        .mul(vec2(1 / sheet.columns, 1 / sheet.rows))
        .add(uniform(frameOffset)),
    );
    const material = new MeshBasicNodeMaterial({
      side: DoubleSide,
      forceSinglePass: true,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    material.colorNode = sample.rgb;
    material.opacityNode = sample.a;
    return material;
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
        this.releaseBolt(bolt);
        return false;
      }
      const boltOffset = spriteSheetOffset(
        WEATHER_SPRITE_SHEETS.lightning,
        bolt.variant * WEATHER_SPRITE_SHEETS.lightning.frames + frame,
      );
      const flashOffset = spriteSheetOffset(WEATHER_SPRITE_SHEETS.flash, frame);
      bolt.frameOffsets[0].set(boltOffset.x, boltOffset.y);
      bolt.frameOffsets[1].set(flashOffset.x, flashOffset.y);
      return true;
    });
  }

  private releaseBolt(bolt: ActiveThunderBolt): void {
    this.thunderBolts.remove(bolt.group);
    // Reuse compiled objects through repeated storm bursts; cap retained idle resources.
    if (this.idleThunderBolts.length < MAX_IDLE_STRIKES) this.idleThunderBolts.push(bolt);
    else bolt.materials.forEach((material) => material.dispose());
  }

  cleanup(): void {
    this.activeThunderBolts.forEach((bolt) => this.releaseBolt(bolt));
    this.activeThunderBolts = [];
  }

  getActiveCount(): number {
    return this.activeThunderBolts.length;
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cleanup();
    this.idleThunderBolts.forEach((bolt) => bolt.materials.forEach((material) => material.dispose()));
    this.idleThunderBolts.length = 0;
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
