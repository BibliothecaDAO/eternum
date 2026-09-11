import {
  DoubleSide,
  Group,
  InstancedMesh,
  Object3D,
  PlaneGeometry,
  Scene,
  Vector2,
  Quaternion,
  Matrix4,
  InstancedBufferAttribute,
  type Camera,
  type Vector3,
} from "three";
import MeshBasicNodeMaterial from "three/src/materials/nodes/MeshBasicNodeMaterial.js";
import { uniform, uv, vec3, hash, attribute, float } from "three/tsl";
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
type RainWeather = Pick<WeatherState, "rainIntensity">;

/** World-anchored curtains and ground splashes share the scene's perspective and depth buffer. */
export class RainEffect {
  private readonly group = new Group();
  private readonly splashesSheet = loadWeatherSpriteSheet(WEATHER_SPRITE_SHEETS.splashes);
  private readonly frameOffset = uniform(new Vector2(0, 0.75));
  private readonly fallOffset = uniform(0);
  private readonly opacity = uniform(0);
  private readonly geometry = new PlaneGeometry(1, 1);
  private readonly dropsMaterial = this.createDropsMaterial();
  private readonly splashesMaterial = this.createSplashesMaterial();
  private readonly curtains = new InstancedMesh(this.geometry, this.dropsMaterial, CELL_COUNT);
  private readonly splashes = new InstancedMesh(this.geometry, this.splashesMaterial, CELL_COUNT);
  private readonly transform = new Object3D();
  private readonly rainSeed = new InstancedBufferAttribute(new Float32Array(CELL_COUNT), 1);
  private readonly cameraRotation = new Quaternion();
  private readonly facing = new Quaternion();
  private readonly instanceMatrix = new Matrix4();
  private cellX = NaN;
  private cellZ = NaN;
  private elapsedMs = 0;
  private disposed = false;

  constructor(
    private scene: Scene,
    private sampleHeight: (x: number, z: number) => number = () => 0,
  ) {
    this.geometry.setAttribute("rainSeed", this.rainSeed);
    this.curtains.onBeforeRender = (_renderer, _scene, camera) => this.faceCamera(camera);
    this.group.name = "World rain";
    this.curtains.name = "Rain curtains";
    this.splashes.name = "Ground splashes";
    this.group.add(this.curtains, this.splashes);
    this.group.visible = false;
    scene.add(this.group);
  }

  private createDropsMaterial(): MeshBasicNodeMaterial {
    const material = this.createTransparentMaterial();
    const lane = uv().x.mul(12);
    const seed = lane.floor().add(attribute("rainSeed", "float"));
    const center = hash(seed).mul(0.7).add(0.15);
    const width = float(1).sub(lane.fract().sub(center).abs().smoothstep(0.006, 0.022));
    // Increasing V moves every streak down. Only its height changes over time;
    // the lane and its horizontal position stay fixed, even in wind.
    const height = uv()
      .y.mul(3)
      .add(this.fallOffset)
      .add(hash(seed.add(127)))
      .fract();
    const streak = height.smoothstep(0, 0.025).mul(float(1).sub(height.smoothstep(0.025, 0.13)));
    material.colorNode = vec3(0.72, 0.82, 0.9);
    material.opacityNode = width.mul(streak).mul(this.opacity).mul(0.4);
    return material;
  }

  private createSplashesMaterial(): MeshBasicNodeMaterial {
    const material = this.createTransparentMaterial();
    // Half-texel inset prevents neighboring animation frames bleeding into the tile.
    const sample = this.splashesSheet.sample(uv().mul(0.249).add(0.0005).add(this.frameOffset));
    material.colorNode = sample.rgb;
    material.opacityNode = sample.a.mul(this.opacity).mul(0.35);
    return material;
  }

  private createTransparentMaterial(): MeshBasicNodeMaterial {
    const material = new MeshBasicNodeMaterial();
    material.transparent = true;
    material.side = DoubleSide;
    material.forceSinglePass = true;
    material.depthWrite = false;
    material.depthTest = true;
    material.toneMapped = false;
    return material;
  }

  private faceCamera(camera: Camera): void {
    camera.getWorldQuaternion(this.cameraRotation);
    if (this.cameraRotation.equals(this.facing)) return;
    this.facing.copy(this.cameraRotation);
    for (let index = 0; index < CELL_COUNT; index++) {
      this.curtains.getMatrixAt(index, this.instanceMatrix);
      this.instanceMatrix.decompose(this.transform.position, this.transform.quaternion, this.transform.scale);
      this.transform.quaternion.copy(this.facing);
      this.transform.updateMatrix();
      this.curtains.setMatrixAt(index, this.transform.matrix);
    }
    this.curtains.instanceMatrix.needsUpdate = true;
    this.curtains.computeBoundingSphere();
  }

  update(delta: number, target: Vector3, weather?: RainWeather): void {
    if (this.disposed) return;
    this.group.visible = (weather?.rainIntensity ?? 0) > 0.01;
    if (!this.group.visible || !weather) return;
    this.opacity.value = Math.max(0, Math.min(1, weather.rainIntensity));
    this.placeAround(target);
    this.advanceAnimation(delta);
  }

  private advanceAnimation(delta: number): void {
    this.elapsedMs += delta * 1000;
    const sheet = WEATHER_SPRITE_SHEETS.splashes;
    const offset = spriteSheetOffset(sheet, spriteSheetFrame(sheet, this.elapsedMs, true)!);
    this.frameOffset.value.set(offset.x, offset.y);
    this.fallOffset.value = (this.fallOffset.value + delta * 2) % 1;
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
    this.rainSeed.needsUpdate = true;
    for (const mesh of [this.curtains, this.splashes]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  private placeCell(index: number, x: number, z: number): void {
    const ground = this.sampleHeight(x, z);
    this.transform.position.set(x, ground + 6, z);
    this.transform.scale.set(CELL_SIZE, 12, 1);
    this.transform.quaternion.copy(this.facing);
    this.transform.updateMatrix();
    this.curtains.setMatrixAt(index, this.transform.matrix);
    this.rainSeed.setX(index, Math.abs((x / CELL_SIZE) * 7381 + (z / CELL_SIZE) * 19391));
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
