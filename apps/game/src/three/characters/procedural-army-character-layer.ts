import type { ProceduralUnitActor, ProceduralUnitConfig, ProceduralUnitRuntime } from "@/three/characters";
import { T1_KNIGHT_WORLD_SCALE } from "@/three/constants/army-constants";
import { beginModelPreparation } from "@/three/model-preparation";
import type { PipelineCompiler } from "@/three/pipeline-compiler";
import type { CosmeticAttachmentTemplate } from "@/three/cosmetics/types";
import { intersectSweptSphere } from "@/three/projectiles/arrow-ballistics";
import type { ProjectileSweepHit, ProjectileSweepRequest } from "@/three/projectiles/projectile-hit-query";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { BoxGeometry, Euler, Mesh, MeshBasicMaterial, type Scene, Vector3 } from "three";

type CharacterModule = typeof import("@/three/characters");

export interface ProceduralArmyCharacterPresentation {
  category: TroopType;
  attachments?: readonly CosmeticAttachmentTemplate[];
  entityId: number;
  isNaval: boolean;
  position: Vector3;
  primaryColor: string;
  rotation?: Euler;
  tier: TroopTier;
}

type ProceduralArmyActorFamily = "boat" | "foot" | "paladin-dragon" | "paladin-horse";

interface ProceduralArmyActorRecord {
  actor: ProceduralUnitActor;
  actorFamily: ProceduralArmyActorFamily;
  configSignature: string;
  isT1Knight: boolean;
  hitTarget: Mesh;
  posed: boolean;
}

export interface ProceduralArmyCharacterLayerStats {
  actorCount: number;
  knightCount: number;
  meshDrawsPerPass: number;
  trianglesPerPass: number;
  hitTargetCount: number;
  loadState: "failed" | "idle" | "loading" | "ready";
}

const WORLD_CHARACTER_SCALE = 0.72;
const MAX_ACTOR_CREATIONS_PER_SYNC = 4;

/**
 * Production unit presentation for visible land and naval armies. ArmyModel keeps
 * authoritative movement and slots; this layer mirrors those transforms into
 * articulated actors after its shared runtime is ready.
 */
export class ProceduralArmyCharacterLayer {
  private readonly actors = new Map<number, ProceduralArmyActorRecord>();
  private readonly desiredEntityIds = new Set<number>();
  private readonly hitTargetGeometry = new BoxGeometry(1, 1, 1);
  private readonly hitTargetMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  private readonly projectileTargetCenter = new Vector3();
  private readonly projectileHitPoint = new Vector3();
  private characterModule?: CharacterModule;
  private runtime?: ProceduralUnitRuntime;
  private runtimePromise?: Promise<void>;
  private preparingAssets?: Promise<void>;
  private latestPresentations: readonly ProceduralArmyCharacterPresentation[] = [];
  private readonly assetNeeds = new Map<string, { failed: boolean }>();
  private readonly desiredAssetSignatures = new Set<string>();
  private generation = 0;
  private shadowsEnabled = false;
  private disposed = false;

  public constructor(
    private readonly scene: Scene,
    private readonly compilePipelines?: PipelineCompiler,
  ) {}

  public sync(presentations: readonly ProceduralArmyCharacterPresentation[]): void {
    if (this.disposed) return;
    this.syncAssetNeeds(presentations);

    if (!this.runtime || !this.characterModule) {
      if (presentations.length === 0) {
        this.latestPresentations = [];
        return;
      }
      this.latestPresentations = presentations.map(clonePresentation);
      this.startRuntimeLoad();
      return;
    }

    this.latestPresentations = [];
    this.syncReadyPresentations(presentations);
  }

  public sweepProjectile(request: ProjectileSweepRequest): ProjectileSweepHit | undefined {
    const targetEntityId = request.intendedTargetEntityId;
    if (targetEntityId === undefined || targetEntityId === request.ownerEntityId) return undefined;
    const record = this.actors.get(targetEntityId);
    const actor = record?.actor;
    const hitTarget = record?.hitTarget;
    if (!actor || !hitTarget || actor.mode !== "animated") return undefined;
    hitTarget.updateWorldMatrix(true, false);
    hitTarget.getWorldPosition(this.projectileTargetCenter);
    const hit = intersectSweptSphere(
      request.from,
      request.to,
      this.projectileTargetCenter,
      resolveProjectileTargetRadius(actor.kind) + request.radius,
      this.projectileHitPoint,
    );
    if (!hit) return undefined;
    const normal = hit.point.clone().sub(this.projectileTargetCenter);
    if (normal.lengthSq() <= 1e-8) normal.copy(request.to).sub(request.from).normalize().multiplyScalar(-1);
    else normal.normalize();
    return {
      fraction: hit.fraction,
      material: actor.kind === "boat" ? "wood" : isArmoredKind(actor.kind) ? "metal" : "flesh",
      normal,
      partId: "chest",
      point: hit.point.clone(),
      targetEntityId,
    };
  }

  public hasActor(entityId: number): boolean {
    return this.actors.has(entityId);
  }

  public hasProjectileTarget(entityId: number): boolean {
    return this.actors.has(entityId);
  }

  public getStats(): ProceduralArmyCharacterLayerStats {
    let knightCount = 0,
      meshDrawsPerPass = 0,
      trianglesPerPass = 0;
    this.actors.forEach(({ actor, isT1Knight }) => {
      if (isT1Knight) knightCount++;
      actor.object.traverseVisible((object) => {
        if (!(object instanceof Mesh)) return;
        meshDrawsPerPass += Array.isArray(object.material) ? object.geometry.groups.length : 1;
        trianglesPerPass += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
      });
    });
    return {
      actorCount: this.actors.size,
      knightCount,
      meshDrawsPerPass,
      trianglesPerPass,
      hitTargetCount: this.actors.size,
      loadState: [...this.assetNeeds.values()].some((need) => need.failed)
        ? "failed"
        : this.runtime
          ? "ready"
          : this.runtimePromise
            ? "loading"
            : "idle",
    };
  }

  public setShadowsEnabled(enabled: boolean): void {
    if (this.shadowsEnabled === enabled) return;
    this.shadowsEnabled = enabled;
    this.actors.forEach(({ actor }) => this.applyActorShadowState(actor));
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.assetNeeds.clear();
    this.desiredAssetSignatures.clear();
    this.latestPresentations = [];
    this.clearActors();
    this.runtime?.dispose();
    this.runtime = undefined;
    this.characterModule = undefined;
    this.hitTargetGeometry.dispose();
    this.hitTargetMaterial.dispose();
  }

  /** A failure belongs to this continuous need; leaving it permits a fresh attempt on return. */
  private syncAssetNeeds(presentations: readonly ProceduralArmyCharacterPresentation[]): void {
    this.desiredAssetSignatures.clear();
    presentations.forEach((presentation) => {
      const signature = resolveAssetSignature(presentation);
      this.desiredAssetSignatures.add(signature);
      if (!this.assetNeeds.has(signature)) this.assetNeeds.set(signature, { failed: false });
    });
    this.assetNeeds.forEach((_need, signature) => {
      if (!this.desiredAssetSignatures.has(signature)) this.assetNeeds.delete(signature);
    });
  }

  /**
   * Creates the character runtime ahead of the first army that needs it: the map's entry asks for it, so its ~100 ms
   * setup (a phone stand-in) runs behind the doorway instead of in the first pan that brings an army into view.
   */
  public prepare(): void {
    if (this.disposed || this.runtime) return;
    this.loadRuntime([]);
  }

  private startRuntimeLoad(): void {
    const needs = [...this.assetNeeds.values()];
    if (!needs.some((need) => !need.failed)) return;
    this.loadRuntime(needs);
  }

  private loadRuntime(needs: { failed: boolean }[]): void {
    if (this.runtimePromise) return;
    const generation = this.generation;
    const endPreparation = beginModelPreparation();
    this.runtimePromise = import("@/three/characters")
      .then(async (characterModule) => {
        const runtime = await characterModule.ProceduralUnitRuntime.create();
        if (this.disposed || generation !== this.generation) {
          runtime.dispose();
          return;
        }
        this.characterModule = characterModule;
        this.runtime = runtime;
        runtime.updatePhysicsConfig(characterModule.createDefaultProceduralUnitConfig().humanoid);
        const pendingPresentations = this.latestPresentations;
        this.latestPresentations = [];
        this.syncReadyPresentations(pendingPresentations);
      })
      .catch((error: unknown) => {
        if (this.disposed || generation !== this.generation) return;
        needs.forEach((need) => {
          need.failed = true;
        });
        console.error("[ProceduralArmyCharacterLayer] Failed to load the procedural unit runtime", error);
      })
      .finally(() => {
        this.runtimePromise = undefined;
        endPreparation();
      });
  }

  private reconcileActors(presentations: readonly ProceduralArmyCharacterPresentation[]): void {
    const runtime = this.runtime;
    if (!runtime) return;
    this.desiredEntityIds.clear();
    presentations.forEach(({ entityId }) => this.desiredEntityIds.add(entityId));
    this.actors.forEach((record, entityId) => {
      if (this.desiredEntityIds.has(entityId)) return;
      this.disposeActorRecord(record);
      this.actors.delete(entityId);
    });
    let remainingCreations = MAX_ACTOR_CREATIONS_PER_SYNC;
    presentations.forEach((presentation) => {
      const desiredActorFamily = resolveActorFamily(presentation);
      const record = this.actors.get(presentation.entityId);
      if (record && record.actorFamily !== desiredActorFamily) {
        this.disposeActorRecord(record);
        this.actors.delete(presentation.entityId);
      }
      const creating = !this.actors.has(presentation.entityId);
      if (creating && remainingCreations === 0) return;
      this.syncActor(presentation);
      // Only an actor made spends the budget: one whose skin is still loading, or failed, leaves it to the next.
      if (creating && this.actors.has(presentation.entityId)) remainingCreations -= 1;
    });
  }

  private syncReadyPresentations(presentations: readonly ProceduralArmyCharacterPresentation[]): void {
    this.reconcileActors(presentations);
    this.applyResolvedPresentationTransforms(presentations);
  }

  private applyResolvedPresentationTransforms(presentations: readonly ProceduralArmyCharacterPresentation[]): void {
    presentations.forEach((presentation) => {
      const record = this.actors.get(presentation.entityId);
      if (!record || record.actor.mode !== "animated") return;
      record.actor.object.position.copy(presentation.position);
      record.actor.object.rotation.copy(presentation.rotation ?? ZERO_ROTATION);
      if (!record.posed) {
        record.posed = true;
        record.actor.update?.(0);
      }
    });
  }

  private syncActor(presentation: ProceduralArmyCharacterPresentation): void {
    const runtime = this.runtime;
    const characterModule = this.characterModule;
    if (!runtime || !characterModule) return;

    const configSignature = resolveConfigSignature(presentation);
    let record = this.actors.get(presentation.entityId);
    if (!record || record.configSignature !== configSignature) {
      const config = resolveUnitConfig(characterModule, presentation);
      if (!this.prepareActorAssets(runtime, config, resolveAssetSignature(presentation))) return;
      if (!record) {
        record = this.createActorRecord(runtime, presentation, config, configSignature);
        this.actors.set(presentation.entityId, record);
      } else {
        runtime.updateActorConfig(record.actor, config);
        record.configSignature = configSignature;
        record.isT1Knight = isT1FootKnight(presentation);
        record.posed = false;
      }
    }

    configureHitTarget(record.hitTarget, presentation.category, presentation.isNaval);
    if (isT1FootKnight(presentation)) {
      record.hitTarget.position.set(0, 0.31, 0);
      record.hitTarget.scale.set(0.45, 0.64, 0.3);
    }
    if (record.actor.mode === "animated") {
      record.actor.object.scale.setScalar(
        isT1FootKnight(presentation)
          ? T1_KNIGHT_WORLD_SCALE
          : resolveWorldCharacterScale(presentation.category, presentation.isNaval),
      );
    }
  }

  private prepareActorAssets(runtime: ProceduralUnitRuntime, config: ProceduralUnitConfig, signature: string): boolean {
    const need = this.assetNeeds.get(signature);
    if (!need) return false;
    if (runtime.areAssetsReady(config)) {
      need.failed = false;
      return true;
    }
    if (!this.preparingAssets && !need.failed) {
      this.preparingAssets = runtime
        .prepareAssets(config)
        .catch((error) => {
          if (this.disposed) return;
          need.failed = true;
          console.error("[ProceduralArmyCharacterLayer] Failed to load visible unit assets", error);
        })
        .finally(() => {
          this.preparingAssets = undefined;
        });
    }
    return false;
  }

  private createActorRecord(
    runtime: ProceduralUnitRuntime,
    presentation: ProceduralArmyCharacterPresentation,
    config: ProceduralUnitConfig,
    configSignature: string,
  ): ProceduralArmyActorRecord {
    const actor = runtime.createActor(config);
    actor.object.name = `procedural-army-character:${presentation.entityId}`;
    const hitTarget = this.createHitTarget(presentation);
    actor.object.add(hitTarget);
    this.applyActorShadowState(actor);
    const record: ProceduralArmyActorRecord = {
      actor,
      actorFamily: resolveActorFamily(presentation),
      configSignature,
      isT1Knight: isT1FootKnight(presentation),
      hitTarget,
      posed: false,
    };
    this.attachActorObject(presentation.entityId, record);
    return record;
  }

  private attachActorObject(entityId: number, record: ProceduralArmyActorRecord): void {
    if (this.compilePipelines) {
      const generation = this.generation;
      void this.compilePipelines(record.actor.object, this.scene)
        .then(() => {
          if (this.disposed || generation !== this.generation || this.actors.get(entityId) !== record) return;
          this.scene.add(record.actor.object);
        })
        .catch((error) => {
          if (this.disposed || generation !== this.generation || this.actors.get(entityId) !== record) return;
          console.error("[ProceduralArmyCharacterLayer] Failed to precompile actor pipelines", error);
          this.scene.add(record.actor.object);
        });
      return;
    }
    this.scene.add(record.actor.object);
  }

  private clearActors(): void {
    this.actors.forEach((record) => this.disposeActorRecord(record));
    this.actors.clear();
  }

  private disposeActorRecord(record: ProceduralArmyActorRecord): void {
    record.actor.dispose();
  }

  private createHitTarget(presentation: ProceduralArmyCharacterPresentation): Mesh {
    const target = new Mesh(this.hitTargetGeometry, this.hitTargetMaterial);
    target.name = `procedural-army-hit-target:${presentation.entityId}`;
    target.visible = false;
    target.userData.entityId = presentation.entityId;
    configureHitTarget(target, presentation.category, presentation.isNaval);
    return target;
  }

  private applyActorShadowState(actor: ProceduralUnitActor): void {
    actor.object.traverse((object) => {
      if (object instanceof Mesh && object.userData.entityId === undefined) object.castShadow = this.shadowsEnabled;
    });
  }
}

const ZERO_ROTATION = new Euler();

function clonePresentation(presentation: ProceduralArmyCharacterPresentation): ProceduralArmyCharacterPresentation {
  return {
    ...presentation,
    position: presentation.position.clone(),
    rotation: presentation.rotation?.clone(),
  };
}

function resolveProjectileTargetRadius(kind: ProceduralUnitActor["kind"]): number {
  if (kind === "boat") return 1.35;
  if (kind === "paladin") return 0.62;
  if (kind === "horse") return 0.55;
  return 0.4;
}

function isArmoredKind(kind: ProceduralUnitActor["kind"]): boolean {
  return kind === "crossbowman" || kind === "knight" || kind === "paladin";
}

function configureHitTarget(target: Mesh, category: TroopType, isNaval: boolean): void {
  if (isNaval) {
    target.position.set(0, 0.88, 0);
    target.scale.set(1.35, 2.15, 3.3);
    return;
  }
  if (category === TroopType.Paladin) {
    target.position.set(0, 1.25, 0);
    target.scale.set(1.5, 2.3, 2.7);
    return;
  }
  target.position.set(0, 1.15, 0);
  target.scale.set(0.8, 1.9, 0.8);
}

function resolveUnitConfig(
  characterModule: CharacterModule,
  presentation: ProceduralArmyCharacterPresentation,
): ProceduralUnitConfig {
  const tier = resolveCharacterTier(presentation.tier);
  const kind = resolveUnitKind(presentation);
  return characterModule.applyProceduralUnitConfigPatch(characterModule.createDefaultProceduralUnitConfig(), {
    kind,
    boat: {
      broadsideCannons: tier + 2,
      motionMode: "idle",
      primaryColor: presentation.primaryColor,
      seed: resolveCharacterSeed(presentation.entityId),
      showSockets: false,
      showWake: false,
      speed: 0,
      tier,
    },
    dragon: {
      locomotionMode: "idle",
      primaryColor: presentation.primaryColor,
      renderDetail: "crowd",
      seed: resolveCharacterSeed(presentation.entityId),
      showBones: false,
      showSockets: false,
      speed: 0,
      tier,
    },
    horse: {
      gait: "idle",
      primaryColor: presentation.primaryColor,
      showBones: false,
      showHoofTargets: false,
      showSockets: false,
      speed: 0,
      tier,
    },
    humanoid: {
      animationMode: kind === "paladin" ? "mounted" : "idle",
      autoRotate: false,
      primaryColor: presentation.primaryColor,
      renderDetail: ARMY_RENDER_DETAIL,
      seed: resolveCharacterSeed(presentation.entityId),
      tier,
    },
    archer: {
      detailedEquipment: false,
      volleyCount: tier === 3 ? 7 : tier === 2 ? 5 : 3,
      volleySpreadDegrees: tier === 3 ? 1.2 : 0.8,
    },
    melee: { detailedEquipment: kind === "knight" && tier === 1, ...resolveMeleeLoadout(presentation.attachments) },
  });
}

const ARMY_RENDER_DETAIL = "crowd";

function resolveConfigSignature(presentation: ProceduralArmyCharacterPresentation): string {
  return [resolveAssetSignature(presentation), presentation.primaryColor].join(":");
}

function resolveAssetSignature(presentation: ProceduralArmyCharacterPresentation): string {
  return [
    presentation.category,
    presentation.tier,
    presentation.isNaval ? "naval" : "land",
    resolveAttachmentSignature(presentation.attachments),
  ].join(":");
}

function resolveMeleeLoadout(
  attachments: readonly CosmeticAttachmentTemplate[] | undefined,
): Partial<ProceduralUnitConfig["melee"]> {
  const ids = new Set(attachments?.map(({ id }) => id));
  const weaponId = ids.has("winter-knight-primary")
    ? "winter-broadaxe"
    : ids.has("winter-paladin-primary")
      ? "winter-rider-battleaxe"
      : undefined;
  const offhandId = ids.has("winter-knight-secondary")
    ? "winter-targe"
    : ids.has("winter-paladin-secondary")
      ? "winter-rider-shield"
      : ids.has("light-paladin-secondary")
        ? "light-cavalry-shield"
        : undefined;
  return { ...(weaponId && { weaponId }), ...(offhandId && { offhandId }) };
}

function resolveAttachmentSignature(attachments: readonly CosmeticAttachmentTemplate[] | undefined): string {
  return (
    attachments
      ?.map(({ id }) => id)
      .toSorted()
      .join(",") ?? ""
  );
}

function resolveCharacterTier(tier: TroopTier): 1 | 2 | 3 {
  if (tier === TroopTier.T3) return 3;
  if (tier === TroopTier.T2) return 2;
  return 1;
}

function resolveCharacterSeed(entityId: number): number {
  if (!Number.isFinite(entityId)) return 0;
  return Math.abs(Math.trunc(entityId)) % 2_147_483_647;
}

function resolveUnitKind(
  presentation: Pick<ProceduralArmyCharacterPresentation, "category" | "isNaval" | "tier">,
): "archer" | "boat" | "crossbowman" | "knight" | "paladin" {
  if (presentation.isNaval) return "boat";
  if (presentation.category === TroopType.Crossbowman) {
    return presentation.tier === TroopTier.T2 ? "crossbowman" : "archer";
  }
  if (presentation.category === TroopType.Paladin) return "paladin";
  return "knight";
}

function resolveActorFamily(
  presentation: Pick<ProceduralArmyCharacterPresentation, "category" | "isNaval" | "tier">,
): ProceduralArmyActorFamily {
  if (presentation.isNaval) return "boat";
  if (presentation.category !== TroopType.Paladin) return "foot";
  return presentation.tier === TroopTier.T3 ? "paladin-dragon" : "paladin-horse";
}

function resolveWorldCharacterScale(category: TroopType, isNaval: boolean): number {
  if (isNaval) return 0.92;
  return category === TroopType.Paladin ? WORLD_CHARACTER_SCALE * 0.74 : WORLD_CHARACTER_SCALE;
}

function isT1FootKnight(presentation: ProceduralArmyCharacterPresentation): boolean {
  return !presentation.isNaval && presentation.category === TroopType.Knight && presentation.tier === TroopTier.T1;
}
