import type { ArrowImpactEvent } from "@/three/projectiles/arrow-projectile-system";
import { TroopTier, TroopType, type ID } from "@bibliothecadao/types";
import { Color, Euler, Vector3, type Scene } from "three";

import {
  ProceduralArmyCharacterLayer,
  type ProceduralArmyCharacterPresentation,
} from "@/three/characters/procedural-army-character-layer";
import {
  reconcileProceduralArmyRepresentations,
  shouldPresentArmyProcedurally,
} from "@/three/characters/procedural-army-representation";
import { ARMY_MODEL_SCALE } from "@/three/constants/army-constants";
import { ArmyModel } from "@/three/managers/army-model";
import { FXManager } from "@/three/managers/fx-manager";
import type { PipelineCompiler } from "@/three/pipeline-compiler";
import { placePositionOnTerrain, type TerrainSurface } from "@/three/terrain/terrain-surface";
import { getWorldPositionForHexCoordsInto } from "@/three/utils/utils";

import { studioBiomeAt } from "./fixture";

type Hex = { col: number; row: number };

export interface StudioTroop {
  category: TroopType;
  tier: TroopTier;
}

interface StudioArmy extends StudioTroop {
  entityId: number;
  hex: Hex;
  /** Which way it faces, radians around the vertical. */
  yaw: number;
  color: string;
}

const SCALE = new Vector3().setScalar(ARMY_MODEL_SCALE);
const EVERY_TROOP = Object.values(TroopType).flatMap((category) =>
  Object.values(TroopTier).map((tier) => ({ category, tier })),
);

/**
 * The studio's armies, drawn the way the world map's army manager draws them: each troop through the shipped army
 * model and its troop-and-tier table, at the map's scale and on its ground, and handed to the articulated character
 * only where the map hands it (`shouldPresentArmyProcedurally`: the T1 knight). A march is the model's own movement,
 * a fall the map's (the knight's ragdoll, else the model removed under the skull).
 */
export class StudioArmies {
  private readonly model: ArmyModel;
  private readonly characters: ProceduralArmyCharacterLayer;
  private readonly fx: FXManager;
  private readonly armies = new Map<number, StudioArmy>();
  private readonly articulated = new Set<number>();
  private readonly ready = new Set<number>();
  private readonly position = new Vector3();

  constructor(
    scene: Scene,
    private readonly ground: TerrainSurface,
    compile: PipelineCompiler,
  ) {
    this.model = new ArmyModel(scene, (col, row) => studioBiomeAt({ col, row }), undefined, compile);
    this.model.setShadowsEnabled(true);
    this.characters = new ProceduralArmyCharacterLayer(scene);
    this.characters.setShadowsEnabled(true);
    this.fx = new FXManager(scene, 1);
  }

  /** Loads every troop's model once, so a troop changed mid-session swaps at once. */
  async prepare(): Promise<void> {
    const types = EVERY_TROOP.map(({ category, tier }) =>
      this.model.getModelTypeForEntity(0, category, tier, studioBiomeAt({ col: 0, row: 0 })),
    );
    await this.model.preloadModels(new Set(types));
  }

  /** Puts an army on its hex, as the map renders an army into view; one already there is redrawn as given. */
  place(army: StudioArmy): void {
    this.withdraw(army.entityId);
    const modelType = this.model.getModelTypeForEntity(
      army.entityId,
      army.category,
      army.tier,
      studioBiomeAt(army.hex),
    );
    const slot = this.model.allocateInstanceSlot(army.entityId);
    this.model.assignModelToEntity(army.entityId, modelType);
    this.model.updateInstance(
      army.entityId,
      slot,
      this.hexPosition(army.hex),
      SCALE,
      new Euler(0, army.yaw, 0),
      new Color(army.color),
    );
    this.armies.set(army.entityId, army);
    this.syncDrawnArmies();
  }

  /** Marches an army from where its model stands to the hex, as the map plays a move; a walk still playing walks on. */
  march(entityId: number, to: Hex): void {
    const army = this.armies.get(entityId);
    const from = this.model.getEntityWorldPosition(entityId)?.clone();
    const slot = this.model.getEntitySlot(entityId);
    if (!army || !from || slot === undefined) return;
    this.model.startMovement(entityId, [from, this.hexPosition(to).clone()], slot, army.category, army.tier);
    army.hex = to;
  }

  isMarching(entityId: number): boolean {
    return this.model.isEntityMoving(entityId);
  }

  /** The army falls as a defeated army leaves the map. False when it is not on the set. */
  defeat(entityId: number): boolean {
    const army = this.armies.get(entityId);
    if (!army) return false;
    if (this.characters.playDefeat(entityId)) this.articulated.delete(entityId);
    const at = this.hexPosition(army.hex);
    this.withdraw(entityId);
    void this.fx.playFxAtCoords("skull", at.x, at.y + 2, at.z, 1, "Defeated!").promise.catch(() => {});
    return true;
  }

  /** What the world map's combat bridge asks of the army manager, answered for these armies. */
  roster() {
    return {
      getArmy: (entityId: ID) => this.armies.get(Number(entityId)),
      playProceduralAttack: (entityId: ID, target: Readonly<Vector3>, targetId?: ID) =>
        this.characters.playAttack(Number(entityId), target, targetId === undefined ? undefined : Number(targetId)),
      presentProceduralProjectileImpact: (event: ArrowImpactEvent) => this.characters.presentProjectileImpact(event),
      onProceduralMeleeContact: this.characters.onMeleeContact.bind(this.characters),
      onProceduralRangedRelease: this.characters.onRangedRelease.bind(this.characters),
    };
  }

  /** What the combat's arrows ask of the armies they fly at. */
  projectileTargets() {
    return {
      hasTarget: (entityId: number) => this.characters.hasProjectileTarget(entityId),
      sweepSphere: (request: Parameters<ProceduralArmyCharacterLayer["sweepProjectile"]>[0]) =>
        this.characters.sweepProjectile(request),
    };
  }

  /** Resolves once every T1 knight on the set has its articulated figure, so no take opens on its stand-in. */
  async whenReady(): Promise<void> {
    const started = performance.now();
    while ([...this.armies.keys()].some((id) => this.isArticulated(id) && !this.characters.hasActor(id))) {
      if (this.characters.getStats().loadState === "failed" || performance.now() - started > 20_000) {
        throw new Error("The studio's armies did not load");
      }
      this.update(0);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }

  update(delta: number): void {
    this.model.updateMovements(delta);
    this.model.updateAnimations(delta);
    this.characters.sync(this.articulatedPresentations(), delta);
    this.ready.clear();
    for (const id of this.armies.keys()) if (this.characters.hasActor(id)) this.ready.add(id);
    reconcileProceduralArmyRepresentations({
      activeEntityIds: this.articulated,
      readyEntityIds: this.ready,
      setLegacyAttachmentsVisible: () => {},
      setLegacyModelVisible: (entityId, visible) => this.model.setEntityRepresentationVisible(entityId, visible),
    });
    this.model.flushInstanceUploads();
    // A marching army moves its bounds; the map refreshes them while armies walk.
    if ([...this.armies.keys()].some((id) => this.model.isEntityMoving(id))) {
      this.model.requestBoundsUpdate();
      this.model.applyPendingBounds();
    }
    this.fx.update(delta);
  }

  dispose(): void {
    this.characters.dispose();
    this.model.dispose();
    this.fx.destroy();
  }

  private articulatedPresentations(): ProceduralArmyCharacterPresentation[] {
    return [...this.armies.values()].flatMap((army) => {
      const instance = this.model.getInstanceData(army.entityId);
      if (!instance || !this.isArticulated(army.entityId)) return [];
      return [
        {
          entityId: army.entityId,
          category: army.category,
          tier: army.tier,
          isNaval: false,
          isMoving: this.model.isEntityMoving(army.entityId),
          position: instance.position,
          rotation: instance.rotation,
          primaryColor: army.color,
        },
      ];
    });
  }

  private isArticulated(entityId: number): boolean {
    return shouldPresentArmyProcedurally(this.model.getAssignedModelType(entityId));
  }

  /** Takes an army off the set, as the map drops one that leaves view. */
  withdraw(entityId: number): void {
    if (!this.armies.delete(entityId)) return;
    // Released, the model forgets it hid this army for its articulated figure; so must the handoff, or a knight put
    // back would be drawn twice.
    this.articulated.delete(entityId);
    this.model.releaseEntity(entityId);
    this.syncDrawnArmies();
  }

  /**
   * The drawn slots, their upload and their bounds, as the map refreshes its army buffers: an army model's meshes are
   * culled by those bounds, so one first drawn after load would stay culled without them.
   */
  private syncDrawnArmies(): void {
    this.model.setVisibleSlots(this.slots());
    this.model.flushInstanceUploads();
    this.model.requestBoundsUpdate();
    this.model.applyPendingBounds();
  }

  private slots(): number[] {
    return [...this.armies.keys()].flatMap((id) => this.model.getEntitySlot(id) ?? []);
  }

  private hexPosition(hex: Hex): Vector3 {
    getWorldPositionForHexCoordsInto(hex.col, hex.row, this.position);
    return placePositionOnTerrain(this.position, this.ground, 0.03);
  }
}
