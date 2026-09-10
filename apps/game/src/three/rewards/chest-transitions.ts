import { ChestRelicReveal } from "./chest-relic-reveal";
import { AnimationMixer, Group, Matrix4, Scene, Vector3 } from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import type { PipelineCompiler } from "../pipeline-compiler";
import { RewardSummoning } from "./reward-summoning";
import { ChestPresentation } from "./chest-presentation";

interface ChestTransition {
  root: Group;
  mixer: AnimationMixer;
  effect: RewardSummoning;
  presentation: ChestPresentation;
  relics?: ChestRelicReveal;
  tileKey?: string;
  kind?: "summon" | "open";
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
      this.actors.push({ root, mixer, effect, presentation });
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
    if (actor?.kind === "open") return 0;
    return actor?.kind === "summon" ? actor.effect.revealProgress : 1;
  }

  update(delta: number, animationTime: number, cameraPosition?: Vector3, nightAmount = 0): boolean {
    if (!this.active.size) return false;
    for (const [tileKey, actor] of this.active) {
      actor.mixer.setTime(animationTime);
      actor.effect.update(delta, animationTime);
      actor.presentation.setNightAmount(nightAmount);
      if (cameraPosition) actor.presentation.faceCamera(cameraPosition);
      actor.relics?.update(actor.effect.openingElapsed);
      if (actor.kind === "summon" ? actor.effect.isSummoned : actor.effect.isAbsorbed) this.cancel(tileKey);
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
