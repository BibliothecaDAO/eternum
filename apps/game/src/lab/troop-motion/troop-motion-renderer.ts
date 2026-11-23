import { BiomeType } from "@bibliothecadao/types";
import {
  BufferGeometry,
  Color,
  Euler,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { env } from "../../../env";
import {
  applyProceduralUnitConfigPatch,
  createDefaultProceduralUnitConfig,
} from "@/three/characters/procedural-unit-config";
import { ProceduralUnitRuntime, type ProceduralUnitActor } from "@/three/characters/procedural-unit-runtime";
import { T1_KNIGHT_WORLD_SCALE, buildArmyModelAssetPath } from "@/three/constants/army-constants";
import { ModelLabEnvironment } from "@/three/debug/model-lab/model-lab-environment";
import { readModelLabSettings } from "@/three/debug/model-lab/model-lab-settings";
import { createTripoModelMaterial } from "@/three/materials/tripo-model-material";
import { ArmyModel } from "@/three/managers/army-model";
import type { AnimatedTroopKind } from "@/three/managers/troop-motion";
import { ModelType } from "@/three/types/army";
import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { initializeRendererBackendRuntime } from "@/three/renderer-backend-runtime";
import { configureRendererColorOutput } from "@/three/renderer-color-output";
import { getRendererDiagnosticActiveMode } from "@/three/renderer-diagnostics";
import { terrainHexCorners } from "@/three/terrain/terrain-coordinates";
import { configureGltfTextureSupport, gltfLoader } from "@/three/utils/gltf-loader";
import { isCoarsePointer } from "@/utils/pointer";
import {
  REEL_SEQUENCE,
  TROOP_MOTION_KINDS,
  type TroopMotionAction,
  type TroopMotionKind,
  type TroopMotionLabel,
  type TroopMotionState,
} from "./troop-motion-types";

export interface TroopMotionMeta {
  troops: readonly TroopMotionKind[];
  actions: ReadonlyArray<Exclude<TroopMotionAction, "reel">>;
}

export interface TroopMotionStats {
  rendererMode: string;
  troop: TroopMotionKind;
  activeAction: Exclude<TroopMotionAction, "reel">;
  actionLabel: string;
  drawCalls: number;
  triangles: number;
  seconds: number;
}

export interface TroopMotionRendererHandle {
  updateState(next: TroopMotionState): void;
  resetCamera(): void;
  getStats(): TroopMotionStats;
  getMeta(): TroopMotionMeta;
  dispose(): void;
}

interface MountTroopMotionInput {
  container: HTMLElement;
  initialState: TroopMotionState;
  signal: AbortSignal;
  onStats(stats: TroopMotionStats): void;
  onLabels(labels: TroopMotionLabel[]): void;
}

interface LoopRenderer extends RendererSurfaceLike {
  setAnimationLoop(callback: (() => void) | null): void;
}

interface StaticTroopReference {
  kind: AnimatedTroopKind;
  staticRoot: Group;
  dispose(): void;
}

const COMPARE_LEFT_X = -0.84;
const COMPARE_RIGHT_X = 0.84;
const FACING_YAW = 0.24;
const MARCH_HALF_SPAN = 0.44;
const MARCH_SPEED = 0.42;
const SIDE_OWN_COLOR = new Color("#66ddab");
const IDENTITY_MATRIX = new Matrix4();
const TROOP_UNIT_SCALE = new Vector3(1, 1, 1);
const TROOP_FACING_EULER = new Euler(0, FACING_YAW, 0);
const TROOP_ENTITY_ID = 101;

function createHexOutline(centerX: number, centerZ: number, groundY: number): Line {
  const corners = terrainHexCorners(centerX, centerZ);
  const points = corners.map(({ x, z }) => new Vector3(x, groundY + 0.014, z));
  points.push(points[0].clone());
  const geometry = new BufferGeometry().setFromPoints(points);
  const material = new LineBasicMaterial({ color: 0xf4dca8, transparent: true, opacity: 0.52 });
  const line = new Line(geometry, material);
  line.renderOrder = 6;
  return line;
}

async function createStaticTroopReference(kind: AnimatedTroopKind): Promise<StaticTroopReference> {
  const modelType = kind === "scout" ? ModelType.Paladin1 : ModelType.Crossbowman1;
  const gltf = await gltfLoader.loadAsync(buildArmyModelAssetPath(modelType));

  const staticRoot = new Group();
  const ownedGeometries: BufferGeometry[] = [];
  const ownedMaterials: Array<{ dispose(): void }> = [];
  const ownedMeshes: InstancedMesh[] = [];

  gltf.scene.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const sourceMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
    if (!(sourceMaterial instanceof MeshStandardMaterial)) return;

    const staticGeo = child.geometry.clone();
    const staticMat = createTripoModelMaterial(sourceMaterial);
    const staticMesh = new InstancedMesh(staticGeo, staticMat, 1);
    staticMesh.castShadow = true;
    staticMesh.receiveShadow = true;
    staticMesh.frustumCulled = false;
    staticMesh.instanceColor = new InstancedBufferAttribute(
      new Float32Array([SIDE_OWN_COLOR.r, SIDE_OWN_COLOR.g, SIDE_OWN_COLOR.b]),
      3,
    );
    staticMesh.setMatrixAt(0, IDENTITY_MATRIX);
    staticMesh.instanceMatrix.needsUpdate = true;
    staticMesh.count = 1;
    staticRoot.add(staticMesh);

    ownedGeometries.push(staticGeo);
    ownedMaterials.push(staticMat);
    ownedMeshes.push(staticMesh);
  });

  staticRoot.rotation.y = FACING_YAW;

  return {
    kind,
    staticRoot,
    dispose() {
      ownedMeshes.forEach((m) => m.dispose());
      ownedGeometries.forEach((g) => g.dispose());
      ownedMaterials.forEach((m) => m.dispose());
      staticRoot.removeFromParent();
    },
  };
}

function resolveReelSegment(seconds: number): {
  action: Exclude<TroopMotionAction, "reel">;
  label: string;
  localSeconds: number;
} {
  const total = REEL_SEQUENCE.reduce((sum, item) => sum + item.durationSeconds, 0);
  let cursor = ((seconds % total) + total) % total;
  for (const item of REEL_SEQUENCE) {
    if (cursor < item.durationSeconds) {
      return { action: item.action, label: item.label, localSeconds: cursor };
    }
    cursor -= item.durationSeconds;
  }
  const last = REEL_SEQUENCE[REEL_SEQUENCE.length - 1];
  return { action: last.action, label: last.label, localSeconds: 0 };
}

export async function mountTroopMotionLab(input: MountTroopMotionInput): Promise<TroopMotionRendererHandle> {
  const rendererRuntime = await initializeRendererBackendRuntime({
    envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
    isMobileDevice: isCoarsePointer(),
    pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
    search: window.location.search,
  });
  if (input.signal.aborted) {
    rendererRuntime.backend.dispose();
    throw new Error("Troop motion lab aborted during startup");
  }

  const renderer = rendererRuntime.renderer as LoopRenderer;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  configureRendererColorOutput(renderer);
  configureGltfTextureSupport(rendererRuntime.renderer as Parameters<typeof configureGltfTextureSupport>[0]);

  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  input.container.replaceChildren(canvas);

  const scene = new Scene();
  scene.background = new Color(0x819997);
  const environment = new ModelLabEnvironment(scene);
  await environment.update(readModelLabSettings(new URLSearchParams("family=knight&biome=grassland")));
  const groundY = environment.terrain.sampleSurface(0, 0).height;

  const camera = new PerspectiveCamera(34, 1, 0.1, 120);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.minDistance = 1.4;
  controls.maxDistance = 16;

  const runtime = await ProceduralUnitRuntime.create();
  const baseKnightConfig = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), {
    kind: "knight",
    humanoid: { animationMode: "idle", appearanceId: "t1-knight-default", renderDetail: "hero", seed: 1337, tier: 1 },
  });
  await runtime.prepareAssets(baseKnightConfig);

  const newKnight: ProceduralUnitActor = runtime.createActor(baseKnightConfig);
  const newKnightRoot = new Group();
  newKnightRoot.add(newKnight.object);
  newKnight.object.scale.setScalar(T1_KNIGHT_WORLD_SCALE);
  newKnight.object.rotation.y = FACING_YAW;
  scene.add(newKnightRoot);

  const armyModel = new ArmyModel(scene, () => BiomeType.Grassland);
  armyModel.setShadowsEnabled(true);
  await armyModel.preloadModels(new Set([ModelType.Paladin1, ModelType.Crossbowman1]));
  const troopSlot = armyModel.allocateInstanceSlot(TROOP_ENTITY_ID);
  armyModel.assignModelToEntity(TROOP_ENTITY_ID, ModelType.Paladin1);

  const [scoutRef, crossbowRef] = await Promise.all([
    createStaticTroopReference("scout"),
    createStaticTroopReference("crossbow"),
  ]);
  scene.add(scoutRef.staticRoot, crossbowRef.staticRoot);

  const stageGroup = new Group();
  scene.add(stageGroup);
  const hexOutlines: Line[] = [];

  let state: TroopMotionState = { ...input.initialState };
  let activeAction: Exclude<TroopMotionAction, "reel"> = state.action === "reel" ? "idle" : state.action;
  let actionLabel = activeAction;
  let elapsedSeconds = 0;
  let actionClock = 0;
  let lastTriggerIndex = -1;
  let deathTriggered = false;
  let disposed = false;

  const animatedTroopPos = new Vector3();

  const isComparing = () => state.troop !== "knight" && state.compareShipped;

  const activeTroopBinding = () =>
    state.troop === "scout"
      ? { modelType: ModelType.Paladin1, slot: troopSlot, ref: scoutRef }
      : state.troop === "crossbow"
        ? { modelType: ModelType.Crossbowman1, slot: troopSlot, ref: crossbowRef }
        : null;

  const syncAnimatedTroopPose = (x: number, z: number) => {
    const binding = activeTroopBinding();
    if (!binding) return;
    animatedTroopPos.set(x, groundY, z);
    armyModel.updateInstance(
      TROOP_ENTITY_ID,
      binding.slot,
      animatedTroopPos,
      TROOP_UNIT_SCALE,
      TROOP_FACING_EULER,
      SIDE_OWN_COLOR,
    );
    armyModel.flushInstanceUploads();
    armyModel.requestBoundsUpdate();
    armyModel.applyPendingBounds();
  };

  const rebuildStage = () => {
    while (hexOutlines.length > 0) {
      const line = hexOutlines.pop()!;
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
      stageGroup.remove(line);
    }
    const compare = isComparing();
    newKnightRoot.visible = state.troop === "knight";
    scoutRef.staticRoot.visible = state.troop === "scout" && compare;
    crossbowRef.staticRoot.visible = state.troop === "crossbow" && compare;

    const rightX = compare ? COMPARE_RIGHT_X : 0;
    newKnightRoot.position.set(rightX, groundY, 0);
    scoutRef.staticRoot.position.set(COMPARE_LEFT_X, groundY, 0);
    crossbowRef.staticRoot.position.set(COMPARE_LEFT_X, groundY, 0);

    armyModel.resetInstanceCounts();
    const binding = activeTroopBinding();
    if (binding) {
      armyModel.assignModelToEntity(TROOP_ENTITY_ID, binding.modelType);
      syncAnimatedTroopPose(rightX, 0);
      armyModel.setVisibleSlots([binding.slot]);
    } else {
      armyModel.setVisibleSlots([]);
      armyModel.flushInstanceUploads();
    }

    if (compare) {
      hexOutlines.push(createHexOutline(COMPARE_LEFT_X, 0, groundY), createHexOutline(COMPARE_RIGHT_X, 0, groundY));
    } else {
      hexOutlines.push(createHexOutline(0, 0, groundY));
    }
    hexOutlines.forEach((line) => stageGroup.add(line));
  };

  const applyCamera = () => {
    const compare = isComparing();
    const isScout = state.troop === "scout";
    const targetY = groundY + (isScout ? 0.64 : 0.54);
    if (state.camera === "phone") {
      camera.fov = compare ? 38 : 34;
      camera.position.set(
        0,
        groundY + (compare ? (isScout ? 3.1 : 2.75) : 1.56),
        compare ? (isScout ? 9.4 : 8.4) : 3.65,
      );
      controls.target.set(0, targetY, 0);
    } else if (compare) {
      camera.fov = 33;
      camera.position.set(0, groundY + (isScout ? 1.65 : 1.46), isScout ? 4.1 : 3.55);
      controls.target.set(0, targetY, 0);
    } else {
      camera.fov = 32;
      camera.position.set(0.65, groundY + (isScout ? 1.45 : 1.24), isScout ? 3.05 : 2.55);
      controls.target.set(0, targetY, 0);
    }
    camera.updateProjectionMatrix();
    controls.update();
  };

  const applyActionMode = (nextAction: Exclude<TroopMotionAction, "reel">, forceReset: boolean) => {
    if (forceReset) {
      newKnight.reset();
      actionClock = 0;
      lastTriggerIndex = -1;
      deathTriggered = false;
    }
    activeAction = nextAction;
    actionLabel = nextAction.charAt(0).toUpperCase() + nextAction.slice(1);
    const locomotion = nextAction === "march" ? "walk" : "idle";
    runtime.updateActorConfig(
      newKnight,
      applyProceduralUnitConfigPatch(baseKnightConfig, {
        humanoid: { ...baseKnightConfig.humanoid, animationMode: locomotion },
      }),
    );

    if (activeTroopBinding()) {
      armyModel.playTroopAction(troopSlot, nextAction === "march" ? "march" : "idle");
    }

    const compare = isComparing();
    const rightX = compare ? COMPARE_RIGHT_X : 0;
    newKnightRoot.position.set(rightX, groundY, 0);
    scoutRef.staticRoot.position.set(COMPARE_LEFT_X, groundY, 0);
    crossbowRef.staticRoot.position.set(COMPARE_LEFT_X, groundY, 0);
    syncAnimatedTroopPose(rightX, 0);
  };

  const updateSize = () => {
    const width = Math.max(1, input.container.clientWidth);
    const height = Math.max(1, input.container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarsePointer() ? 1.5 : 2));
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const resizeObserver = new ResizeObserver(updateSize);
  resizeObserver.observe(input.container);

  rebuildStage();
  applyActionMode(state.action === "reel" ? "idle" : state.action, true);
  updateSize();
  applyCamera();

  const labelPos = new Vector3();
  const attackTargetNew = new Vector3();

  const projectLabels = () => {
    const width = input.container.clientWidth;
    const height = input.container.clientHeight;
    if (width <= 0 || height <= 0) return;
    const compare = isComparing();
    const labelY = groundY + (state.troop === "scout" ? 1.44 : 1.18);
    const binding = activeTroopBinding();
    const entries: Array<{ id: string; text: string; pos: Vector3 }> =
      state.troop === "knight"
        ? [
            {
              id: "knight",
              text: `Knight · ${actionLabel}`,
              pos: new Vector3(newKnightRoot.position.x, labelY, newKnightRoot.position.z),
            },
          ]
        : compare && binding
          ? [
              {
                id: "static",
                text: `Static ${state.troop === "scout" ? "Scout" : "Crossbow"}`,
                pos: new Vector3(binding.ref.staticRoot.position.x, labelY, binding.ref.staticRoot.position.z),
              },
              {
                id: "animated",
                text: `Animated ${state.troop === "scout" ? "Scout" : "Crossbow"}`,
                pos: new Vector3(animatedTroopPos.x, labelY, animatedTroopPos.z),
              },
            ]
          : binding
            ? [
                {
                  id: "animated",
                  text: `${state.troop === "scout" ? "Scout" : "Crossbow"} · ${actionLabel}`,
                  pos: new Vector3(animatedTroopPos.x, labelY, animatedTroopPos.z),
                },
              ]
            : [];

    const pad = Math.min(88, width * 0.24);
    const labels: TroopMotionLabel[] = entries.map((entry) => {
      labelPos.copy(entry.pos).project(camera);
      const visible = labelPos.z >= -1 && labelPos.z <= 1;
      const rawX = (labelPos.x * 0.5 + 0.5) * width;
      return {
        id: entry.id,
        text: entry.text,
        x: Math.max(pad, Math.min(width - pad, rawX)),
        y: Math.max(22, (-labelPos.y * 0.5 + 0.5) * height),
        visible,
      };
    });
    input.onLabels(labels);
  };

  const stepSimulation = (deltaSeconds: number) => {
    elapsedSeconds += deltaSeconds;
    if (state.action === "reel") {
      const segment = resolveReelSegment(elapsedSeconds);
      if (segment.action !== activeAction) {
        applyActionMode(segment.action, true);
      }
      actionClock = segment.localSeconds;
    } else {
      actionClock += deltaSeconds;
    }

    const binding = activeTroopBinding();

    if (activeAction === "march") {
      const zTravel = ((actionClock * MARCH_SPEED) % (MARCH_HALF_SPAN * 2)) - MARCH_HALF_SPAN;
      newKnightRoot.position.z = zTravel;
      if (binding) {
        binding.ref.staticRoot.position.z = zTravel;
        syncAnimatedTroopPose(isComparing() ? COMPARE_RIGHT_X : 0, zTravel);
      }
    } else if (activeAction === "attack") {
      const cycleIndex = Math.floor(actionClock / 1.55);
      if (cycleIndex !== lastTriggerIndex) {
        lastTriggerIndex = cycleIndex;
        if (state.troop === "knight") {
          attackTargetNew.set(newKnightRoot.position.x + 0.35, groundY + 0.62, newKnightRoot.position.z + 1.45);
          newKnight.attack(attackTargetNew);
        } else if (binding) {
          armyModel.playTroopAction(binding.slot, "attack");
        }
      }
    } else if (activeAction === "hit") {
      const cycleIndex = Math.floor(actionClock / 1.35);
      if (cycleIndex !== lastTriggerIndex) {
        lastTriggerIndex = cycleIndex;
        if (state.troop === "knight") {
          newKnight.applyReaction({
            directionX: 0.12,
            directionY: 0,
            directionZ: -1,
            source: "melee",
            strength: 1,
          });
        } else if (binding) {
          armyModel.playTroopAction(binding.slot, "hit");
        }
      }
    } else if (activeAction === "death") {
      if (!deathTriggered && actionClock >= 0.25) {
        deathTriggered = true;
        if (state.troop === "knight") {
          newKnight.playDeath?.();
        } else if (binding) {
          armyModel.playTroopAction(binding.slot, "death");
        }
      } else if (state.action !== "reel" && actionClock >= 2.55) {
        applyActionMode("death", true);
      }
    }

    if (state.troop === "knight") {
      runtime.update(deltaSeconds);
    } else if (binding) {
      armyModel.updateAnimations(deltaSeconds);
    }
    environment.frame(deltaSeconds, controls.target, "day");
  };

  let lastFrameMs = performance.now();
  let lastStatsPushMs = 0;

  const getStats = (): TroopMotionStats => ({
    rendererMode: getRendererDiagnosticActiveMode() ?? "webgpu",
    troop: state.troop,
    activeAction,
    actionLabel,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    seconds: elapsedSeconds,
  });

  const renderFrame = () => {
    if (disposed) return;
    const now = performance.now();
    const deltaSeconds = Math.min(Math.max((now - lastFrameMs) / 1000, 1 / 240), 0.05);
    lastFrameMs = now;
    stepSimulation(deltaSeconds);
    controls.update();
    renderer.render(scene, camera);
    projectLabels();
    if (now - lastStatsPushMs >= 160) {
      lastStatsPushMs = now;
      input.onStats(getStats());
    }
  };

  renderer.setAnimationLoop(renderFrame);

  return {
    updateState(next) {
      const stageChanged =
        next.troop !== state.troop || next.camera !== state.camera || next.compareShipped !== state.compareShipped;
      const actionChanged = next.action !== state.action || next.troop !== state.troop;
      state = { ...next };
      if (stageChanged) {
        rebuildStage();
        applyCamera();
      }
      if (actionChanged) {
        elapsedSeconds = 0;
        applyActionMode(next.action === "reel" ? "idle" : next.action, true);
      }
    },
    resetCamera() {
      applyCamera();
    },
    getStats,
    getMeta() {
      return {
        troops: TROOP_MOTION_KINDS.map((item) => item.id),
        actions: REEL_SEQUENCE.map((item) => item.action),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      controls.dispose();
      hexOutlines.forEach((line) => {
        line.geometry.dispose();
        (line.material as LineBasicMaterial).dispose();
      });
      scoutRef.dispose();
      crossbowRef.dispose();
      armyModel.dispose();
      newKnight.dispose();
      runtime.dispose();
      environment.dispose();
      rendererRuntime.backend.dispose();
    },
  };
}
