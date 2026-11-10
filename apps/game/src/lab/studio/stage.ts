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
import { StudioArmies } from "./armies";
import { cameraPosition, pathDuration, poseAt, poseFromCamera, type StudioPath, type StudioPose } from "./camera-path";
import {
  STUDIO_SETS,
  createStudioTerrainRequest,
  type Hex,
  type StudioSet,
  type StudioSetName,
  type StudioTroop,
} from "./fixture";

/** The moments the studio plays on a call, each through the game's own presentation of it. */
export const STUDIO_TRIGGERS = ["rise", "attack", "defeat", "explore", "realm", "strike"] as const;
export type StudioTrigger = (typeof STUDIO_TRIGGERS)[number];

/** What the set can hold. A take puts on it only the subjects it films; between takes all of them stand. */
const STUDIO_SUBJECTS = ["realm", "kingdoms", "sites", "hyperstructure", "battle", "armies", "explorer"] as const;
export type StudioSubject = (typeof STUDIO_SUBJECTS)[number];

const EXPLORER = 3;
/** A fight's two armies, by its place in the set's list. */
const attackerOf = (battle: number) => 100 + battle * 2;
const defenderOf = (battle: number) => 101 + battle * 2;
/** An army under a standing order, and the guard a raider attacks, by the order's place in the set's list. */
const orderedOf = (order: number) => 1000 + order;
const guardOf = (order: number) => 5000 + order;
/** How long a raider's strike takes to land, from its attack to the guard's fall. */
const STRIKE_SECONDS = 1.6;
/** The places a path frames its subjects by. */
const STUDIO_PLACES = ["realm", "hyperstructure", "attacker", "defender", "exploreStart"] as const;
export type StudioPlace = (typeof STUDIO_PLACES)[number];
const HYPERSTRUCTURE_DESIGN = 17;
const EXPLORER_TROOP: StudioTroop = { category: TroopType.Knight, tier: TroopTier.T1 };
/** A camp's guard: the troop the map hands to the articulated figure, so it falls as one. */
const GUARD_TROOP = EXPLORER_TROOP;

/**
 * The studio's world on the lab's land: a realm whose tier is set on a call, a Hyperstructure that rises on one, two
 * armies that fight through the world map's own combat bridge, and an explorer that marches into the fog and uncovers
 * it the way an explore does, every army drawn as the world map draws it (armies.ts). It also runs the camera: free
 * under the mouse, or along a path that plays its cues on time.
 */
export class StudioStage implements LabStage {
  readonly request: LabStage["request"];
  private readonly set: StudioSet;
  private context: LabStageContext | null = null;
  private pages: PreparedTerrainPage[] = [];
  private readonly realms: SettlementModel[] = [];
  private readonly kingdoms: SettlementModel[] = [];
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
  private revealed = 0;
  private readonly fallen = new Set<number>();
  private readonly sites: SettlementModel[] = [];
  /** Where each ordered army is on its route, which way it walks, and how its raid stands. */
  private marches: { at: number; heading: 1 | -1; wait: number; strike: number | null; struck: boolean }[] = [];
  private take: {
    path: StudioPath;
    start: StudioPose;
    elapsed: number;
    fired: number;
    resolve: (live: boolean) => void;
  } | null = null;
  private disposed = false;

  constructor(
    private readonly setName: StudioSetName,
    private readonly onCue: (trigger: string, args: Record<string, unknown>) => void,
  ) {
    this.set = STUDIO_SETS[setName];
    this.request = createStudioTerrainRequest(setName, 0);
  }

  async prepare(context: LabStageContext): Promise<void> {
    this.context = context;
    const { scene, terrain, compile } = context;
    // The armies place themselves by the game's map centre, read from its rules.
    installLabGameRules(new NativeFactStore());
    this.pages = await Promise.all(
      Array.from({ length: this.set.reveals.length + 1 }, (_, revealed) =>
        terrain.preparePageAsync(createStudioTerrainRequest(this.setName, revealed)),
      ),
    );
    for (const asset of REALM_ASSETS.filter((entry) => !entry.wonder).toSorted((a, b) => a.level - b.level)) {
      const model = await gltfLoader.loadAsync(asset.path);
      const yaw = facingTheMapCamera(asset.path);
      this.realms.push(await this.standRealms(model, [this.set.realm], yaw, "owned"));
      const kingdoms = this.set.kingdoms.filter((kingdom) => kingdom.level === asset.level).map(({ hex }) => hex);
      this.kingdoms.push(await this.standRealms(model, kingdoms, yaw, "enemy"));
    }
    await this.standSites();
    this.hyperstructure = new HyperstructureModel(1);
    await compile(this.hyperstructure.group, scene);
    scene.add(this.hyperstructure.group);
    this.armies = new StudioArmies(scene, terrain, compile, this.set.biomeAt);
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
    for (const kingdom of this.kingdoms) kingdom.group.visible = this.cast.has("kingdoms");
    this.revealed = 0;
    for (const site of this.sites) site.group.visible = this.cast.has("sites");
    this.marches = this.set.orders.map(({ startAt, heading, wait }) => ({
      at: startAt,
      heading,
      wait,
      strike: null,
      struck: false,
    }));
    this.context?.terrain.cancelShroudReveals();
    this.context?.terrain.present([this.pages[0]]);
    this.fallen.clear();
    this.placeArmies();
  }

  trigger(name: Exclude<StudioTrigger, "strike">, args: Record<string, unknown> = {}): void {
    if (name === "rise") this.rise(Number(args.progress ?? 100));
    else if (name === "attack") this.attack(Number(args.battle ?? 0));
    else if (name === "defeat") this.defeat(Number(args.battle ?? 0), args.skull !== false);
    else if (name === "explore") this.explore();
    else this.setRealmLevel(Number(args.level ?? this.realmLevel + 1));
  }

  setTroops(troops: Partial<Record<"attacker" | "defender", StudioTroop>>): void {
    this.troops = { ...this.troops, ...troops };
    this.placeArmies();
  }

  /** Where each subject stands, for paths framed around it. */
  places(): Record<StudioPlace, [number, number, number]> {
    return Object.fromEntries(STUDIO_PLACES.map((name) => [name, this.placeAt(name).toArray()])) as Record<
      StudioPlace,
      [number, number, number]
    >;
  }

  at(hex: Hex): [number, number, number] {
    return this.hexPosition(hex).toArray();
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
      explored: this.revealed,
      marching: this.marches.filter((_, order) => this.armies?.isMarching(orderedOf(order))).length,
      raided: this.marches.filter((march) => march.struck).length,
      walking: this.armies?.isMarching(EXPLORER) ?? false,
      defenderDown: this.fallen.has(0),
      fallen: this.fallen.size,
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
    if (this.cast.has("armies")) this.runOrders(delta);
    this.armies?.update(delta);
    this.combat?.update(delta);
    this.hyperstructure?.updateAnimations(delta);
    for (const realm of [...this.realms, ...this.kingdoms, ...this.sites])
      if (realm.group.visible) realm.updateAnimations(delta);
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.combatBridge?.dispose();
    this.combat?.dispose();
    this.armies?.dispose();
    for (const model of [...this.realms, ...this.kingdoms, ...this.sites, this.hyperstructure]) {
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
    model.setMatrixAt(0, this.placementMatrix(this.set.hyperstructure, facingTheMapCamera(HYPERSTRUCTURE_MODEL_PATH)));
    model.setConstructionAt(0, { entityId: HYPERSTRUCTURE_DESIGN, progress: 0, completed: false });
  }

  /** A fight's attacker strikes its defender as a confirmed battle replays on the world map. */
  private attack(battle: number): void {
    if (this.fallen.has(battle) || !this.set.battles[battle]) return;
    this.combatBridge?.replayIndexed(battleWonBy(attackerOf(battle), defenderOf(battle)));
  }

  private defeat(battle: number, skull: boolean): void {
    if (this.fallen.has(battle)) return;
    if (this.armies?.defeat(defenderOf(battle), skull)) this.fallen.add(battle);
  }

  /**
   * The explorer marches onto the next hidden hex of its route, which is uncovered from the hex it left. One called
   * while it still walks sends it on from where it is, as the map replaces a walk.
   */
  private explore(): void {
    if (this.revealed >= this.set.exploreRoute.length) return;
    const from = this.explorerHex();
    this.clearFog(from);
    this.armies?.march(EXPLORER, this.set.exploreRoute[this.revealed - 1]);
  }

  /** Uncovers the set's next hexes under fog, each swept clear from the side `from` lies on. */
  private clearFog(from: Hex): void {
    const { terrain } = this.requireContext();
    const uncovered = this.set.reveals[this.revealed];
    if (!uncovered) return;
    this.revealed += 1;
    for (const hex of uncovered) terrain.queueShroudReveal(hex.col, hex.row, from);
    terrain.present([this.pages[this.revealed]]);
  }

  /**
   * One tick of the map's life: every ordered army that has arrived on its hex walks on to the next, an explorer
   * uncovering the fog ahead of it; one at the end of its route turns back, a raider after its guard has fallen.
   */
  private runOrders(delta: number): void {
    const armies = this.armies;
    if (!armies) return;
    this.set.orders.forEach((order, index) => {
      const march = this.marches[index];
      march.wait -= delta;
      if (march.wait > 0 || armies.isMarching(orderedOf(index))) return;
      if (march.strike !== null) {
        march.strike -= delta;
        if (march.strike > 0) return;
        march.strike = null;
        armies.defeat(guardOf(index), false);
      }
      const ahead = order.route[march.at + march.heading];
      if (!ahead) {
        if (order.raids && !march.struck) return this.raid(index);
        march.heading = march.heading === 1 ? -1 : 1;
        return;
      }
      if (order.explores && this.isUnderFog(ahead)) this.clearFog(order.route[march.at]);
      march.at += march.heading;
      armies.march(orderedOf(index), ahead);
    });
  }

  /** A raider strikes the guard beside it, as a confirmed battle replays on the world map. */
  private raid(order: number): void {
    const march = this.marches[order];
    march.struck = true;
    march.strike = STRIKE_SECONDS;
    this.combatBridge?.replayIndexed(battleWonBy(orderedOf(order), guardOf(order)));
  }

  private isUnderFog(hex: Hex): boolean {
    return this.set.reveals.slice(this.revealed).some((stage) => stage.some((near) => sameHex(near, hex)));
  }

  private setRealmLevel(level: number): void {
    this.realmLevel = Math.max(0, Math.min(this.realms.length - 1, level));
    this.realms.forEach((realm, index) => (realm.group.visible = this.cast.has("realm") && index === this.realmLevel));
  }

  /** The armies the cast holds, where they stand now: each fight's two facing each other, the ordered armies and the explorer on their routes. */
  private placeArmies(): void {
    const armies = this.armies;
    if (!armies) return;
    this.set.battles.forEach(({ attacker, defender }, battle) => {
      const fighting = this.cast.has("battle");
      if (fighting)
        armies.place({
          entityId: attackerOf(battle),
          ...this.troops.attacker,
          hex: attacker,
          yaw: facing(attacker, defender),
          color: "#e1b955",
        });
      else armies.withdraw(attackerOf(battle));
      if (fighting && !this.fallen.has(battle))
        armies.place({
          entityId: defenderOf(battle),
          ...this.troops.defender,
          hex: defender,
          yaw: facing(defender, attacker),
          color: "#a33b39",
        });
      else armies.withdraw(defenderOf(battle));
    });
    this.set.orders.forEach((order, index) => {
      const { at, heading } = this.marches[index];
      const here = order.route[at];
      const ahead = order.route[at + heading] ?? order.raids ?? here;
      if (this.cast.has("armies"))
        armies.place({
          entityId: orderedOf(index),
          ...order.troop,
          hex: here,
          yaw: facing(here, ahead),
          color: "#e1b955",
        });
      else armies.withdraw(orderedOf(index));
      if (!order.raids) return;
      if (this.cast.has("armies"))
        armies.place({
          entityId: guardOf(index),
          ...GUARD_TROOP,
          hex: order.raids,
          yaw: facing(order.raids, order.route.at(-1)!),
          color: "#a33b39",
        });
      else armies.withdraw(guardOf(index));
    });
    const at = this.explorerHex();
    const route = this.set.exploreRoute;
    if (this.cast.has("explorer"))
      armies.place({
        entityId: EXPLORER,
        ...EXPLORER_TROOP,
        hex: at,
        yaw: route.length > 0 ? facing(at, route[Math.min(this.revealed, route.length - 1)]) : 0,
        color: "#e1b955",
      });
    else armies.withdraw(EXPLORER);
  }

  private explorerHex() {
    return this.revealed === 0 ? this.set.exploreStart : this.set.exploreRoute[this.revealed - 1];
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
    const id = Number(entityId);
    if (id >= guardOf(0)) return this.set.orders[id - guardOf(0)]?.raids;
    if (id >= orderedOf(0)) return this.set.orders[id - orderedOf(0)]?.route[this.marches[id - orderedOf(0)].at];
    const battle = this.set.battles[Math.floor((id - attackerOf(0)) / 2)];
    if (!battle) return undefined;
    return id % 2 === attackerOf(0) % 2 ? battle.attacker : battle.defender;
  }

  /** The set's camps, villages, ruins and beasts, each model's sites drawn from it at once, facing the map's camera. */
  private async standSites(): Promise<void> {
    const { scene, compile } = this.requireContext();
    const hexesByModel = Map.groupBy(this.set.sites, (site) => site.model);
    for (const [path, sites] of hexesByModel) {
      const model = new SettlementModel(await gltfLoader.loadAsync(path), sites.length, "village");
      model.setCount(sites.length);
      sites.forEach(({ hex }, index) => model.setMatrixAt(index, this.placementMatrix(hex, facingTheMapCamera(path))));
      await model.prepare();
      await compile(model.group, scene);
      scene.add(model.group);
      this.sites.push(model);
    }
  }

  /** Realms of one tier standing on their hexes, as the map draws a tier's realms from one model. */
  private async standRealms(
    model: ConstructorParameters<typeof SettlementModel>[0],
    hexes: readonly Hex[],
    yaw: number,
    relationship: "owned" | "enemy",
  ): Promise<SettlementModel> {
    const { scene, compile } = this.requireContext();
    const realm = new SettlementModel(model, Math.max(1, hexes.length), "realm");
    realm.setCount(hexes.length);
    hexes.forEach((hex, index) => {
      realm.setMatrixAt(index, this.placementMatrix(hex, yaw));
      realm.setRelationshipAt(index, relationship);
      realm.setOrderAt(index, 1 + ((hex.col + hex.row) % 16));
      realm.setWonderEntityAt(index, 1001 + index);
    });
    await realm.prepare();
    await compile(realm.group, scene);
    scene.add(realm.group);
    return realm;
  }

  private placementMatrix(hex: Hex, yaw: number): Matrix4 {
    const position = this.hexPosition(hex);
    return new Matrix4().makeRotationY(yaw).setPosition(position.x, position.y + 0.025, position.z);
  }

  private placeAt(place: StudioPlace): Vector3 {
    if (place === "attacker" || place === "defender") return this.hexPosition(this.set.battles[0][place]);
    return this.hexPosition(this.set[place]);
  }

  private hexPosition(hex: Hex): Vector3 {
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

const sameHex = (a: Hex, b: Hex) => a.col === b.col && a.row === b.row;

/** A battle the attacker won, as the indexer reports one to the world map. */
function battleWonBy(attackerId: number, defenderId: number): BattleEventSystemUpdate {
  return {
    entityId: attackerId,
    battleData: {
      attackerId,
      defenderId,
      attackerOwner: 1,
      defenderOwner: 2,
      winnerId: attackerId,
      maxReward: [],
      timestamp: 0,
    },
  };
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
