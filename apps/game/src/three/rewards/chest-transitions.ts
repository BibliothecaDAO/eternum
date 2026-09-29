import { ChestRelicReveal } from "./chest-relic-reveal";
import { AnimationMixer, Group, Matrix4, Scene, Vector3 } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { PipelineCompiler } from "../pipeline-compiler";
import { RewardSummoning } from "./reward-summoning";
import { ChestPresentation } from "./chest-presentation";
import { type ChestBeat, ChestOpeningBeats } from "./chest-opening-beats";

interface ChestTransition {
  root: Group;
  object: Group;
  mixer: AnimationMixer;
  effect: RewardSummoning;
  presentation: ChestPresentation;
  relics?: ChestRelicReveal;
  tileKey?: string;
  kind?: "summon" | "open" | "hold";
  /** A Frontier chest held for its moment: its beats, and where to read the moment each frame. */
  beats?: ChestOpeningBeats;
  readBeat?: () => ChestBeat | null;
}

/** A bounded, precompiled pool for transient effects; persistent chests stay instanced. */
export class ChestTransitions {
  readonly group = new Group();
  private readonly actors: ChestTransition[] = [];
  private readonly active = new Map<string, ChestTransition>();

  constructor(gltf: GLTF) {
    for (let index = 0; index < 4; index++) {
      const root = new Group();
      const object = gltf.scene.clone(true);
      root.add(object);
      const presentation = new ChestPresentation(object);
      const mixer = new AnimationMixer(object);
      gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
      // Radiant interior surfaces and beams light the opening without adding
      // per-chest lights to every terrain/material pipeline in the world.
      const effect = new RewardSummoning(object, root, false);
      root.visible = false;
      this.group.add(root);
      this.actors.push({ root, object, mixer, effect, presentation });
    }
  }

  async prepare(compile: PipelineCompiler, scene: Scene): Promise<void> {
    const visibility = new Map<Group["children"][number], boolean>();
    this.group.traverse((object) => {
      visibility.set(object, object.visible);
      object.visible = true;
    });
    try {
      await compile(this.group, scene);
    } finally {
      visibility.forEach((visible, object) => {
        object.visible = visible;
      });
    }
  }

  start(tileKey: string, kind: "summon" | "open", placement: Matrix4, animationTime: number): boolean {
    const actor = this.active.get(tileKey) ?? this.actors.find((candidate) => candidate.tileKey === undefined);
    if (!actor) return false;
    if (actor.tileKey === tileKey && actor.kind === kind) return true;
    // A chest held for its moment opens on the moment's burst, not when its fact goes.
    if (actor.tileKey === tileKey && actor.kind === "hold" && kind === "open") return true;
    actor.relics?.dispose();
    actor.relics = undefined;
    placement.decompose(actor.root.position, actor.root.quaternion, actor.root.scale);
    actor.tileKey = tileKey;
    actor.kind = kind;
    actor.root.visible = true;
    actor.mixer.setTime(animationTime);
    actor.effect.seek(kind === "summon" ? 0 : 1);
    if (kind === "open") actor.effect.open();
    actor.effect.update(0, animationTime);
    this.active.set(tileKey, actor);
    return true;
  }

  /**
   * Holds a closed chest on its tile for a Frontier chest moment: summoned and shut, it plays the moment's beats read
   * each frame, opens on the burst and sinks away as an opened chest does. A moment that ends before its burst lets the
   * chest go back to its tile.
   */
  hold(tileKey: string, placement: Matrix4, animationTime: number, readBeat: () => ChestBeat | null): boolean {
    const actor = this.active.get(tileKey) ?? this.actors.find((candidate) => candidate.tileKey === undefined);
    if (!actor) return false;
    placement.decompose(actor.root.position, actor.root.quaternion, actor.root.scale);
    actor.tileKey = tileKey;
    actor.kind = "hold";
    actor.root.visible = true;
    actor.mixer.setTime(animationTime);
    actor.effect.seek(1);
    actor.beats = new ChestOpeningBeats(actor.object, actor.effect);
    actor.readBeat = readBeat;
    this.active.set(tileKey, actor);
    return true;
  }

  has(tileKey: string): boolean {
    return this.active.has(tileKey);
  }

  hasRelicReveals(): boolean {
    return [...this.active.values()].some((actor) => Boolean(actor.relics));
  }

  revealRelics(tileKey: string, relics: readonly number[]): void {
    const actor = this.active.get(tileKey);
    if (!actor || actor.relics) return;
    actor.relics = new ChestRelicReveal(relics);
    actor.root.add(actor.relics.label);
    actor.relics.update(actor.effect.openingElapsed);
  }

  revealProgress(tileKey: string): number {
    const actor = this.active.get(tileKey);
    if (actor?.kind === "open" || actor?.kind === "hold") return 0;
    return actor?.kind === "summon" ? actor.effect.revealProgress : 1;
  }

  update(delta: number, animationTime: number, cameraPosition?: Vector3, nightAmount = 0): boolean {
    if (!this.active.size) return false;
    for (const [tileKey, actor] of this.active) {
      const beat = actor.readBeat?.() ?? null;
      if (actor.kind === "hold" && !beat && !actor.beats?.hasOpened) {
        this.cancel(tileKey);
        continue;
      }
      actor.mixer.setTime(animationTime);
      actor.effect.update(delta, animationTime);
      if (beat) actor.beats?.update(beat, performance.now());
      actor.presentation.setNightAmount(nightAmount);
      if (cameraPosition) actor.presentation.faceCamera(cameraPosition);
      actor.relics?.update(actor.effect.openingElapsed);
      const finished =
        actor.kind === "summon"
          ? actor.effect.isSummoned
          : actor.kind === "hold"
            ? Boolean(actor.beats?.hasOpened) && actor.effect.isAbsorbed
            : actor.effect.isAbsorbed;
      if (finished) this.cancel(tileKey);
    }
    return true;
  }

  cancel(tileKey: string): void {
    const actor = this.active.get(tileKey);
    if (!actor) return;
    actor.root.visible = false;
    actor.relics?.dispose();
    actor.relics = undefined;
    actor.tileKey = undefined;
    actor.kind = undefined;
    // A pooled actor goes back to the plain chest: no tint, full beams, upright and full size.
    if (actor.beats) {
      actor.effect.clearGlow();
      actor.object.scale.setScalar(1);
      actor.object.rotation.z = 0;
    }
    actor.beats = undefined;
    actor.readBeat = undefined;
    this.active.delete(tileKey);
  }

  clear(): void {
    for (const tileKey of this.active.keys()) this.cancel(tileKey);
  }

  dispose(): void {
    this.clear();
    this.group.removeFromParent();
    for (const actor of this.actors) {
      actor.effect.dispose();
      actor.presentation.dispose();
      actor.mixer.stopAllAction();
      actor.mixer.uncacheRoot(actor.mixer.getRoot());
    }
  }
}
