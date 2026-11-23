import {
  Box3,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  PCFShadowMap,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  BufferGeometry,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { env } from "../../../env";
import { ProceduralCharacterAvatar } from "@/three/characters/procedural-character-avatar";
import { resolveProceduralCharacterAppearance } from "@/three/characters/procedural-character-appearance";
import {
  applyProceduralCharacterConfigPatch,
  createDefaultProceduralCharacterConfig,
  type ProceduralCharacterConfig,
} from "@/three/characters/procedural-character-config";
import { ProceduralCharacterPoseFilter } from "@/three/characters/procedural-character-pose-filter";
import { resolveProceduralCharacterPose, type ProceduralCharacterPose } from "@/three/characters/procedural-character-pose";
import { applyCharacterRigLimbLengths, resolveCharacterRig, type ResolvedCharacterRig } from "@/three/characters/procedural-character-rig";
import {
  advanceProceduralCharacterGaitPhase,
  resolveInitialProceduralCharacterPhase,
  resolveProceduralCharacterStrideLength,
  type CharacterFootId,
} from "@/three/characters/procedural-character-gait";
import { ProceduralPlantController } from "@/three/characters/procedural-plant-controller";
import { ProceduralContactReactionController } from "@/three/characters/collision/procedural-contact-reaction";
import { applyProceduralMeleeConfigPatch, createDefaultProceduralMeleeConfig } from "@/three/characters/melee/procedural-melee-config";
import { ProceduralMeleeController } from "@/three/characters/melee/procedural-melee-controller";
import { applyProceduralMeleeHitReaction } from "@/three/characters/melee/procedural-melee-pose";
import { T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER } from "@/three/characters/t1-knight-default-humanoid-rig-adapter";
import { applyProceduralUnitConfigPatch, createDefaultProceduralUnitConfig } from "@/three/characters/procedural-unit-config";
import { ProceduralUnitRuntime, type ProceduralUnitActor } from "@/three/characters/procedural-unit-runtime";
import { T1_KNIGHT_WORLD_SCALE } from "@/three/constants/army-constants";
import { HEX_SIZE } from "@/three/constants/scene-constants";
import { ModelLabEnvironment } from "@/three/debug/model-lab/model-lab-environment";
import { DEFAULT_MODEL_LAB_SETTINGS } from "@/three/debug/model-lab/model-lab-settings";
import type { RendererSurfaceLike } from "@/three/renderer-backend";
import { initializeRendererBackendRuntime } from "@/three/renderer-backend-runtime";
import { configureRendererColorOutput } from "@/three/renderer-color-output";
import { getRendererDiagnosticActiveMode } from "@/three/renderer-diagnostics";
import { terrainHexCorners } from "@/three/terrain/terrain-coordinates";
import { configureGltfTextureSupport, gltfLoader } from "@/three/utils/gltf-loader";
import { isCoarsePointer } from "@/utils/pointer";
import {
  REEL_SEQUENCE,
  type TroopMotionAction,
  type TroopMotionLabel,
  type TroopMotionState,
} from "./troop-motion-types";

export interface TroopMotionStats {
  rendererMode: string;
  activeAction: Exclude<TroopMotionAction, "reel">;
  actionLabel: string;
  drawCalls: number;
  triangles: number;
  seconds: number;
}

export interface TroopMotionRendererHandle {
  updateState(next: TroopMotionState): void;
  seek(seconds: number): void;
  resetCamera(): void;
  getStats(): TroopMotionStats;
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

interface BaselineKnightHandle {
  root: Group;
  setMode(mode: "idle" | "walk"): void;
  attack(target: Vector3): void;
  hit(): void;
  reset(): void;
  update(deltaSeconds: number): void;
  dispose(): void;
}

const COMPARE_LEFT_X = -0.82;
const COMPARE_RIGHT_X = 0.82;
const FACING_YAW = 0.24;
const MARCH_HALF_SPAN = 0.44;
const MARCH_SPEED = 0.42;

function createHexOutline(centerX: number, centerZ: number, groundY: number): Line {
  const corners = terrainHexCorners(centerX, centerZ, HEX_SIZE);
  const points = corners.map(([x, z]) => new Vector3(x, groundY + 0.014, z));
  points.push(points[0].clone());
  const geometry = new BufferGeometry().setFromPoints(points);
  const material = new LineBasicMaterial({ color: 0xf4dca8, transparent: true, opacity: 0.52 });
  const line = new Line(geometry, material);
  line.renderOrder = 6;
  return line;
}

function setShadows(root: Group): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
}

async function createBaselineShippedKnight(baseUrl: string): Promise<BaselineKnightHandle> {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const [skinGltf, swordGltf, shieldGltf] = await Promise.all([
    gltfLoader.loadAsync(`${cleanBase}/skin.glb`),
    gltfLoader.loadAsync(`${cleanBase}/sword.glb`),
    gltfLoader.loadAsync(`${cleanBase}/shield.glb`),
  ]);

  const appearance = resolveProceduralCharacterAppearance("t1-knight-default");
  let config: ProceduralCharacterConfig = applyProceduralCharacterConfigPatch(
    createDefaultProceduralCharacterConfig(),
    {
      animationMode: "idle",
      appearanceId: "t1-knight-default",
      renderDetail: "hero",
      seed: 1337,
      tier: 1,
    },
  );
  let rig: ResolvedCharacterRig = resolveCharacterRig(config);
  const avatar = new ProceduralCharacterAvatar(
    {
      adapter: T1_KNIGHT_DEFAULT_HUMANOID_RIG_ADAPTER,
      adapterId: "t1-knight-default",
      appearanceId: "t1-knight-default",
      appearanceLabel: "Shipped Knight",
      gltf: skinGltf,
      id: "t1-knight-default-near",
      label: "Shipped Knight near",
      materials: appearance.materials,
      tier: 1,
      url: `${cleanBase}/skin.glb`,
    },
    rig,
    config,
  );
  rig = applyCharacterRigLimbLengths(rig, avatar.measureActiveLimbLengths());
  avatar.rebuild(rig, config);

  const root = new Group();
  root.name = "shipped-knight-baseline";
  root.add(avatar.group);

  const sword = new Group();
  sword.add(swordGltf.scene);
  setShadows(sword);
  const shield = new Group();
  shield.add(shieldGltf.scene);
  setShadows(shield);
  avatar.group.add(sword, shield);

  const meleeConfig = applyProceduralMeleeConfigPatch(createDefaultProceduralMeleeConfig("knight"), {
    offhandId: "t1-knight-default-shield",
    weaponId: "t1-knight-default-sword",
  });
  const melee = new ProceduralMeleeController(meleeConfig, false, config.seed);
  const plant = new ProceduralPlantController<CharacterFootId>();
  const filter = new ProceduralCharacterPoseFilter();
  const reaction = new ProceduralContactReactionController();
  const socketPos = new Vector3();
  const socketQuat = new Quaternion();
  const invRootQuat = new Quaternion();
  let gaitPhase = resolveInitialProceduralCharacterPhase(config.seed);
  let elapsed = 0;
  let pose: ProceduralCharacterPose = resolveProceduralCharacterPose(rig, config, 0, undefined, gaitPhase, undefined, undefined, undefined, {
    skipLiveCadence: true,
  });

  const syncSockets = () => {
    avatar.group.updateMatrixWorld(true);
    avatar.group.getWorldQuaternion(invRootQuat).invert();
    if (avatar.writeSocketWorldTransform("gripRight", socketPos, socketQuat)) {
      avatar.group.worldToLocal(socketPos);
      sword.position.copy(socketPos);
      sword.quaternion.copy(invRootQuat).multiply(socketQuat).normalize();
    }
    if (avatar.writeSocketWorldTransform("forearmLeft", socketPos, socketQuat)) {
      avatar.group.worldToLocal(socketPos);
      shield.position.copy(socketPos);
      shield.quaternion.copy(invRootQuat).multiply(socketQuat).normalize();
    }
  };

  const applyFrame = (deltaSeconds: number) => {
    plant.beginFrame(avatar.group, deltaSeconds);
    const reactionPose = reaction.update(deltaSeconds);
    const motion = config.animationMode === "walk" ? "walking" : "standing";
    const baseAction = melee.update(deltaSeconds, avatar.group, motion);
    const action = reactionPose ? applyProceduralMeleeHitReaction(baseAction, reactionPose.weight) : baseAction;
    avatar.setUpperBodyAction(action);
    gaitPhase = advanceProceduralCharacterGaitPhase(
      gaitPhase,
      config,
      deltaSeconds,
      plant.getFrameTravelDistance(),
      resolveProceduralCharacterStrideLength(config, rig.morphology.scale),
    );
    elapsed += deltaSeconds;
    pose = filter.apply(
      resolveProceduralCharacterPose(
        rig,
        config,
        elapsed,
        plant.resolveTarget,
        gaitPhase,
        action,
        reactionPose,
        pose.parts.chest.quaternion,
        { skipLiveCadence: true },
      ),
      deltaSeconds,
      config.secondaryMotion,
    );
    avatar.applyPose(pose);
    syncSockets();
  };

  applyFrame(1 / 60);

  return {
    root,
    setMode(mode) {
      if (config.animationMode === mode) return;
      config = applyProceduralCharacterConfigPatch(config, { animationMode: mode });
      avatar.updateConfig(config);
    },
    attack(target) {
      melee.attack(target);
    },
    hit() {
      reaction.trigger({
        localDirectionX: 0.12,
        localDirectionY: 0,
        localDirectionZ: -1,
        source: "melee",
        strength: 1,
      });
    },
    reset() {
      melee.reset();
      plant.reset();
      filter.reset();
      reaction.reset();
      avatar.resetPoseHistory();
      gaitPhase = resolveInitialProceduralCharacterPhase(config.seed);
      elapsed = 0;
      applyFrame(1 / 60);
    },
    update(deltaSeconds) {
      applyFrame(deltaSeconds);
    },
    dispose() {
      avatar.dispose();
      sword.removeFromParent();
      shield.removeFromParent();
      root.removeFromParent();
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
  const backend = await initializeRendererBackendRuntime({
    antialias: true,
    canvas: document.createElement("canvas"),
    config: {
      forceWebGL: env.VITE_PUBLIC_FORCE_WEBGL,
      preferWebGPU: env.VITE_PUBLIC_ENABLE_WEBGPU,
    },
    powerPreference: "high-performance",
  });
  if (input.signal.aborted) {
    backend.renderer.dispose();
    throw new Error("Troop motion lab aborted during startup");
  }

  const renderer = backend.renderer as LoopRenderer;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  configureRendererColorOutput(renderer);
  configureGltfTextureSupport(renderer);

  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  input.container.replaceChildren(canvas);

  const scene = new Scene();
  scene.background = new Color(0x819997);
  const environment = new ModelLabEnvironment(scene);
  await environment.update({ ...DEFAULT_MODEL_LAB_SETTINGS, family: "units", biome: "grassland" });
  const groundY = environment.terrain.sampleHeight(0, 0);

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

  let shippedKnight: BaselineKnightHandle | null = null;
  if (input.initialState.compareShipped && input.initialState.shippedBaseUrl) {
    shippedKnight = await createBaselineShippedKnight(input.initialState.shippedBaseUrl);
    shippedKnight.root.scale.setScalar(T1_KNIGHT_WORLD_SCALE);
    shippedKnight.root.rotation.y = FACING_YAW;
    scene.add(shippedKnight.root);
  }

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

  const rebuildStage = () => {
    while (hexOutlines.length > 0) {
      const line = hexOutlines.pop()!;
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
      stageGroup.remove(line);
    }
    const compare = Boolean(shippedKnight && state.compareShipped);
    if (shippedKnight) shippedKnight.root.visible = compare;
    if (compare) {
      newKnightRoot.position.set(COMPARE_RIGHT_X, groundY, 0);
      shippedKnight!.root.position.set(COMPARE_LEFT_X, groundY, 0);
      hexOutlines.push(createHexOutline(COMPARE_LEFT_X, 0, groundY), createHexOutline(COMPARE_RIGHT_X, 0, groundY));
    } else {
      newKnightRoot.position.set(0, groundY, 0);
      hexOutlines.push(createHexOutline(0, 0, groundY));
    }
    hexOutlines.forEach((line) => stageGroup.add(line));
  };

  const applyCamera = () => {
    const compare = Boolean(shippedKnight && state.compareShipped);
    if (state.camera === "phone") {
      camera.fov = compare ? 38 : 34;
      camera.position.set(0, groundY + (compare ? 1.82 : 1.48), compare ? 4.85 : 3.45);
      controls.target.set(0, groundY + 0.52, 0);
    } else if (compare) {
      camera.fov = 33;
      camera.position.set(0, groundY + 1.46, 3.55);
      controls.target.set(0, groundY + 0.54, 0);
    } else {
      camera.fov = 32;
      camera.position.set(0.55, groundY + 1.24, 2.55);
      controls.target.set(0, groundY + 0.54, 0);
    }
    camera.updateProjectionMatrix();
    controls.update();
  };

  const applyActionMode = (nextAction: Exclude<TroopMotionAction, "reel">, forceReset: boolean) => {
    if (forceReset) {
      newKnight.reset();
      shippedKnight?.reset();
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
    shippedKnight?.setMode(locomotion);
    const compare = Boolean(shippedKnight && state.compareShipped);
    newKnightRoot.position.set(compare ? COMPARE_RIGHT_X : 0, groundY, 0);
    if (shippedKnight) shippedKnight.root.position.set(COMPARE_LEFT_X, groundY, 0);
  };

  const updateSize = () => {
    const width = Math.max(1, input.container.clientWidth);
    const height = Math.max(1, input.container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarsePointer() ? 1.5 : 2));
    renderer.setSize(width, height, false);
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
  const attackTargetShipped = new Vector3();
  const statsBox = new Box3();

  const projectLabels = () => {
    const width = input.container.clientWidth;
    const height = input.container.clientHeight;
    if (width <= 0 || height <= 0) return;
    const compare = Boolean(shippedKnight && state.compareShipped);
    const entries: Array<{ id: string; text: string; pos: Vector3 }> = compare
      ? [
          {
            id: "shipped",
            text: "Shipped Knight",
            pos: new Vector3(shippedKnight!.root.position.x, groundY + 1.18, shippedKnight!.root.position.z),
          },
          {
            id: "new",
            text: "New Knight · Redone",
            pos: new Vector3(newKnightRoot.position.x, groundY + 1.18, newKnightRoot.position.z),
          },
        ]
      : [
          {
            id: "new",
            text: `New Knight · ${actionLabel}`,
            pos: new Vector3(newKnightRoot.position.x, groundY + 1.18, newKnightRoot.position.z),
          },
        ];
    const pad = Math.min(84, width * 0.23);
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

    if (activeAction === "march") {
      const zTravel = ((actionClock * MARCH_SPEED) % (MARCH_HALF_SPAN * 2)) - MARCH_HALF_SPAN;
      newKnightRoot.position.z = zTravel;
      if (shippedKnight) shippedKnight.root.position.z = zTravel;
    } else if (activeAction === "attack") {
      const cycleIndex = Math.floor(actionClock / 1.55);
      if (cycleIndex !== lastTriggerIndex) {
        lastTriggerIndex = cycleIndex;
        attackTargetNew.set(newKnightRoot.position.x + 0.35, groundY + 0.62, newKnightRoot.position.z + 1.45);
        newKnight.attack(attackTargetNew);
        if (shippedKnight) {
          attackTargetShipped.set(
            shippedKnight.root.position.x + 0.35,
            groundY + 0.62,
            shippedKnight.root.position.z + 1.45,
          );
          shippedKnight.attack(attackTargetShipped);
        }
      }
    } else if (activeAction === "hit") {
      const cycleIndex = Math.floor(actionClock / 1.35);
      if (cycleIndex !== lastTriggerIndex) {
        lastTriggerIndex = cycleIndex;
        newKnight.applyReaction({
          directionX: 0.12,
          directionY: 0,
          directionZ: -1,
          source: "melee",
          strength: 1,
        });
        shippedKnight?.hit();
      }
    } else if (activeAction === "death") {
      if (!deathTriggered && actionClock >= 0.25) {
        deathTriggered = true;
        newKnight.playDeath();
        shippedKnight?.hit();
      } else if (state.action !== "reel" && actionClock >= 2.55) {
        applyActionMode("death", true);
      }
    }

    runtime.update(deltaSeconds);
    shippedKnight?.update(deltaSeconds);
    environment.frame(deltaSeconds, controls.target, "day");
  };

  let lastFrameMs = performance.now();
  let lastStatsPushMs = 0;

  const getStats = (): TroopMotionStats => {
    statsBox.setFromObject(newKnightRoot);
    return {
      rendererMode: getRendererDiagnosticActiveMode() ?? "webgpu",
      activeAction,
      actionLabel,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      seconds: elapsedSeconds,
    };
  };

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
      const cameraChanged = next.camera !== state.camera || next.compareShipped !== state.compareShipped;
      const actionChanged = next.action !== state.action;
      state = { ...next };
      if (cameraChanged) {
        rebuildStage();
        applyCamera();
      }
      if (actionChanged) {
        elapsedSeconds = 0;
        applyActionMode(next.action === "reel" ? "idle" : next.action, true);
      }
    },
    seek(seconds) {
      elapsedSeconds = 0;
      applyActionMode(state.action === "reel" ? "idle" : state.action, true);
      const step = 1 / 60;
      const count = Math.max(1, Math.round(seconds / step));
      for (let i = 0; i < count; i++) stepSimulation(step);
      renderer.render(scene, camera);
      projectLabels();
      input.onStats(getStats());
    },
    resetCamera() {
      applyCamera();
    },
    getStats,
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
      shippedKnight?.dispose();
      newKnight.dispose();
      runtime.dispose();
      environment.dispose();
      renderer.dispose();
    },
  };
}
