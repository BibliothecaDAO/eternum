import type { BattleEventSystemUpdate } from "@bibliothecadao/eternum";
import { TroopTier, TroopType, type ID } from "@bibliothecadao/types";
import { Euler, Matrix4, Vector3, type PerspectiveCamera } from "three";
import type { MapControls } from "three/addons/controls/MapControls.js";

import {
  ProceduralArmyCharacterLayer,
  type ProceduralArmyCharacterPresentation,
} from "@/three/characters/procedural-army-character-layer";
import { CombatPresentationCoordinator } from "@/three/combat/combat-presentation-coordinator";
import type { LabStage, LabStageContext } from "@/three/debug/procedural-terrain-debug-renderer";
import { WorldmapCombatPresentation } from "@/three/scenes/worldmap-combat-presentation";
import { HyperstructureModel } from "@/three/structures/hyperstructure-model";
import { REALM_ASSETS } from "@/three/structures/realm-design";
import { SettlementModel } from "@/three/structures/settlement-model";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { PreparedTerrainPage } from "@/three/terrain/terrain-types";
import { gltfLoader } from "@/three/utils/utils";

import { cameraPosition, pathDuration, poseAt, poseFromCamera, type StudioPath, type StudioPose } from "./camera-path";
import { STUDIO_EXPLORE_STEPS, STUDIO_PLACES, createStudioTerrainRequest, type StudioPlace } from "./fixture";

/** The moments the studio plays on a call, each through the game's own presentation of it. */
export const STUDIO_TRIGGERS = ["rise", "attack", "defeat", "explore", "realm", "strike"] as const;
export type StudioTrigger = (typeof STUDIO_TRIGGERS)[number];

export interface StudioTroop {
  category: TroopType;
  tier: TroopTier;
}

const ATTACKER = 1;
const DEFENDER = 2;
const EXPLORER = 3;
const STEP_SECONDS = 1.6;
const HYPERSTRUCTURE_DESIGN = 17;

/**
 * The studio's world on the lab's land: a realm whose tier is set on a call, a Hyperstructure that rises on one, two
 * armies that fight through the world map's own combat bridge, and an explorer that walks into the fog and uncovers it
 * the way an explore does. It also runs the camera: free under the mouse, or along a path that plays its cues on time.
 */
export class StudioStage implements LabStage {
  readonly request = createStudioTerrainRequest(0);
  private context: LabStageContext | null = null;
  private pages: PreparedTerrainPage[] = [];
  private readonly realms: SettlementModel[] = [];
  private hyperstructure: HyperstructureModel | null = null;
  private armies: ProceduralArmyCharacterLayer | null = null;
  private combat: CombatPresentationCoordinator | null = null;
  private combatBridge: WorldmapCombatPresentation | null = null;
  private troops: Record<"attacker" | "defender", StudioTroop> = {
    attacker: { category: TroopType.Knight, tier: TroopTier.T2 },
    defender: { category: TroopType.Crossbowman, tier: TroopTier.T2 },
  };
  private realmLevel = 0;
  private hyperstructureProgress = 0;
  private explored = 0;
  private defenderDown = false;
  private walk: { from: Vector3; to: Vector3; elapsed: number } | null = null;
  private explorerAt = new Vector3();
  private explorerFacing = new Vector3();
  private take: {
    path: StudioPath;
    start: StudioPose;
    elapsed: number;
    fired: number;
    resolve: (live: boolean) => void;
  } | null = null;
  private disposed = false;

  constructor(private readonly onCue: (trigger: string, args: Record<string, unknown>) => void) {}

  async prepare(context: LabStageContext): Promise<void> {
    this.context = context;
    const { scene, terrain, compile } = context;
    this.pages = await Promise.all(
      Array.from({ length: STUDIO_EXPLORE_STEPS + 1 }, (_, revealed) =>
        terrain.preparePageAsync(createStudioTerrainRequest(revealed)),
      ),
    );
    for (const asset of REALM_ASSETS.filter((entry) => !entry.wonder).toSorted((a, b) => a.level - b.level)) {
      const realm = new SettlementModel(await gltfLoader.loadAsync(asset.path), 1, "realm");
      realm.setCount(1);
      realm.setMatrixAt(0, this.placementMatrix("realm", 0.6));
      realm.setRelationshipAt(0, "owned");
      realm.setOrderAt(0, 5);
      realm.setWonderEntityAt(0, 1001);
      await realm.prepare();
      await compile(realm.group, scene);
      scene.add(realm.group);
      this.realms.push(realm);
    }
    this.hyperstructure = new HyperstructureModel(1);
    await compile(this.hyperstructure.group, scene);
    scene.add(this.hyperstructure.group);
    this.armies = new ProceduralArmyCharacterLayer(scene);
    this.armies.setShadowsEnabled(true);
    this.combat = new CombatPresentationCoordinator(scene, {
      projectileHitQuery: {
        hasTarget: (entityId) => this.armies!.hasProjectileTarget(entityId),
        sweepSphere: (request) => this.armies!.sweepProjectile(request),
      },
    });
    this.combatBridge = new WorldmapCombatPresentation({
      armyManager: this.armyRoster(this.armies),
      getCombatPresentation: () => this.combat ?? undefined,
      getArmyDisplayPosition: (entityId) => this.armyHex(entityId),
      getStructureHexPosition: () => undefined,
    });
    this.combatBridge.bind();
    this.reset();
    await this.waitForArmies();
  }

  /** The world as it stood before any moment played: a foundation, a settlement, the fog closed, both armies up. */
  reset(): void {
    this.stop();
    this.setRealmLevel(0);
    this.resetHyperstructure();
    this.explored = 0;
    this.walk = null;
    this.explorerAt.copy(this.placeAt("exploreStart"));
    this.explorerFacing.copy(this.hexPosition(STUDIO_PLACES.exploreRoute[0]));
    this.context?.terrain.cancelShroudReveals();
    this.context?.terrain.present([this.pages[0]]);
    this.defenderDown = false;
    this.armies?.reset(ATTACKER);
  }

  trigger(name: Exclude<StudioTrigger, "strike">, args: Record<string, unknown> = {}): void {
    if (name === "rise") this.rise(Number(args.progress ?? 100));
    else if (name === "attack") this.attack();
    else if (name === "defeat") this.defeat();
    else if (name === "explore") this.explore();
    else this.setRealmLevel(Number(args.level ?? this.realmLevel + 1));
  }

  setTroops(troops: Partial<Record<"attacker" | "defender", StudioTroop>>): void {
    this.troops = { ...this.troops, ...troops };
  }

  /** Where each subject stands, for paths framed around it. */
  places(): Record<StudioPlace, [number, number, number]> {
    const names = ["realm", "hyperstructure", "attacker", "defender", "exploreStart"] as const;
    return Object.fromEntries(names.map((name) => [name, this.placeAt(name).toArray()])) as Record<
      StudioPlace,
      [number, number, number]
    >;
  }

  pose(): StudioPose {
    const { camera, controls } = this.requireContext();
    return poseFromCamera(camera.position.toArray(), controls.target.toArray(), camera.fov);
  }

  setPose(pose: StudioPose): void {
    const { camera, controls } = this.requireContext();
    applyPose(camera, controls, pose);
  }

  /**
   * Plays a path from the current pose. Settles when it ends, is stopped or replaced: true while the stage is still up,
   * false when the stage was taken down under it (the page left, or another world mounted).
   */
  play(path: StudioPath): Promise<boolean> {
    this.stop();
    const { controls } = this.requireContext();
    controls.enabled = false;
    return new Promise((resolve) => {
      this.take = { path, start: this.pose(), elapsed: 0, fired: 0, resolve };
      this.advanceTake(0);
    });
  }

  /** Ends a playing path where it stands and gives the camera back to the mouse. */
  stop(): void {
    const take = this.take;
    if (!take) return;
    this.take = null;
    this.requireContext().controls.enabled = true;
    take.resolve(!this.disposed);
  }

  status() {
    return {
      playing: this.take !== null,
      takeSeconds: this.take?.elapsed ?? 0,
      realmLevel: this.realmLevel,
      hyperstructureProgress: this.hyperstructureProgress,
      explored: this.explored,
      walking: this.walk !== null,
      defenderDown: this.defenderDown,
      troops: this.troops,
    };
  }

  /**
   * One clock for the take and the world: a path's cues and the moments they start keep their order at any world
   * speed, and a slowed world films as slow motion, camera and all.
   */
  update(delta: number): void {
    this.advanceTake(delta);
    this.advanceWalk(delta);
    this.armies?.sync(this.presentations(), delta);
    this.combat?.update(delta);
    this.hyperstructure?.updateAnimations(delta);
    for (const realm of this.realms) if (realm.group.visible) realm.updateAnimations(delta);
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.combatBridge?.dispose();
    this.combat?.dispose();
    this.armies?.dispose();
    for (const model of [...this.realms, this.hyperstructure]) {
      model?.group.removeFromParent();
      model?.dispose();
    }
    this.context = null;
  }

  private rise(progress: number): void {
    this.hyperstructureProgress = Math.max(0, Math.min(100, progress));
    if (this.hyperstructureProgress === 0) {
      this.resetHyperstructure();
      return;
    }
    this.hyperstructure?.setConstructionAt(0, {
      entityId: HYPERSTRUCTURE_DESIGN,
      progress: this.hyperstructureProgress,
      completed: this.hyperstructureProgress === 100,
    });
  }

  /** A fresh foundation: the model forgets the tower it showed, so the next rise animates from the ground. */
  private resetHyperstructure(): void {
    const model = this.hyperstructure;
    if (!model) return;
    this.hyperstructureProgress = 0;
    model.setCount(0);
    model.setCount(1);
    model.setMatrixAt(0, this.placementMatrix("hyperstructure", 0.4));
    model.setConstructionAt(0, { entityId: HYPERSTRUCTURE_DESIGN, progress: 0, completed: false });
  }

  /** The attacker strikes the defender as a confirmed battle replays on the world map. */
  private attack(): void {
    if (this.defenderDown) return;
    const battle: BattleEventSystemUpdate = {
      entityId: ATTACKER,
      battleData: {
        attackerId: ATTACKER,
        defenderId: DEFENDER,
        attackerOwner: 1,
        defenderOwner: 2,
        winnerId: ATTACKER,
        maxReward: [],
        timestamp: 0,
      },
    };
    this.combatBridge?.replayIndexed(battle);
  }

  private defeat(): void {
    if (this.defenderDown) return;
    this.defenderDown = this.armies?.playDefeat(DEFENDER) ?? false;
  }

  /** The explorer steps onto the next hidden hex of its route, which is uncovered from the hex it left. */
  private explore(): void {
    const { terrain } = this.requireContext();
    if (this.walk || this.explored >= STUDIO_EXPLORE_STEPS) return;
    const from = this.explored === 0 ? STUDIO_PLACES.exploreStart : STUDIO_PLACES.exploreRoute[this.explored - 1];
    const to = STUDIO_PLACES.exploreRoute[this.explored];
    this.explored += 1;
    terrain.queueShroudReveal(to.col, to.row, from);
    terrain.present([this.pages[this.explored]]);
    this.walk = { from: this.explorerAt.clone(), to: this.hexPosition(to), elapsed: 0 };
    this.explorerFacing.copy(this.walk.to);
  }

  private setRealmLevel(level: number): void {
    this.realmLevel = Math.max(0, Math.min(this.realms.length - 1, level));
    this.realms.forEach((realm, index) => (realm.group.visible = index === this.realmLevel));
  }

  private advanceTake(delta: number): void {
    const take = this.take;
    if (!take) return;
    take.elapsed += delta;
    const cues = (take.path.cues ?? []).toSorted((a, b) => a.at - b.at);
    while (take.fired < cues.length && cues[take.fired].at <= take.elapsed) {
      const cue = cues[take.fired++];
      this.onCue(cue.trigger, cue.args ?? {});
    }
    const { camera, controls } = this.requireContext();
    applyPose(camera, controls, poseAt(take.path, take.elapsed, take.start));
    if (take.elapsed >= pathDuration(take.path)) this.stop();
  }

  private advanceWalk(delta: number): void {
    const walk = this.walk;
    if (!walk) return;
    walk.elapsed += delta;
    const progress = Math.min(1, walk.elapsed / STEP_SECONDS);
    this.explorerAt.lerpVectors(walk.from, walk.to, progress);
    this.explorerAt.y = this.groundHeight(this.explorerAt.x, this.explorerAt.z);
    if (progress === 1) this.walk = null;
  }

  private presentations(): ProceduralArmyCharacterPresentation[] {
    const attacker = this.placeAt("attacker");
    const defender = this.placeAt("defender");
    return [
      army(ATTACKER, this.troops.attacker, attacker, defender, "#e1b955", false),
      ...(this.defenderDown ? [] : [army(DEFENDER, this.troops.defender, defender, attacker, "#a33b39", false)]),
      army(
        EXPLORER,
        { category: TroopType.Knight, tier: TroopTier.T1 },
        this.explorerAt,
        this.explorerFacing,
        "#e1b955",
        this.walk !== null,
      ),
    ];
  }

  /** The armies as the combat bridge reads the world map's army manager. */
  private armyRoster(layer: ProceduralArmyCharacterLayer) {
    return {
      getArmy: (entityId: ID) =>
        entityId === ATTACKER ? this.troops.attacker : entityId === DEFENDER ? this.troops.defender : undefined,
      playProceduralAttack: (entityId: ID, target: Readonly<Vector3>, targetId?: ID) =>
        layer.playAttack(Number(entityId), target, targetId === undefined ? undefined : Number(targetId)),
      presentProceduralProjectileImpact: layer.presentProjectileImpact.bind(layer),
      onProceduralMeleeContact: layer.onMeleeContact.bind(layer),
      onProceduralRangedRelease: layer.onRangedRelease.bind(layer),
    };
  }

  private armyHex(entityId: ID) {
    if (entityId === ATTACKER) return STUDIO_PLACES.attacker;
    if (entityId === DEFENDER) return STUDIO_PLACES.defender;
    return undefined;
  }

  private async waitForArmies(): Promise<void> {
    const started = performance.now();
    while (this.armies && this.armies.getStats().actorCount < 3) {
      if (this.armies.getStats().loadState === "failed" || performance.now() - started > 20_000) {
        throw new Error("The studio's armies did not load");
      }
      this.armies.sync(this.presentations(), 0);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }

  private placementMatrix(place: StudioPlace, yaw: number): Matrix4 {
    const position = this.placeAt(place);
    return new Matrix4().makeRotationY(yaw).setPosition(position.x, position.y + 0.025, position.z);
  }

  private placeAt(place: StudioPlace): Vector3 {
    return this.hexPosition(STUDIO_PLACES[place]);
  }

  private hexPosition(hex: { col: number; row: number }): Vector3 {
    const { x, z } = terrainHexToWorld(hex.col, hex.row);
    return new Vector3(x, this.groundHeight(x, z), z);
  }

  private groundHeight(x: number, z: number): number {
    return this.context?.terrain.sampleSurface(x, z).height ?? 0;
  }

  private requireContext(): LabStageContext {
    if (!this.context) throw new Error("The studio stage is not prepared");
    return this.context;
  }
}

function army(
  entityId: number,
  troop: StudioTroop,
  position: Vector3,
  facing: Vector3,
  primaryColor: string,
  isMoving: boolean,
): ProceduralArmyCharacterPresentation {
  return {
    entityId,
    category: troop.category,
    tier: troop.tier,
    isNaval: false,
    isMoving,
    position: position.clone(),
    rotation: new Euler(0, Math.atan2(facing.x - position.x, facing.z - position.z), 0),
    primaryColor,
  };
}

function applyPose(camera: PerspectiveCamera, controls: MapControls, pose: StudioPose): void {
  if (camera.fov !== pose.fov) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
  camera.position.set(...cameraPosition(pose));
  controls.target.set(...pose.target);
  camera.lookAt(controls.target);
}
