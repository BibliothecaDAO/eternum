import { DoubleSide, Group, InstancedMesh, Object3D, PlaneGeometry, Scene, Vector2, type Vector3 } from "three";
import MeshBasicNodeMaterial from "three/src/materials/nodes/MeshBasicNodeMaterial.js";
import { uniform, uv, vec2 } from "three/tsl";
import type { WeatherState } from "../managers/weather-manager";
import {
  loadWeatherSpriteSheet,
  spriteSheetFrame,
  spriteSheetOffset,
  WEATHER_SPRITE_SHEETS,
} from "./weather-sprite-sheet";

const CELL_SIZE = 8;
const RADIUS = 3;
const CELL_COUNT = (RADIUS * 2 + 1) ** 2;
type RainWeather = Pick<WeatherState, "rainIntensity" | "windX" | "windZ">;

/** World-anchored curtains and ground splashes share the scene's perspective and depth buffer. */
export class RainEffect {
  private readonly group = new Group();
  private readonly dropsSheet = loadWeatherSpriteSheet(WEATHER_SPRITE_SHEETS.drops);
  private readonly splashesSheet = loadWeatherSpriteSheet(WEATHER_SPRITE_SHEETS.splashes);
  private readonly frameOffset = uniform(new Vector2(0, 0.75));
  private readonly drift = uniform(new Vector2());
  private readonly opacity = uniform(0);
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly dropsMaterial = this.createMaterial(this.dropsSheet, true);
  private readonly splashesMaterial = this.createMaterial(this.splashesSheet, false);
  private readonly curtains = new InstancedMesh(this.geometry, this.dropsMaterial, CELL_COUNT * 2);
  private readonly splashes = new InstancedMesh(this.geometry, this.splashesMaterial, CELL_COUNT);
  private readonly transform = new Object3D();
  private cellX = NaN;
  private cellZ = NaN;
  private elapsedMs = 0;
  private disposed = false;

  constructor(
    private scene: Scene,
    private sampleHeight: (x: number, z: number) => number = () => 0,
  ) {
    this.group.name = "World rain";
    this.curtains.name = "Rain curtains";
    this.splashes.name = "Ground splashes";
    this.group.add(this.curtains, this.splashes);
    this.group.visible = false;
    scene.add(this.group);
  }

  private createMaterial(sheet: ReturnType<typeof loadWeatherSpriteSheet>, falling: boolean): MeshBasicNodeMaterial {
    const material = new MeshBasicNodeMaterial();
    const tiledUv = falling ? uv().mul(vec2(1, 2)).add(this.drift).fract() : uv();
    // Half-texel inset prevents neighboring animation frames bleeding into the tile.
    const sample = sheet.sample(tiledUv.mul(0.249).add(0.0005).add(this.frameOffset));
    material.colorNode = sample.rgb;
    material.opacityNode = sample.a.mul(this.opacity).mul(falling ? 0.28 : 0.35);
    material.transparent = true;
    material.side = DoubleSide;
    // Flat cards have no back surface to sort into a second pass.
    material.forceSinglePass = true;
    material.depthWrite = false;
    material.depthTest = true;
    material.toneMapped = false;
    return material;
  }

  update(delta: number, target: Vector3, weather?: RainWeather): void {
    if (this.disposed) return;
    this.group.visible = (weather?.rainIntensity ?? 0) > 0.01;
    if (!this.group.visible || !weather) return;
    this.opacity.value = Math.max(0, Math.min(1, weather.rainIntensity));
    this.placeAround(target);
    this.advanceAnimation(delta, weather);
  }

  private advanceAnimation(delta: number, weather: RainWeather): void {
    this.elapsedMs += delta * 1000;
    const sheet = WEATHER_SPRITE_SHEETS.drops;
    const offset = spriteSheetOffset(sheet, spriteSheetFrame(sheet, this.elapsedMs, true)!);
    this.frameOffset.value.set(offset.x, offset.y);
    // The authored frames supply falling motion; wind drifts the curtains' UVs in world axes.
    this.drift.value.x = (this.drift.value.x - (weather.windX + weather.windZ) * delta * 0.02) % 1;
  }

  private placeAround(target: Vector3): void {
    const cellX = Math.floor(target.x / CELL_SIZE);
    const cellZ = Math.floor(target.z / CELL_SIZE);
    if (cellX === this.cellX && cellZ === this.cellZ) return;
    this.cellX = cellX;
    this.cellZ = cellZ;
    let index = 0;
    for (let row = -RADIUS; row <= RADIUS; row++) {
      for (let col = -RADIUS; col <= RADIUS; col++) {
        this.placeCell(index++, (cellX + col) * CELL_SIZE, (cellZ + row) * CELL_SIZE);
      }
    }
    for (const mesh of [this.curtains, this.splashes]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  private placeCell(index: number, x: number, z: number): void {
    const ground = this.sampleHeight(x, z);
    this.transform.position.set(x, ground + 6, z);
    this.transform.scale.set(CELL_SIZE, 12, 1);
    for (let axis = 0; axis < 2; axis++) {
      this.transform.rotation.set(0, (axis * Math.PI) / 2, 0);
      this.transform.updateMatrix();
      this.curtains.setMatrixAt(index * 2 + axis, this.transform.matrix);
    }
    this.transform.position.y = ground + 0.04;
    this.transform.rotation.set(-Math.PI / 2, 0, 0);
    this.transform.scale.set(2, 2, 1);
    this.transform.updateMatrix();
    this.splashes.setMatrixAt(index, this.transform.matrix);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.group);
    this.curtains.dispose();
    this.splashes.dispose();
    this.geometry.dispose();
    this.dropsMaterial.dispose();
    this.splashesMaterial.dispose();
  }
}
