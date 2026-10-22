import { dayOf, readExpeditionRules, type Position } from "@bibliothecadao/eternum";
import { Vector3 } from "three";

import { mistRolls, useDayEndStore, type DayEndPhase } from "@/hooks/store/use-day-end-store";
import type { LabStage, LabStageContext } from "@/three/debug/procedural-terrain-debug-renderer";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { PreparedTerrainPage } from "@/three/terrain/terrain-types";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { watchDayTurn, type DayTurnWorld } from "@/ui/features/world/components/expeditions/expedition-rollover";

import { EndgameFixtureScene } from "../endgame-mist/fixture-scene";
import { pathDuration, poseAt, poseFromCamera, type StudioPath, type StudioPose } from "../studio/camera-path";
import { applyPose } from "../studio/stage";
import { createDayEndLand, DAY_END_VEIL } from "./fixture";

/** How the day ends in the lab: which clock turns when. */
export type DayEndCase =
  /** The chain clock turns, and the block clock two seconds later, while the mist rolls. */
  | "ordinary"
  /** Both clocks turn between two of the rollover's looks. */
  | "together"
  /** The chain clock turns; the block clock waits for `blockArrives`, past the black's longest hold if asked. */
  | "late-block"
  /** The game opens after the day ended: both clocks already on the new day. */
  | "later";

/** What the rollover did to the map, and in which phase of the moment. */
interface LandEvent {
  kind: "reproject" | "navigate";
  phase: DayEndPhase;
  position?: { x: number; y: number };
}

const BLOCK_LAG_MS = 2_000;

/**
 * The Frontier day end on the lab's land, turned by the game's own rollover (`watchDayTurn`, the code
 * ExpeditionRollover runs) over the game's Frontier day facts (`frontierDay`, a realm owned by the player) on a lab
 * clock: the chain and block times are the lab's, the map's two sinks are this stage's. Its re-projection swaps the
 * land for the new day's, its camera move goes to the realm; the moment (use-day-end-store) rolls the game end's veil
 * from the spires while the mist rolls; at dawn the realm's new surroundings come out of the shroud. Every call the
 * rollover makes is logged with the phase it landed in.
 */
export class DayEndStage implements LabStage {
  private readonly land = createDayEndLand();
  readonly request = this.land.today;
  private readonly facts = frontierDay();
  private readonly dayEndsAt: number;
  private clock = { chain: 0, block: 0 };
  private context: LabStageContext | null = null;
  private veil: EndgameFixtureScene | null = null;
  private pages: Record<"today" | "night" | "dawn", PreparedTerrainPage> | null = null;
  private shot: { path: StudioPath; start: StudioPose; elapsed: number } | null = null;
  private phone = false;
  private onNewLand = false;
  private revealed = false;
  private events: LandEvent[] = [];
  private stopTurn: (() => void) | null = null;
  private unsubscribe: (() => void) | null = null;
  private blockTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const rules = readExpeditionRules(this.facts.store, 1)!;
    this.dayEndsAt = dayOf(rules, 350)!.end;
  }

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
      if (!mistRolls(moment) && mistRolls(before)) this.veil?.reset();
      if (moment.phase !== before.phase) this.enter(moment.phase);
    });
    this.rest(this.phone);
  }

  /** The day as it was played, five seconds before it ends on both clocks, the rollover watching. */
  rest(phone: boolean): void {
    this.phone = phone;
    const { terrain, controls } = this.requireContext();
    this.stopTurn?.();
    if (this.blockTimer) clearTimeout(this.blockTimer);
    useDayEndStore.getState().rest();
    this.veil?.reset();
    this.veil?.showOnlyOwnRealm(false);
    terrain.cancelShroudReveals();
    terrain.present([this.requirePages().today]);
    this.onNewLand = false;
    this.revealed = false;
    this.events = [];
    controls.enabled = true;
    this.cut(this.pose("play"));
    this.watchFrom(this.dayEndsAt - 5);
  }

  /** The day ends on the lab's clock, the rollover meeting it as it meets the chain's. */
  endTheDay(how: DayEndCase): void {
    if (useDayEndStore.getState().phase !== "day" || this.clock.chain >= this.dayEndsAt) return;
    const newDay = this.dayEndsAt + 1;
    if (how === "later") {
      // Opened after the day ended: the map is already on the new day, and DayDone opens the summary over it.
      this.watchFrom(newDay);
      useDayEndStore.getState().begin("later");
      this.presentNewLand();
      this.cut(this.pose("dawn"));
      return;
    }
    this.clock.chain = newDay;
    if (how === "together") this.clock.block = newDay;
    if (how === "ordinary") this.blockTimer = setTimeout(() => this.blockArrives(), BLOCK_LAG_MS);
  }

  /** The block clock catches up with the chain's. */
  blockArrives(): void {
    this.clock.block = this.clock.chain;
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
    return {
      phase,
      arrival,
      landReady,
      clock: { ...this.clock },
      onNewLand: this.onNewLand,
      events: this.events,
      pose,
      veil: this.veil?.getSnapshot() ?? null,
    };
  }

  dispose(): void {
    this.stopTurn?.();
    if (this.blockTimer) clearTimeout(this.blockTimer);
    this.unsubscribe?.();
    useDayEndStore.getState().rest();
    this.veil?.dispose();
    this.context = null;
  }

  /** The rollover watching again, from a clock it has not seen turn. */
  private watchFrom(seconds: number): void {
    this.stopTurn?.();
    this.clock = { chain: seconds, block: seconds };
    this.stopTurn = watchDayTurn(this.world());
  }

  private world(): DayTurnWorld {
    return {
      store: this.facts.store,
      gameId: 1,
      player: "0x111",
      chainNow: () => this.clock.chain,
      blockNow: () => this.clock.block,
      reproject: () => this.reproject(),
      navigate: (position) => this.navigate(position),
    };
  }

  /** The rollover's re-projection: the map on the new day. */
  private reproject(): void {
    this.events.push({ kind: "reproject", phase: useDayEndStore.getState().phase });
    this.presentNewLand();
  }

  /** The realm's new land, only the realm on it: dark until the dawn, or lit at once when it is already day. */
  private presentNewLand(): void {
    const { terrain } = this.requireContext();
    const phase = useDayEndStore.getState().phase;
    this.veil?.showOnlyOwnRealm(true);
    terrain.cancelShroudReveals();
    terrain.present([this.requirePages().night]);
    this.onNewLand = true;
    this.revealed = false;
    if (phase === "day" || phase === "dawn") this.reveal();
  }

  /** The camera sent to the realm's new site (logged in contract coordinates): here, down on the lab's realm. */
  private navigate(position: Position): void {
    const { x, y } = position.getContract();
    this.events.push({
      kind: "navigate",
      phase: useDayEndStore.getState().phase,
      position: { x: Number(x), y: Number(y) },
    });
    this.cut(this.pose("dawn"));
  }

  /** What the world does as each phase begins; the screen's summary, black and fades are the game's DayEndScreen. */
  private enter(phase: DayEndPhase): void {
    const { controls } = this.requireContext();
    controls.enabled = phase === "day";
    if (phase === "veil") this.film([{ t: 0 }, { t: 3, ...this.pose("veil") }]);
    if (phase === "dawn" && this.onNewLand) this.reveal();
  }

  /** The realm's new surroundings out of the shroud, as an explore reveals them, the camera easing out. */
  private reveal(): void {
    if (this.revealed) return;
    this.revealed = true;
    const { terrain } = this.requireContext();
    for (const hex of this.land.revealed) terrain.queueShroudReveal(hex.col, hex.row, this.land.realm);
    terrain.present([this.requirePages().dawn]);
    this.film([{ t: 0 }, { t: 2.4, ...this.pose("day"), ease: "out" }]);
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
