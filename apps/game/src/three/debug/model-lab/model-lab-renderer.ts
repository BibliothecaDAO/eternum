import {
  AnimationMixer,
  Box3,
  BufferGeometry,
  LineBasicMaterial,
  Line,
  Color,
  Group,
  Mesh,
  Object3D,
  PCFSoftShadowMap,
  Texture,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";
import * as WebGPUTextureUtils from "three/addons/utils/WebGPUTextureUtils.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { initializeProceduralCharacterRendererRuntime } from "../../characters/procedural-character-renderer-runtime";
import {
  applyProceduralUnitConfigPatch,
  createDefaultProceduralUnitConfig,
} from "../../characters/procedural-unit-config";
import type { ProceduralUnitActor, ProceduralUnitRuntime } from "../../characters/procedural-unit-runtime";
import { createShipDesign, type ShipDesign, type ShipTier } from "../../characters/ships/ship-design";
import { createSailPrint } from "../../characters/ships/ship-sail-print";
import { fitShipToHex } from "../../characters/ships/ship-hex-footprint";
import { findNearestTerrainHex, terrainHexCorners, terrainHexToWorld } from "../../terrain/terrain-coordinates";
import type { RendererSurfaceLike } from "../../renderer-backend";
import { gltfLoader, configureGltfTextureSupport } from "../../utils/utils";
import { disposeSkinnedSceneTemplates } from "../../characters/skinned-asset-resources";
import { MODEL_LAB_SEQUENCE_SECONDS, sampleModelLabMotion } from "./model-lab-motion";
import { ModelLabEnvironment } from "./model-lab-environment";
import { TERRAIN_WATER_LEVEL } from "../../terrain/terrain-water";
import { configureRendererColorOutput } from "../../renderer-color-output";
import type { TerrainMovementInteraction } from "../../terrain/terrain-movement-effects";
import type { ModelLabSettings } from "./model-lab-settings";

export interface ModelLabStats {
  triangles: number;
  calls: number;
  fps: number;
  progress: number;
  phase: string;
  assets: Array<{ tier: number; name: string; triangles: number; clips: number }>;
}
export interface ModelLabRenderer {
  update(settings: ModelLabSettings): Promise<void>;
  pause(paused: boolean): void;
  step(): void;
  seek(progress: number): void;
  resetCamera(): void;
  exportModel(tier: number): Promise<Blob>;
  setSailArtwork(file: File | null): Promise<void>;
  dispose(): void;
}
interface Input {
  container: HTMLElement;
  settings: ModelLabSettings;
  signal: AbortSignal;
  onStats(stats: ModelLabStats): void;
}
interface LoopRenderer extends RendererSurfaceLike {
  setAnimationLoop(callback: (() => void) | null): void;
}
interface Slot {
  group: Group;
  model: Object3D;
  tier: ShipTier;
  name: string;
  triangles: number;
  clips: number;
  ship?: ShipDesign;
  actor?: ProceduralUnitActor;
  mixer?: AnimationMixer;
  dispose(): void;
}

export async function mountModelLabRenderer(input: Input): Promise<ModelLabRenderer> {
  const initialized = await initializeProceduralCharacterRendererRuntime({ pixelRatioCap: 1.5, preloadPhysics: false });
  if (input.signal.aborted) {
    initialized.unitRuntime.dispose();
    initialized.rendererRuntime.backend.dispose?.();
    input.signal.throwIfAborted();
  }
  let lab: ModelReviewScene | undefined;
  try {
    lab = new ModelReviewScene(input, initialized);
    await lab.update(input.settings);
    input.signal.throwIfAborted();
    return lab;
  } catch (error) {
    if (lab) lab.dispose();
    else {
      initialized.unitRuntime.dispose();
      initialized.rendererRuntime.backend.dispose?.();
    }
    throw error;
  }
}

class ModelReviewScene implements ModelLabRenderer {
  private readonly scene = new Scene();
  private readonly stage = new Group();
  private readonly footprints = new Group();
  private readonly camera = new PerspectiveCamera(37, 1, 0.1, 150);
  private readonly renderer: LoopRenderer;
  private readonly controls: OrbitControls;
  private readonly runtime: ProceduralUnitRuntime;
  private readonly observer: ResizeObserver;
  private readonly environment: ModelLabEnvironment;
  private sailTexture: Texture | null = null;
  private sailArtwork: ImageBitmap | null = null;
  private sailPrintKey = "";
  private artworkGeneration = 0;
  private readonly shipAssets = new Map<string, Promise<Group>>();
  private slots: Slot[] = [];
  private settings: ModelLabSettings;
  private signature = "";
  private generation = 0;
  private disposed = false;
  private paused = false;
  private seconds = 0;
  private lastFrame = performance.now();
  private lastStats = this.lastFrame;
  private frames = 0;

  constructor(
    private readonly input: Input,
    private readonly initialized: Awaited<ReturnType<typeof initializeProceduralCharacterRendererRuntime>>,
  ) {
    this.settings = input.settings;
    this.runtime = initialized.unitRuntime;
    this.renderer = initialized.rendererRuntime.renderer as LoopRenderer;
    configureGltfTextureSupport(this.renderer as Parameters<typeof configureGltfTextureSupport>[0]);
    configureRendererColorOutput(this.renderer);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.scene.background = new Color(0x819997);
    this.scene.add(this.stage, this.footprints);
    this.environment = new ModelLabEnvironment(this.scene);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 60;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.renderer.domElement.setAttribute("aria-label", "Model review stage. Drag to orbit, scroll to zoom.");
    input.container.append(this.renderer.domElement);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(input.container);
    this.resize();
    this.resetCamera();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  async update(settings: ModelLabSettings): Promise<void> {
    const generation = ++this.generation;
    const previous = this.settings;
    this.settings = settings;
    if (previous.action !== settings.action) this.seconds = 0;
    if (
      previous.family !== settings.family ||
      previous.camera !== settings.camera ||
      previous.compare !== settings.compare ||
      previous.action !== settings.action
    )
      this.resetCamera();
    const signature = [
      settings.family,
      settings.army,
      settings.source,
      settings.compare,
      settings.compare ? "all" : settings.tier,
    ].join(":");
    await this.environment.update(settings);
    if (this.disposed || generation !== this.generation) return;
    if (signature === this.signature) {
      this.configureActors();
      return;
    }

    const tiers: ShipTier[] = settings.compare ? [1, 2, 3] : [settings.tier];
    const results = await Promise.allSettled(tiers.map((tier) => this.createSlot(settings, tier)));
    const next = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    const failed = results.find((result) => result.status === "rejected");
    if (this.disposed || generation !== this.generation || failed) {
      next.forEach((slot) => slot.dispose());
      if (failed?.status === "rejected" && generation === this.generation && !this.disposed) {
        this.signature = "";
        throw failed.reason;
      }
      return;
    }
    this.slots.forEach((slot) => slot.dispose());
    this.slots = next;
    this.signature = signature;
    next.forEach((slot, index) => {
      slot.group.position.x =
        settings.family === "ships"
          ? terrainHexToWorld(settings.compare ? (1 - index) * 2 : 0, 2).x
          : settings.compare
            ? (1 - index) * 5.5
            : 0;
      this.stage.add(slot.group);
    });

    this.rebuildFootprints();
    this.configureActors();
    this.seconds = 0;
  }

  pause(paused: boolean): void {
    this.paused = paused;
  }
  step(): void {
    this.paused = true;
    this.seconds = Math.min(MODEL_LAB_SEQUENCE_SECONDS, this.seconds + 1 / 60);
    this.runtime.stepOnce();
    this.slots.forEach((slot) => slot.mixer?.update(1 / 60));
    this.applyChoreography();
  }

  seek(progress: number): void {
    this.seconds = Math.max(0, Math.min(1, progress)) * MODEL_LAB_SEQUENCE_SECONDS;
    this.applyChoreography();
  }
  resetCamera(): void {
    const naval = this.settings.family === "ships";
    const scale = naval ? (this.settings.compare ? 0.46 : 0.18) : this.settings.compare ? 0.86 : 0.43;
    const poses = { orbit: [10, 9, -18], rts: [4, 26, 22], side: [20, 5, 2], top: [0, 28, 0.01] };
    const targetZ = naval ? 2.4 : 0;
    this.controls.target.set(0, naval ? 0.3 : 0.8, targetZ);
    this.camera.position
      .fromArray(poses[this.settings.camera])
      .multiplyScalar(scale)
      .add(new Vector3(0, 0, targetZ));
    this.controls.update();
  }

  async setSailArtwork(file: File | null): Promise<void> {
    const generation = ++this.artworkGeneration;
    const artwork = file ? await createImageBitmap(file, { resizeWidth: 512, resizeQuality: "high" }) : null;
    if (this.disposed || generation !== this.artworkGeneration) {
      artwork?.close();
      return;
    }
    this.sailArtwork?.close();
    this.sailArtwork = artwork;
    this.sailPrintKey = "";
    this.configureSailIdentity();
  }

  private configureSailIdentity(): void {
    if (this.settings.family !== "ships" || this.settings.source !== "study") return;
    const { army, sailColor: color, sailPrint: print } = this.settings;
    const key = `${army}:${color}:${print}`;
    const oldTexture = this.sailTexture;
    if (key !== this.sailPrintKey || !this.sailTexture) {
      this.sailTexture = createSailPrint({ army, color, print }, this.sailArtwork ?? undefined);
      this.sailPrintKey = key;
    }
    for (const slot of this.slots) slot.ship?.setSailPrint(this.sailTexture, color);
    if (oldTexture !== this.sailTexture) oldTexture?.dispose();
  }

  async exportModel(tier: number): Promise<Blob> {
    const ship = this.slots.find((slot) => slot.tier === tier)?.ship;
    if (!ship) throw new Error("Choose a new ship study to export");
    const snapshot = ship.object.clone(true);
    snapshot.position.set(0, 0, 0);
    snapshot.traverse((object) => {
      if (object instanceof Mesh) object.geometry = object.geometry.clone();
    });
    const decodedTextures: Texture[] = [];
    try {
      const result = await new GLTFExporter()
        .setTextureUtils({
          decompress: async (...args: Parameters<typeof WebGPUTextureUtils.decompress>) => {
            const texture = await WebGPUTextureUtils.decompress(...args);
            decodedTextures.push(texture);
            return texture;
          },
        })
        .parseAsync(snapshot, { binary: true, onlyVisible: true });
      if (!(result instanceof ArrayBuffer)) throw new Error("The model exporter did not return a GLB");
      return new Blob([result], { type: "model/gltf-binary" });
    } finally {
      decodedTextures.forEach((texture) => texture.dispose());
      snapshot.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.controls.dispose();
    this.slots.forEach((slot) => slot.dispose());
    this.sailTexture?.dispose();
    this.sailArtwork?.close();
    this.artworkGeneration++;
    this.disposeFootprints();
    this.environment.dispose();
    for (const pending of this.shipAssets.values()) {
      void pending.then(
        (template) => disposeSkinnedSceneTemplates([template]),
        () => {},
      );
    }
    this.shipAssets.clear();
    this.runtime.dispose();
    this.initialized.rendererRuntime.backend.dispose?.();
    this.renderer.domElement.remove();
  }

  private async createSlot(settings: ModelLabSettings, tier: ShipTier): Promise<Slot> {
    if (settings.family === "ships" && settings.source === "study") return this.createShipSlot(settings, tier);
    if (settings.source === "current") return this.createCurrentSlot(settings, tier);
    return this.loadArchivedSlot(settings, tier);
  }

  private async createShipSlot(settings: ModelLabSettings, tier: ShipTier): Promise<Slot> {
    const assets = await this.loadShipAssets(settings.army, tier);
    if (this.disposed) throw new Error("Model review was closed");
    const group = new Group();
    const ship = createShipDesign(assets, settings.army, tier);
    group.add(ship.object);
    return {
      group,
      model: ship.object,
      tier,
      name: ship.name,
      triangles: ship.triangles,
      clips: 0,
      ship,
      dispose: () => {
        ship.dispose();
        group.removeFromParent();
      },
    };
  }

  private createCurrentSlot(settings: ModelLabSettings, tier: ShipTier): Slot {
    const group = new Group();
    const actor = this.runtime.createActor(unitConfig(settings, tier));
    if (settings.family === "ships") fitShipToHex(actor.object);
    group.add(actor.object);
    const stats = actor.getStats();
    return {
      group,
      model: actor.object,
      tier,
      name: stats.assetLabel,
      triangles: countTriangles(actor.object),
      clips: stats.authoredClipCount,
      actor,
      dispose: () => {
        actor.dispose();
        group.removeFromParent();
      },
    };
  }

  private async loadArchivedSlot(settings: ModelLabSettings, tier: ShipTier): Promise<Slot> {
    const group = new Group();
    const path = assetPath(settings, tier);
    const gltf = await gltfLoader.loadAsync(path);
    if (this.disposed) {
      disposeSkinnedSceneTemplates([gltf.scene]);
      throw new Error("Model review was closed");
    }
    const bounds = new Box3().setFromObject(gltf.scene);
    const size = bounds.getSize(new Vector3());
    const scale = settings.family === "ships" ? 3.8 / Math.max(size.x, size.z) : 2.1 / size.y;
    gltf.scene.scale.setScalar(scale);
    gltf.scene.position.y = -bounds.min.y * scale;
    if (settings.family === "ships") {
      fitShipToHex(gltf.scene);
      gltf.scene.position.y = -bounds.min.y * gltf.scene.scale.y;
    }
    group.add(gltf.scene);
    const mixer = new AnimationMixer(gltf.scene);
    if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play();
    return {
      group,
      tier,
      model: gltf.scene,
      name: path.split("/").pop()!,
      triangles: countTriangles(gltf.scene),
      clips: gltf.animations.length,
      mixer,
      dispose: () => {
        mixer.stopAllAction();
        mixer.uncacheRoot(gltf.scene);
        disposeSkinnedSceneTemplates([gltf.scene]);
        group.removeFromParent();
      },
    };
  }

  private configureActors(): void {
    this.configureSailIdentity();
    for (const slot of this.slots) {
      slot.actor?.updateConfig(unitConfig(this.settings, slot.tier));
      slot.ship?.setWireframe(this.settings.wireframe);
      slot.ship?.setWind(this.settings.wind);
      slot.group.traverse((object) => {
        if (object instanceof Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          for (const material of Array.isArray(object.material) ? object.material : [object.material])
            if ("wireframe" in material) material.wireframe = this.settings.wireframe;
        }
      });
    }
  }

  private frame(): void {
    if (this.disposed) return;
    const now = performance.now(),
      delta = Math.min((now - this.lastFrame) / 1000, 0.06);
    this.lastFrame = now;
    this.frames++;
    if (!this.paused) {
      this.seconds = (this.seconds + delta * this.settings.speed) % MODEL_LAB_SEQUENCE_SECONDS;
      this.runtime.update(delta * this.settings.speed);
      this.slots.forEach((slot) =>
        slot.mixer?.update(this.settings.action === "idle" ? 0 : delta * this.settings.speed),
      );
    }
    this.applyChoreography();
    this.controls.update();
    this.environment.frame(this.paused ? 0 : delta * this.settings.speed, this.controls.target, this.settings.lighting);
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
    if (now - this.lastStats > 250) {
      const motion = sampleModelLabMotion(this.settings.action, this.seconds);
      this.input.onStats({
        progress: motion.progress,
        phase:
          this.settings.family === "ships" ? motion.phase : this.settings.action === "move" ? "Locomotion" : "Idle",
        triangles: this.renderer.info.render.triangles,
        calls: this.renderer.info.render.drawCalls ?? this.renderer.info.render.calls,
        fps: Math.round((this.frames * 1000) / (now - this.lastStats)),
        assets: this.slots.map(({ tier, name, triangles, clips }) => ({ tier, name, triangles, clips })),
      });
      this.lastStats = now;
      this.frames = 0;
    }
  }

  private applyChoreography(): void {
    const motion = sampleModelLabMotion(this.settings.action, this.seconds);
    const interactions: TerrainMovementInteraction[] = [];
    for (const slot of this.slots) {
      const x = slot.group.position.x;
      if (this.settings.family !== "ships") {
        slot.model.rotation.y = Math.PI;
        const z = this.settings.action === "move" ? 2 - motion.progress * 4 : 0;
        slot.group.position.z = z;
        slot.group.position.y = this.environment.terrain.sampleSurface(x, z).height + 0.02;
        interactions.push({
          entityId: slot.tier,
          isMoving: this.settings.action === "move" && !this.paused,
          mode: this.settings.family === "paladin" && slot.tier === 3 ? "airborne" : "ground",
          worldX: x,
          worldY: slot.group.position.y,
          worldZ: z,
          yaw: Math.PI,
        });
        continue;
      }
      slot.group.position.y = TERRAIN_WATER_LEVEL;
      slot.ship?.animate(this.seconds, motion.sailing);
      slot.model.position.z = 3 + (motion.shipZ - 0.5) * (3 / 3.5);
      this.positionFootprint(slot);
      interactions.push({
        entityId: slot.tier,
        isMoving: motion.sailing && !this.paused,
        mode: "naval",
        worldX: x,
        worldY: TERRAIN_WATER_LEVEL,
        worldZ: slot.model.position.z,
        yaw: Math.PI,
      });
    }
    this.environment.terrain.setMovementInteractions(interactions);
  }

  private rebuildFootprints(): void {
    this.disposeFootprints();
    if (this.settings.family !== "ships") return;
    const points = terrainHexCorners(0, 0).map(({ x, z }) => new Vector3(x, 0, z));
    points.push(points[0].clone());
    for (const slot of this.slots) {
      const outline = new Line(
        new BufferGeometry().setFromPoints(points),
        new LineBasicMaterial({
          color: 0xe4c483,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        }),
      );
      outline.name = `ship-hex-${slot.tier}`;
      this.footprints.add(outline);
    }
  }

  private positionFootprint(slot: Slot): void {
    const outline = this.footprints.getObjectByName(`ship-hex-${slot.tier}`);
    if (!outline) return;
    const hex = findNearestTerrainHex(slot.group.position.x, slot.model.position.z);
    const center = terrainHexToWorld(hex.col, hex.row);
    outline.position.set(center.x, TERRAIN_WATER_LEVEL + 0.012, center.z);
  }

  private disposeFootprints(): void {
    this.footprints.children.forEach((outline) => {
      if (outline instanceof Line) {
        outline.geometry.dispose();
        (outline.material as LineBasicMaterial).dispose();
      }
    });
    this.footprints.clear();
  }

  private loadShipAssets(army: ModelLabSettings["army"], tier: ShipTier): Promise<Group> {
    const path = `/models/ships/${army}-t${tier}.glb`;
    let pending = this.shipAssets.get(path);
    if (!pending) {
      pending = gltfLoader.loadAsync(path).then((asset) => asset.scene);
      this.shipAssets.set(path, pending);
      void pending.catch(() => this.shipAssets.delete(path));
    }
    return pending;
  }

  private resize(): void {
    const { width, height } = this.input.container.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

function unitConfig(settings: ModelLabSettings, tier: ShipTier) {
  const kind =
    settings.family === "ships"
      ? "boat"
      : settings.family === "crossbowman"
        ? tier === 2
          ? "crossbowman"
          : "archer"
        : settings.family;
  const moving = settings.action !== "idle";
  return applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), {
    kind,
    humanoid: {
      tier,
      seed: 731,
      animationMode: kind === "paladin" ? "mounted" : moving ? "walk" : "idle",
      renderDetail: "crowd",
    },
    horse: { tier, gait: moving ? "walk" : "idle", speed: moving ? 1.4 : 0 },
    dragon: { tier, locomotionMode: moving ? "flight" : "idle", speed: moving ? 3.2 : 0, renderDetail: "crowd" },
    boat: { tier, motionMode: moving ? "sail" : "idle", showWake: moving, speed: moving ? 1.6 : 0 },
  });
}

function assetPath(settings: ModelLabSettings, tier: ShipTier): string {
  if (settings.family === "ships")
    return settings.source === "legacy" ? "/models/units/ship.glb" : "/models/units/boat.glb";
  if (settings.source === "default") return `/models/units/default_${settings.family}_lvl${tier}.glb`;
  return `/models/units/${settings.family === "crossbowman" ? "archer" : settings.family}${tier}.glb`;
}

function countTriangles(group: Group): number {
  let triangles = 0;
  group.traverse((object) => {
    if (object instanceof Mesh)
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  });
  return triangles;
}
