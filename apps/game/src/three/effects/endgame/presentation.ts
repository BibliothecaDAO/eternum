import { Group, Mesh, PlaneGeometry, Vector3, type Scene } from "three";
import { color, float, mix, mx_noise_float, positionWorld, smoothstep, vec3 } from "three/tsl";
import MeshBasicNodeMaterial from "three/src/materials/nodes/MeshBasicNodeMaterial.js";
import { terrainHexToWorld } from "@/three/terrain/terrain-coordinates";
import type { TerrainSurface } from "@/three/terrain/terrain-surface";
import type { SpireModel } from "@/three/structures/spire-model";
import { ENDGAME_SEQUENCE, endgameFrame } from "./sequence";
import type { EndgamePlan } from "./plan";
import type { PipelineCompiler } from "@/three/pipeline-compiler";
import {
  applyEndgameFrost,
  configureEndgameField,
  endgameAllowed,
  endgameBoundary,
  endgameClock,
  endgameCovered,
  endgameNoise,
  endgameReach,
  endgameSettle,
} from "./field";
import { SpireEndEvent } from "./spire-event";

/** The live map and the smoke lab render this same event; terrain and native facts are never rewritten. */
export class MapEndPresentation {
  private readonly mist: Mesh<PlaneGeometry, MeshBasicNodeMaterial>;
  private readonly spires: SpireEndEvent;
  readonly object3d = new Group();
  private plan: EndgamePlan | null = null;
  constructor(
    private readonly model: SpireModel,
    private readonly surface: TerrainSurface,
  ) {
    const choice = ENDGAME_SEQUENCE;
    const wisps = mx_noise_float(
      vec3(
        positionWorld.x.mul(1.1).sub(endgameClock.mul(0.22)),
        positionWorld.z.mul(1.1).add(endgameNoise),
        endgameClock.mul(0.08),
      ),
    )
      .mul(0.5)
      .add(0.5);
    const rim = float(1).sub(smoothstep(choice.width * 0.25, choice.width, endgameReach.sub(endgameBoundary).abs()));
    const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, depthTest: false });
    material.name = "Fractured veil";
    material.colorNode = mix(color("#151923"), color("#879393"), endgameNoise.mul(0.28).add(wisps.mul(0.16)));
    const movingOpacity = rim.mul(choice.opacity).add(endgameNoise.mul(0.17).add(0.1)).clamp(0, 0.96);
    const frozenOpacity = float(choice.endOpacity).add(endgameNoise.mul(0.04));
    material.opacityNode = endgameCovered.mul(mix(movingOpacity, frozenOpacity, endgameSettle));
    this.mist = new Mesh(new PlaneGeometry(1, 1), material);
    this.mist.rotation.x = -Math.PI / 2;
    this.mist.renderOrder = 900;
    this.mist.frustumCulled = false;
    this.mist.raycast = () => {};
    this.mist.visible = false;
    this.spires = new SpireEndEvent(model, model.orbGeometry, true, 2, applyEndgameFrost, endgameAllowed);
    this.object3d.name = "Endgame presentation";
    this.object3d.add(model.group, this.mist, ...this.spires.meshes);
    this.object3d.visible = false;
  }

  /** Compile unbound asset instances off-scene; their first world positions come only from the native plan. */
  async prepare(compile: PipelineCompiler, scene: Scene): Promise<void> {
    this.object3d.visible = true;
    this.spires.update(endgameFrame(2.4));
    this.mist.visible = true;
    try {
      await compile(this.object3d, scene);
    } finally {
      this.object3d.visible = false;
      this.mist.visible = false;
    }
  }

  setPlan(plan: EndgamePlan | null): void {
    this.plan = plan;
    this.object3d.visible = plan !== null;
    if (plan) {
      this.spires.setSources(plan.sources.length, plan.sources[0]?.materialise ?? false);
      this.model.setCount(plan.sources.length);
    }
  }
  update(frame: ReturnType<typeof endgameFrame>): void {
    if (!this.plan) return;
    this.spires.update(frame);
    const origins = this.spires?.getSnapshot().orbOrigins.map((p) => new Vector3(p.x, p.y, p.z)) ?? [];
    if (!origins.length) {
      const p = terrainHexToWorld(this.plan.anchor.col, this.plan.anchor.row);
      origins.push(new Vector3(p.x, this.surface.sampleSurface(p.x, p.z).height, p.z));
    }
    configureEndgameField(this.plan, frame, origins);
    const a = terrainHexToWorld(this.plan.bounds.minCol, this.plan.bounds.minRow),
      b = terrainHexToWorld(this.plan.bounds.maxCol, this.plan.bounds.maxRow);
    this.mist.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    this.mist.scale.set(Math.max(32768, Math.abs(a.x - b.x) + 16), Math.max(32768, Math.abs(a.z - b.z) + 16), 1);
    this.mist.visible = frame.spread > 0;
  }
  getSnapshot() {
    if (!this.plan) return null;
    return {
      sparedHex: this.plan.sparedHex,
      spireSites: this.plan.sources,
      mistDraws: this.mist.visible ? 1 : 0,
      ...this.spires?.getSnapshot(),
    };
  }
  dispose(): void {
    this.object3d.removeFromParent();
    this.spires.dispose();
    this.mist.removeFromParent();
    this.mist.geometry.dispose();
    this.mist.material.dispose();
  }
}
