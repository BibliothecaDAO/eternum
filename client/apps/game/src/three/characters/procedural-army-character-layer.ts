import type {
  ProceduralMeleeContactEvent,
  ProceduralRangedReleaseEvent,
  ProceduralUnitActor,
  ProceduralUnitConfig,
  ProceduralUnitRuntime,
} from "@/three/characters";
import type { CosmeticAttachmentTemplate } from "@/three/cosmetics/types";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import {
  BoxGeometry,
  Euler,
  type Intersection,
  Mesh,
  MeshBasicMaterial,
  type Raycaster,
  type Scene,
  type Vector3,
} from "three";

type CharacterModule = typeof import("@/three/characters");

export interface ProceduralArmyCharacterPresentation {
  category: TroopType;
  attachments?: readonly CosmeticAttachmentTemplate[];
  entityId: number;
  isMoving: boolean;
  position: Vector3;
  primaryColor: string;
  rotation?: Euler;
  tier: TroopTier;
}

interface ProceduralArmyActorRecord {
  actor: ProceduralUnitActor;
  configSignature: string;
  hitTarget: Mesh;
  unsubscribeActionEvents: () => void;
}

interface DefeatedProceduralArmyActor {
  actor: ProceduralUnitActor;
  remainingSeconds: number;
}

export interface ProceduralArmyCharacterLayerStats {
  actorCount: number;
  defeatedActorCount: number;
  hitTargetCount: number;
  loadState: "failed" | "idle" | "loading" | "ready";
  ragdollCount: number;
}

export interface ProceduralArmyRaycastHit {
  distance: number;
  entityId: number;
}

const WORLD_CHARACTER_SCALE = 0.72;
const MAX_ACTOR_CREATIONS_PER_SYNC = 4;
const MAX_DEFEATED_ACTORS = 12;
const DEFEAT_LIFETIME_SECONDS = 2.6;

/**
 * Production character presentation for visible land armies. ArmyModel keeps
 * authoritative movement and slots; this layer mirrors those transforms into
 * articulated actors after its shared runtime is ready.
 */
export class ProceduralArmyCharacterLayer {
  private readonly actors = new Map<number, ProceduralArmyActorRecord>();
  private readonly defeatedActors: DefeatedProceduralArmyActor[] = [];
  private readonly meleeContactListeners = new Set<(entityId: number, event: ProceduralMeleeContactEvent) => void>();
  private readonly rangedReleaseListeners = new Set<(entityId: number, event: ProceduralRangedReleaseEvent) => void>();
  private readonly desiredEntityIds = new Set<number>();
  private readonly hitTargetGeometry = new BoxGeometry(1, 1, 1);
  private readonly hitTargetMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  private readonly raycastHits: Intersection[] = [];
  private characterModule?: CharacterModule;
  private runtime?: ProceduralUnitRuntime;
  private runtimePromise?: Promise<void>;
  private latestPresentations: readonly ProceduralArmyCharacterPresentation[] = [];
  private loadError?: unknown;
  private generation = 0;
  private shadowsEnabled = false;
  private disposed = false;

  public constructor(private readonly scene: Scene) {}

  public sync(presentations: readonly ProceduralArmyCharacterPresentation[], deltaSeconds: number): void {
    if (this.disposed) return;

    if (!this.runtime || !this.characterModule) {
      if (presentations.length === 0) {
        this.latestPresentations = [];
        return;
      }
      if (this.loadError) return;
      this.latestPresentations = presentations.map(clonePresentation);
      this.startRuntimeLoad();
      return;
    }

    this.latestPresentations = [];
    this.reconcileActors(presentations);
    this.updateRuntime(deltaSeconds);
  }

  public async startRagdoll(entityId: number): Promise<void> {
    const actor = await this.requireActor(entityId);
    await actor?.startRagdoll();
  }

  public async applyImpulse(entityId: number): Promise<void> {
    const actor = await this.requireActor(entityId);
    await actor?.applyImpulse();
  }

  public playAttack(entityId: number, targetWorld: Readonly<Vector3>): boolean {
    return this.actors.get(entityId)?.actor.attack(targetWorld) ?? false;
  }

  public onMeleeContact(listener: (entityId: number, event: ProceduralMeleeContactEvent) => void): () => void {
    this.meleeContactListeners.add(listener);
    return () => this.meleeContactListeners.delete(listener);
  }

  public onRangedRelease(listener: (entityId: number, event: ProceduralRangedReleaseEvent) => void): () => void {
    this.rangedReleaseListeners.add(listener);
    return () => this.rangedReleaseListeners.delete(listener);
  }

  /** Detach a defeated actor from live army state and let Jolt own its final pose briefly. */
  public playDefeat(entityId: number): boolean {
    const record = this.actors.get(entityId);
    if (!record) return false;

    this.actors.delete(entityId);
    record.unsubscribeActionEvents();
    record.hitTarget.removeFromParent();
    this.makeRoomForDefeatedActor();
    this.defeatedActors.push({ actor: record.actor, remainingSeconds: DEFEAT_LIFETIME_SECONDS });
    void record.actor.applyImpulse().catch((error: unknown) => {
      console.warn(`[ProceduralArmyCharacterLayer] Failed to ragdoll defeated army ${entityId}`, error);
    });
    return true;
  }

  public reset(entityId: number): void {
    this.actors.get(entityId)?.actor.reset();
  }

  public hasActor(entityId: number): boolean {
    return this.actors.has(entityId);
  }

  public getStats(): ProceduralArmyCharacterLayerStats {
    return {
      actorCount: this.actors.size,
      defeatedActorCount: this.defeatedActors.length,
      hitTargetCount: this.actors.size,
      loadState: this.loadError ? "failed" : this.runtime ? "ready" : this.runtimePromise ? "loading" : "idle",
      ragdollCount:
        [...this.actors.values()].filter(({ actor }) => actor.mode === "ragdoll").length +
        this.defeatedActors.filter(({ actor }) => actor.mode === "ragdoll").length,
    };
  }

  public raycastNearest(raycaster: Raycaster): ProceduralArmyRaycastHit | undefined {
    this.raycastHits.length = 0;
    this.actors.forEach(({ hitTarget }) => {
      hitTarget.updateWorldMatrix(true, false);
      hitTarget.raycast(raycaster, this.raycastHits);
    });
    let nearest: Intersection | undefined;
    this.raycastHits.forEach((hit) => {
      if (!nearest || hit.distance < nearest.distance) nearest = hit;
    });
    const entityId = nearest?.object.userData.entityId;
    return typeof entityId === "number" && nearest ? { distance: nearest.distance, entityId } : undefined;
  }

  public setShadowsEnabled(enabled: boolean): void {
    if (this.shadowsEnabled === enabled) return;
    this.shadowsEnabled = enabled;
    this.actors.forEach(({ actor }) => this.applyActorShadowState(actor));
    this.defeatedActors.forEach(({ actor }) => this.applyActorShadowState(actor));
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.latestPresentations = [];
    this.clearActors();
    this.clearDefeatedActors();
    this.meleeContactListeners.clear();
    this.rangedReleaseListeners.clear();
    this.runtime?.dispose();
    this.runtime = undefined;
    this.characterModule = undefined;
    this.hitTargetGeometry.dispose();
    this.hitTargetMaterial.dispose();
  }

  private startRuntimeLoad(): void {
    if (this.runtimePromise || this.loadError) return;
    const generation = this.generation;
    this.runtimePromise = import("@/three/characters")
      .then(async (characterModule) => {
        const runtime = await characterModule.ProceduralUnitRuntime.create();
        if (this.disposed || generation !== this.generation) {
          runtime.dispose();
          return;
        }
        this.characterModule = characterModule;
        this.runtime = runtime;
        this.reconcileActors(this.latestPresentations);
        this.updateRuntime(0);
      })
      .catch((error: unknown) => {
        this.loadError = error;
        console.error("[ProceduralArmyCharacterLayer] Failed to load the articulated character runtime", error);
      })
      .finally(() => {
        this.runtimePromise = undefined;
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
      const desiredKind = resolveUnitKind(presentation.category, presentation.tier);
      const record = this.actors.get(presentation.entityId);
      if (record && requiresActorRecreation(record.actor.kind, desiredKind)) {
        this.disposeActorRecord(record);
        this.actors.delete(presentation.entityId);
      }
      if (!this.actors.has(presentation.entityId)) {
        if (remainingCreations === 0) return;
        remainingCreations -= 1;
      }
      this.syncActor(presentation);
    });
  }

  private updateRuntime(deltaSeconds: number): void {
    this.runtime?.update(deltaSeconds);
    const elapsed = Number.isFinite(deltaSeconds) ? Math.min(Math.max(0, deltaSeconds), 1) : 0;
    for (let index = this.defeatedActors.length - 1; index >= 0; index -= 1) {
      const defeated = this.defeatedActors[index];
      defeated.remainingSeconds -= elapsed;
      if (defeated.remainingSeconds > 0) continue;
      defeated.actor.dispose();
      this.defeatedActors.splice(index, 1);
    }
  }

  private syncActor(presentation: ProceduralArmyCharacterPresentation): void {
    const runtime = this.runtime;
    const characterModule = this.characterModule;
    if (!runtime || !characterModule) return;

    const configSignature = resolveConfigSignature(presentation);
    let record = this.actors.get(presentation.entityId);
    if (!record) {
      const actor = runtime.createActor(resolveUnitConfig(characterModule, presentation));
      actor.object.name = `procedural-army-character:${presentation.entityId}`;
      const hitTarget = this.createHitTarget(presentation);
      actor.object.add(hitTarget);
      const unsubscribeRanged = actor.onRangedRelease((event) => {
        this.rangedReleaseListeners.forEach((listener) => listener(presentation.entityId, event));
      });
      const unsubscribeMelee = actor.onMeleeContact((event) => {
        this.meleeContactListeners.forEach((listener) => listener(presentation.entityId, event));
      });
      this.applyActorShadowState(actor);
      this.scene.add(actor.object);
      record = {
        actor,
        configSignature,
        hitTarget,
        unsubscribeActionEvents: () => {
          unsubscribeRanged();
          unsubscribeMelee();
        },
      };
      this.actors.set(presentation.entityId, record);
    } else if (record.configSignature !== configSignature) {
      runtime.updateActorConfig(record.actor, resolveUnitConfig(characterModule, presentation));
      record.configSignature = configSignature;
    }

    configureHitTarget(record.hitTarget, presentation.category);
    if (record.actor.mode === "animated") {
      record.actor.object.scale.setScalar(resolveWorldCharacterScale(presentation.category));
      record.actor.object.position.copy(presentation.position);
      record.actor.object.rotation.copy(presentation.rotation ?? ZERO_ROTATION);
    }
  }

  private async requireActor(entityId: number): Promise<ProceduralUnitActor | undefined> {
    if (this.disposed || this.loadError) return undefined;
    if (!this.runtime) {
      this.startRuntimeLoad();
      await this.runtimePromise;
    }
    return this.actors.get(entityId)?.actor;
  }

  private clearActors(): void {
    this.actors.forEach((record) => this.disposeActorRecord(record));
    this.actors.clear();
  }

  private disposeActorRecord(record: ProceduralArmyActorRecord): void {
    record.unsubscribeActionEvents();
    record.actor.dispose();
  }

  private clearDefeatedActors(): void {
    this.defeatedActors.forEach(({ actor }) => actor.dispose());
    this.defeatedActors.length = 0;
  }

  private makeRoomForDefeatedActor(): void {
    if (this.defeatedActors.length < MAX_DEFEATED_ACTORS) return;
    this.defeatedActors.shift()?.actor.dispose();
  }

  private createHitTarget(presentation: ProceduralArmyCharacterPresentation): Mesh {
    const target = new Mesh(this.hitTargetGeometry, this.hitTargetMaterial);
    target.name = `procedural-army-hit-target:${presentation.entityId}`;
    target.visible = false;
    target.userData.entityId = presentation.entityId;
    configureHitTarget(target, presentation.category);
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

function configureHitTarget(target: Mesh, category: TroopType): void {
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
  const kind = resolveUnitKind(presentation.category, presentation.tier);
  return characterModule.applyProceduralUnitConfigPatch(characterModule.createDefaultProceduralUnitConfig(), {
    kind,
    horse: {
      gait: presentation.isMoving ? "walk" : "idle",
      primaryColor: presentation.primaryColor,
      showBones: false,
      showHoofTargets: false,
      showSockets: false,
      speed: presentation.isMoving ? 1.4 : 0,
      tier,
    },
    humanoid: {
      animationMode: kind === "paladin" ? "mounted" : presentation.isMoving ? "walk" : "idle",
      autoRotate: false,
      primaryColor: presentation.primaryColor,
      seed: resolveCharacterSeed(presentation.entityId),
      tier,
    },
    melee: resolveMeleeLoadout(presentation.attachments),
  });
}

function resolveConfigSignature(presentation: ProceduralArmyCharacterPresentation): string {
  return [
    presentation.category,
    presentation.tier,
    presentation.primaryColor,
    presentation.isMoving ? "moving" : "idle",
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

function resolveUnitKind(category: TroopType, tier: TroopTier): "archer" | "crossbowman" | "knight" | "paladin" {
  if (category === TroopType.Crossbowman) return tier === TroopTier.T2 ? "crossbowman" : "archer";
  if (category === TroopType.Paladin) return "paladin";
  return "knight";
}

function requiresActorRecreation(
  currentKind: ProceduralUnitActor["kind"],
  desiredKind: ReturnType<typeof resolveUnitKind>,
): boolean {
  return (currentKind === "paladin") !== (desiredKind === "paladin");
}

function resolveWorldCharacterScale(category: TroopType): number {
  return category === TroopType.Paladin ? WORLD_CHARACTER_SCALE * 0.74 : WORLD_CHARACTER_SCALE;
}
