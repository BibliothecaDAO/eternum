import { Vector3 } from "three";

import type { LabStage, LabStageContext } from "@/three/debug/procedural-terrain-debug-renderer";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { PreparedTerrainPage } from "@/three/terrain/terrain-types";

import { EndgameFixtureScene } from "../endgame-mist/fixture-scene";
import { pathDuration, poseAt, poseFromCamera, type StudioPath, type StudioPose } from "../studio/camera-path";
import { applyPose } from "../studio/stage";
import { createDayEndLand, DAY_END_VEIL } from "./fixture";
import {
  advance,
  continueDay,
  endTheDay,
  restingDay,
  skip,
  VEIL_PACE,
  type DayEndArrival,
  type DayEndDirection,
  type DayEndPhase,
  type DayEndState,
} from "./sequence";

/**
 * The Frontier day end on the lab's land, made of the game's own parts: the game end's veil (the spires' orb gathers,
 * bursts and rolls its mist over the map, sparing the player's realm), the land swapped for the new day's behind the
 * black as the map is re-projected at the rollover, and the realm's new surroundings brought out of the shroud as an
 * explore reveals them. Its clock is the world's, so a slowed world plays it in slow motion.
 */
export class DayEndStage implements LabStage {
  private readonly land = createDayEndLand();
  readonly request = this.land.today;
  private context: LabStageContext | null = null;
  private veil: EndgameFixtureScene | null = null;
  private pages: Record<"today" | "night" | "dawn", PreparedTerrainPage> | null = null;
  private state: DayEndState = restingDay("night", "live");
  private shot: { path: StudioPath; start: StudioPose; elapsed: number } | null = null;
  private phone = false;

  constructor(private readonly onPhase: (state: DayEndState) => void) {}

  async prepare(context: LabStageContext): Promise<void> {
    this.context = context;
    const { scene, terrain, camera, compile } = context;
    this.veil = new EndgameFixtureScene(DAY_END_VEIL);
    await this.veil.prepare(scene, terrain, camera, compile);
    const [today, night, dawn] = await Promise.all(
      [this.land.today, this.land.night, this.land.dawn].map((page) => terrain.preparePageAsync(page)),
    );
    this.pages = { today, night, dawn };
    this.rest(this.state.direction, this.state.arrival);
  }

  /** The map as it was played, before the day ends; a phone frames the realm in the screen's upper half. */
  rest(direction: DayEndDirection, arrival: DayEndArrival, phone = this.phone): void {
    this.phone = phone;
    const { terrain } = this.requireContext();
    this.veil?.reset();
    this.veil?.showOnlyOwnRealm(false);
    terrain.cancelShroudReveals();
    terrain.present([this.requirePages().today]);
    this.setState(restingDay(direction, arrival));
    this.cut(this.pose("play"));
  }

  endTheDay(): void {
    if (this.state.phase === "day") this.setState(endTheDay(this.state));
  }

  continueDay(): void {
    this.setState(continueDay(this.state));
  }

  skip(): void {
    this.setState(skip(this.state));
  }

  update(delta: number): void {
    const { terrain, camera } = this.requireContext();
    const rolling = this.state.phase === "veil" || this.state.phase === "summary" || this.state.phase === "nightfall";
    this.veil?.update(rolling ? delta * VEIL_PACE[this.state.direction] : delta, terrain, camera);
    const next = advance(this.state, delta);
    if (next.phase !== this.state.phase) this.setState(next);
    else this.state = next;
    this.advanceShot(delta);
  }

  status() {
    const { camera, controls } = this.requireContext();
    const pose = poseFromCamera(camera.position.toArray(), controls.target.toArray(), camera.fov);
    return { ...this.state, pose, veil: this.veil?.getSnapshot() ?? null };
  }

  dispose(): void {
    this.veil?.dispose();
    this.context = null;
  }

  private setState(next: DayEndState): void {
    const entered = next.phase !== this.state.phase;
    this.state = next;
    if (entered) this.enter(next.phase);
    this.onPhase(next);
  }

  /** What the world does as each phase begins; the screen's fades and the summary are the view's. */
  private enter(phase: DayEndPhase): void {
    const { terrain, controls } = this.requireContext();
    controls.enabled = phase === "day" || phase === "new-day";
    if (phase === "veil") {
      this.veil?.play();
      this.film([{ t: 0 }, { t: 3, ...this.pose("veil") }]);
    }
    // Arriving later, the night direction's summary opens over the new land, still in the dark.
    if (phase === "summary" && this.state.arrival === "later") this.newLand();
    if (phase === "black") this.newLand();
    if (phase === "dawn") {
      for (const hex of this.land.revealed) terrain.queueShroudReveal(hex.col, hex.row, this.land.realm);
      terrain.present([this.requirePages().dawn]);
      this.film([{ t: 0 }, { t: 2.4, ...this.pose("day"), ease: "out" }]);
    }
  }

  /** Behind the black, the realm's new land: the veil gone, the land swapped, the camera down on the realm. */
  private newLand(): void {
    const { terrain } = this.requireContext();
    this.veil?.reset();
    this.veil?.showOnlyOwnRealm(true);
    terrain.cancelShroudReveals();
    terrain.present([this.requirePages().night]);
    this.cut(this.pose("dawn"));
  }

  /** The camera's framings round the realm: in play, pulled out for the veil, down close at dawn, the new day's. */
  private pose(framing: "play" | "veil" | "dawn" | "day"): StudioPose {
    const lens = { play: [26, 52], veil: [36, 46], dawn: [13, 60], day: [24, 52] }[framing];
    const [distance, tilt] = lens;
    const realm = this.realmPoint();
    // Where the summary sits low (the night direction's card, any phone's sheet), the realm sits in the upper half:
    // the camera looks south of it.
    const southward = this.phone || this.state.direction === "night" ? distance * 0.18 : 0;
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
