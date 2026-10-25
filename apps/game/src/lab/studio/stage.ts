import type { BattleEventSystemUpdate } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { TroopTier, TroopType, type ID } from "@bibliothecadao/types";
import { Matrix4, Vector3, type PerspectiveCamera } from "three";
import type { MapControls } from "three/addons/controls/MapControls.js";

import { CombatPresentationCoordinator } from "@/three/combat/combat-presentation-coordinator";
import type { LabStage, LabStageContext } from "@/three/debug/procedural-terrain-debug-renderer";
import { WorldmapCombatPresentation } from "@/three/scenes/worldmap-combat-presentation";
import { HYPERSTRUCTURE_MODEL_PATH } from "@/three/structures/hyperstructure-design";
import { HyperstructureModel } from "@/three/structures/hyperstructure-model";
import { resolveStructureRotationY } from "@/three/structures/structure-orientation";
import { REALM_ASSETS } from "@/three/structures/realm-design";
import { SettlementModel } from "@/three/structures/settlement-model";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { PreparedTerrainPage } from "@/three/terrain/terrain-types";
import { gltfLoader } from "@/three/utils/utils";

import { installLabGameRules } from "../lab-game-rules";
import { StudioArmies, type StudioTroop } from "./armies";
import { cameraPosition, pathDuration, poseAt, poseFromCamera, type StudioPath, type StudioPose } from "./camera-path";
import { STUDIO_EXPLORE_STEPS, STUDIO_PLACES, createStudioTerrainRequest, type StudioPlace } from "./fixture";

/** The moments the studio plays on a call, each through the game's own presentation of it. */
export const STUDIO_TRIGGERS = ["rise", "attack", "defeat", "explore", "realm", "strike"] as const;
export type StudioTrigger = (typeof STUDIO_TRIGGERS)[number];

/** What the set can hold. A take puts on it only the subjects it films; between takes all of them stand. */
const STUDIO_SUBJECTS = ["realm", "hyperstructure", "battle", "explorer"] as const;
export type StudioSubject = (typeof STUDIO_SUBJECTS)[number];

const ATTACKER = 1;
const DEFENDER = 2;
const EXPLORER = 3;
const HYPERSTRUCTURE_DESIGN = 17;
const EXPLORER_TROOP: StudioTroop = { category: TroopType.Knight, tier: TroopTier.T1 };

/**
 * The studio's world on the lab's land: a realm whose tier is set on a call, a Hyperstructure that rises on one, two
 * armies that fight through the world map's own combat bridge, and an explorer that marches into the fog and uncovers
 * it the way an explore does, every army drawn as the world map draws it (armies.ts). It also runs the camera: free
 * under the mouse, or along a path that plays its cues on time.
 */
export class StudioStage implements LabStage {
  readonly request = createStudioTerrainRequest(0);
  private context: LabStageContext | null = null;
  private pages: PreparedTerrainPage[] = [];
  private readonly realms: SettlementModel[] = [];
  private hyperstructure: HyperstructureModel | null = null;
  private armies: StudioArmies | null = null;
  private combat: CombatPresentationCoordinator | null = null;
  private combatBridge: WorldmapCombatPresentation | null = null;
  private troops: Record<"attacker" | "defender", StudioTroop> = {
    attacker: { category: TroopType.Knight, tier: TroopTier.T1 },
    defender: { category: TroopType.Crossbowman, tier: TroopTier.T1 },
  };
  private cast = new Set<StudioSubject>(STUDIO_SUBJECTS);
  private realmLevel = 0;
  private hyperstructureProgress = 0;
  private explored = 0;
  private defenderDown = false;
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
    // The armies place themselves by the game's map centre, read from its rules.
    installLabGameRules(new NativeFactStore());
    this.pages = await Promise.all(
      Array.from({ length: STUDIO_EXPLORE_STEPS + 1 }, (_, revealed) =>
        terrain.preparePageAsync(createStudioTerrainRequest(revealed)),
      ),
    );
    for (const asset of REALM_ASSETS.filter((entry) => !entry.wonder).toSorted((a, b) => a.level - b.level)) {
      const realm = new SettlementModel(await gltfLoader.loadAsync(asset.path), 1, "realm");
      realm.setCount(1);
      realm.setMatrixAt(0, this.placementMatrix("realm", facingTheMapCamera(asset.path)));
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
    this.armies = new StudioArmies(scene, terrain, compile);
    await this.armies.prepare();
    this.combat = new CombatPresentationCoordinator(scene, { projectileHitQuery: this.armies.projectileTargets() });
    this.combatBridge = new WorldmapCombatPresentation({
      armyManager: this.armies.roster(),
      getCombatPresentation: () => this.combat ?? undefined,
      getArmyDisplayPosition: (entityId) => this.armyHex(entityId),
      getStructureHexPosition: () => undefined,
    });
    this.combatBridge.bind();
    this.reset();
    await this.armies.whenReady();
  }

  /**
   * The world as it stood before any moment played (a foundation, a settlement, the fog closed, both armies up), with
   * only `cast` on the set.
   */
  reset(cast: readonly StudioSubject[] = STUDIO_SUBJECTS): void {
    this.stop();
    this.cast = new Set(cast);
    this.setRealmLevel(0);
    this.resetHyperstructure();
    this.explored = 0;
    this.context?.terrain.cancelShroudReveals();
    this.context?.terrain.present([this.pages[0]]);
    this.defenderDown = false;
    this.placeArmies();
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
    this.placeArmies();
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
      walking: this.armies?.isMarching(EXPLORER) ?? false,
      defenderDown: this.defenderDown,
      troops: this.troops,
      cast: [...this.cast],
    };
  }

  /**
   * One clock for the take and the world: a path's cues and the moments they start keep their order at any world
   * speed, and a slowed world films as slow motion, camera and all.
   */
  update(delta: number): void {
    this.advanceTake(delta);
    this.armies?.update(delta);
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
    model.group.visible = this.cast.has("hyperstructure");
    model.setMatrixAt(0, this.placementMatrix("hyperstructure", facingTheMapCamera(HYPERSTRUCTURE_MODEL_PATH)));
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
    this.defenderDown = this.armies?.defeat(DEFENDER) ?? false;
  }

  /**
   * The explorer marches onto the next hidden hex of its route, which is uncovered from the hex it left. One called
   * while it still walks sends it on from where it is, as the map replaces a walk.
   */
  private explore(): void {
    const { terrain } = this.requireContext();
    if (this.explored >= STUDIO_EXPLORE_STEPS) return;
    const from = this.explorerHex();
    const to = STUDIO_PLACES.exploreRoute[this.explored];
    this.explored += 1;
    terrain.queueShroudReveal(to.col, to.row, from);
    terrain.present([this.pages[this.explored]]);
    this.armies?.march(EXPLORER, to);
  }

  private setRealmLevel(level: number): void {
    this.realmLevel = Math.max(0, Math.min(this.realms.length - 1, level));
    this.realms.forEach((realm, index) => (realm.group.visible = this.cast.has("realm") && index === this.realmLevel));
  }

  /** The armies the cast holds, where they stand now: the battle's two facing each other, the explorer on its route. */
  private placeArmies(): void {
    const armies = this.armies;
    if (!armies) return;
    const { attacker, defender, exploreRoute } = STUDIO_PLACES;
    const battle = this.cast.has("battle");
    if (battle)
      armies.place({
        entityId: ATTACKER,
        ...this.troops.attacker,
        hex: attacker,
        yaw: facing(attacker, defender),
        color: "#e1b955",
      });
    else armies.withdraw(ATTACKER);
    if (battle && !this.defenderDown)
      armies.place({
        entityId: DEFENDER,
        ...this.troops.defender,
        hex: defender,
        yaw: facing(defender, attacker),
        color: "#a33b39",
      });
    else armies.withdraw(DEFENDER);
    const at = this.explorerHex();
    if (this.cast.has("explorer"))
      armies.place({
        entityId: EXPLORER,
        ...EXPLORER_TROOP,
        hex: at,
        yaw: facing(at, exploreRoute[Math.min(this.explored, exploreRoute.length - 1)]),
        color: "#e1b955",
      });
    else armies.withdraw(EXPLORER);
  }

  private explorerHex() {
    return this.explored === 0 ? STUDIO_PLACES.exploreStart : STUDIO_PLACES.exploreRoute[this.explored - 1];
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

  private armyHex(entityId: ID) {
    if (entityId === ATTACKER) return STUDIO_PLACES.attacker;
    if (entityId === DEFENDER) return STUDIO_PLACES.defender;
    return undefined;
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

/**
 * A structure's yaw as the map turns it (`resolveStructureRotationY`): a realm always faces the map's camera; any other
 * structure takes one of the map's six turns, here the one that faces the camera too. The camera faces a structure
 * from the south (`turn` 0), where every take films its action from.
 */
function facingTheMapCamera(modelPath: string): number {
  return resolveStructureRotationY([modelPath], 0);
}

/** The yaw that turns a model on hex `from` to face hex `to`. */
function facing(from: { col: number; row: number }, to: { col: number; row: number }): number {
  const a = terrainHexToWorld(from.col, from.row);
  const b = terrainHexToWorld(to.col, to.row);
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** Puts the camera at a pose and points the controls at its target. */
export function applyPose(camera: PerspectiveCamera, controls: MapControls, pose: StudioPose): void {
  if (camera.fov !== pose.fov) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
  camera.position.set(...cameraPosition(pose));
  controls.target.set(...pose.target);
  camera.lookAt(controls.target);
}
