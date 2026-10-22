import { Vector3 } from "three";

import { mistRolls, useDayEndStore, type DayEndArrival, type DayEndPhase } from "@/hooks/store/use-day-end-store";
import type { LabStage, LabStageContext } from "@/three/debug/procedural-terrain-debug-renderer";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { PreparedTerrainPage } from "@/three/terrain/terrain-types";

import { EndgameFixtureScene } from "../endgame-mist/fixture-scene";
import { pathDuration, poseAt, poseFromCamera, type StudioPath, type StudioPose } from "../studio/camera-path";
import { applyPose } from "../studio/stage";
import { createDayEndLand, DAY_END_VEIL } from "./fixture";

/**
 * The Frontier day end on the lab's land, played by the game's own moment (use-day-end-store) and parts: the game
 * end's veil rolls from the spires while the moment's mist rolls, as the renderer rolls it on the world map; behind the
 * black the land is swapped for the new day's, as ExpeditionRollover re-projects the map; at dawn the realm's new
 * surroundings come out of the shroud, as an explore reveals them. Its clock is the world's.
 */
export class DayEndStage implements LabStage {
  private readonly land = createDayEndLand();
  readonly request = this.land.today;
  private context: LabStageContext | null = null;
  private veil: EndgameFixtureScene | null = null;
  private pages: Record<"today" | "night" | "dawn", PreparedTerrainPage> | null = null;
  private shot: { path: StudioPath; start: StudioPose; elapsed: number } | null = null;
  private phone = false;
  private unsubscribe: (() => void) | null = null;

  async prepare(context: LabStageContext): Promise<void> {
    this.context = context;
    const { scene, terrain, camera, compile } = context;
    this.veil = new EndgameFixtureScene(DAY_END_VEIL);
    await this.veil.prepare(scene, terrain, camera, compile);
    const [today, night, dawn] = await Promise.all(
      [this.land.today, this.land.night, this.land.dawn].map((page) => terrain.preparePageAsync(page)),
    );
    this.pages = { today, night, dawn };
    this.unsubscribe = useDayEndStore.subscribe((moment, before) => {
      if (mistRolls(moment) && !mistRolls(before)) this.veil?.play();
      if (moment.phase !== before.phase) this.enter(moment.phase);
    });
    this.rest(this.phone);
  }

  /** The map as it was played, before the day ends; a phone frames the realm above its summary sheet. */
  rest(phone: boolean): void {
    this.phone = phone;
    const { terrain, controls } = this.requireContext();
    useDayEndStore.getState().rest();
    this.veil?.reset();
    this.veil?.showOnlyOwnRealm(false);
    terrain.cancelShroudReveals();
    terrain.present([this.requirePages().today]);
    controls.enabled = true;
    this.cut(this.pose("play"));
  }

  /** The day ends: live, over the land that is ending; later, the new land is already there when the game opens. */
  endTheDay(arrival: DayEndArrival): void {
    if (useDayEndStore.getState().phase !== "day") return;
    if (arrival === "later") this.newLand();
    useDayEndStore.getState().begin(arrival);
  }

  update(delta: number): void {
    const { terrain, camera } = this.requireContext();
    this.veil?.update(delta, terrain, camera);
    this.advanceShot(delta);
  }

  status() {
    const { camera, controls } = this.requireContext();
    const { phase, arrival, landReady } = useDayEndStore.getState();
    const pose = poseFromCamera(camera.position.toArray(), controls.target.toArray(), camera.fov);
    return { phase, arrival, landReady, pose, veil: this.veil?.getSnapshot() ?? null };
  }

  dispose(): void {
    this.unsubscribe?.();
    useDayEndStore.getState().rest();
    this.veil?.dispose();
    this.context = null;
  }

  /** What the world does as each phase begins; the screen's summary, black and fades are the game's DayEndScreen. */
  private enter(phase: DayEndPhase): void {
    const { terrain, controls } = this.requireContext();
    controls.enabled = phase === "day";
    if (phase === "veil") this.film([{ t: 0 }, { t: 3, ...this.pose("veil") }]);
    if (phase === "black") {
      this.newLand();
      useDayEndStore.getState().markLandReady();
    }
    if (phase === "dawn") {
      for (const hex of this.land.revealed) terrain.queueShroudReveal(hex.col, hex.row, this.land.realm);
      terrain.present([this.requirePages().dawn]);
      this.film([{ t: 0 }, { t: 2.4, ...this.pose("day"), ease: "out" }]);
    }
  }

  /** The realm's new land: the veil gone, the land swapped, only the realm on it, the camera down on the realm. */
  private newLand(): void {
    const { terrain } = this.requireContext();
    this.veil?.reset();
    this.veil?.showOnlyOwnRealm(true);
    terrain.cancelShroudReveals();
    terrain.present([this.requirePages().night]);
    this.cut(this.pose("dawn"));
  }

  /**
   * The camera's framings round the realm: in play, pulled out for the veil, down close at dawn, the new day's. The
   * summary stands low on every screen, so the realm sits in the upper half: the camera looks south of it.
   */
  private pose(framing: "play" | "veil" | "dawn" | "day"): StudioPose {
    const [distance, tilt] = { play: [26, 52], veil: [36, 46], dawn: [13, 60], day: [24, 52] }[framing];
    const realm = this.realmPoint();
    const southward = distance * (this.phone ? 0.22 : 0.18);
    return { target: [realm.x, realm.y, realm.z + southward], distance, tilt, turn: 0, fov: 36 };
  }

  private realmPoint(): Vector3 {
    const { x, z } = terrainHexToWorld(this.land.realm.col, this.land.realm.row);
    return new Vector3(x, this.requireContext().terrain.sampleSurface(x, z).height, z);
  }

  private cut(pose: StudioPose): void {
    this.shot = null;
    const { camera, controls } = this.requireContext();
    applyPose(camera, controls, pose);
  }

  private film(keys: StudioPath["keys"]): void {
    const { camera, controls } = this.requireContext();
    const start = poseFromCamera(camera.position.toArray(), controls.target.toArray(), camera.fov);
    this.shot = { path: { keys }, start, elapsed: 0 };
  }

  private advanceShot(delta: number): void {
    const shot = this.shot;
    if (!shot) return;
    shot.elapsed += delta;
    const { camera, controls } = this.requireContext();
    applyPose(camera, controls, poseAt(shot.path, shot.elapsed, shot.start));
    if (shot.elapsed >= pathDuration(shot.path)) this.shot = null;
  }

  private requireContext(): LabStageContext {
    if (!this.context) throw new Error("The day-end stage is not prepared");
    return this.context;
  }

  private requirePages() {
    if (!this.pages) throw new Error("The day-end lands are not prepared");
    return this.pages;
  }
}
