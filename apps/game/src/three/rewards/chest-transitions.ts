import { type ChestPrize, ChestRewardReveal } from "./chest-reward-reveal";
import { AnimationMixer, Group, Matrix4, Scene, Vector3 } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { PipelineCompiler } from "../pipeline-compiler";
import { RewardSummoning } from "./reward-summoning";
import { ChestPresentation } from "./chest-presentation";

interface ChestTransition {
  root: Group;
  object: Group;
  mixer: AnimationMixer;
  effect: RewardSummoning;
  presentation: ChestPresentation;
  reward?: ChestRewardReveal;
  tileKey?: string;
  kind?: "summon" | "open";
  /** A presented chest's beats, which whatever plays beside it follows; and whether its lid has opened. */
  presenting?: { beats: ChestPresentationBeats; opened: boolean };
}

/**
 * What a presented chest tells whatever plays beside it, as they happen on the chest's own clock: it is shown, its lid
 * opens, and it ends. It ends exactly once, however it goes: absorbed, cancelled, cleared with its chunk or the scene,
 * or replaced by another presentation in its place. Nothing beside it keeps time of its own.
 */
export interface ChestPresentationBeats {
  onShown(): void;
  onOpen(): void;
  onEnd(): void;
}

/** A chest's glow as it opens: its rarity's colour leaking from the lid, on its runes and up its beams. */
export type ChestGlow = Parameters<RewardSummoning["setGlow"]>[0];

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
    // A presentation in this slot ends before anything else takes it.
    if (this.active.get(tileKey)?.presenting) this.cancel(tileKey);
    const actor = this.active.get(tileKey) ?? this.actors.find((candidate) => candidate.tileKey === undefined);
    if (!actor) return false;
    if (actor.tileKey === tileKey && actor.kind === kind) return true;
    actor.reward?.dispose();
    actor.reward = undefined;
    actor.effect.clearGlow();
    placement.decompose(actor.root.position, actor.root.quaternion, actor.root.scale);
    actor.tileKey = tileKey;
    actor.kind = kind;
    actor.root.visible = true;
    actor.mixer.setTime(animationTime);
    actor.effect.seek(kind === "summon" ? 0 : 1);
    if (kind === "open") actor.effect.open();
    actor.effect.update(0, animationTime);
    actor.presentation.setOpening(kind === "open");
    this.active.set(tileKey, actor);
    return true;
  }

  /**
   * A chest that arrives (its summon), then opens by itself, glowing in `glow` when it has one, and goes once absorbed:
   * a reward staged on its own, with nothing to press. What it gives is shown beside it, on `beats`. A presentation
   * already in the slot ends first, and this one starts afresh: its own placement, glow and summon.
   */
  present(
    tileKey: string,
    placement: Matrix4,
    animationTime: number,
    beats: ChestPresentationBeats,
    glow?: ChestGlow,
  ): boolean {
    this.cancel(tileKey);
    if (!this.start(tileKey, "summon", placement, animationTime)) return false;
    const actor = this.active.get(tileKey)!;
    actor.presenting = { beats, opened: false };
    if (glow) actor.effect.setGlow(glow);
    beats.onShown();
    return true;
  }

  has(tileKey: string): boolean {
    return this.active.has(tileKey);
  }

  hasRewardReveals(): boolean {
    return [...this.active.values()].some((actor) => Boolean(actor.reward));
  }

  revealReward(tileKey: string, prizes: readonly ChestPrize[]): void {
    const actor = this.active.get(tileKey);
    if (!actor || actor.reward) return;
    actor.reward = new ChestRewardReveal(prizes);
    actor.root.add(actor.reward.label);
    actor.reward.update(actor.effect.openingElapsed);
  }

  revealProgress(tileKey: string): number {
    const actor = this.active.get(tileKey);
    if (actor?.kind === "open") return 0;
    return actor?.kind === "summon" ? actor.effect.revealProgress : 1;
  }

  update(delta: number, animationTime: number, cameraPosition?: Vector3, nightAmount = 0): boolean {
    if (!this.active.size) return false;
    for (const [tileKey, actor] of this.active) {
      actor.mixer.setTime(animationTime);
      actor.effect.update(delta, animationTime);
      if (actor.presenting && !actor.presenting.opened && actor.effect.isSummoned) this.openPresented(actor);
      actor.presentation.setOpening(actor.kind === "open");
      actor.presentation.setNightAmount(nightAmount);
      if (cameraPosition) actor.presentation.faceCamera(cameraPosition);
      actor.reward?.update(actor.effect.openingElapsed);
      const finished = actor.kind === "summon" ? actor.effect.isSummoned : actor.effect.isAbsorbed;
      if (finished) this.cancel(tileKey);
    }
    return true;
  }

  /** A presented chest has arrived: its lid opens, and it says so. */
  private openPresented(actor: ChestTransition): void {
    actor.presenting!.opened = true;
    actor.kind = "open";
    actor.effect.open();
    actor.presenting!.beats.onOpen();
  }

  cancel(tileKey: string): void {
    const actor = this.active.get(tileKey);
    if (!actor) return;
    actor.root.visible = false;
    actor.reward?.dispose();
    actor.reward = undefined;
    const ending = actor.presenting;
    actor.presenting = undefined;
    actor.tileKey = undefined;
    actor.kind = undefined;
    this.active.delete(tileKey);
    ending?.beats.onEnd();
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
