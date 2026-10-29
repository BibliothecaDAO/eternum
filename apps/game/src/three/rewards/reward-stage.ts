import {
  DirectionalLight,
  HemisphereLight,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
} from "three";

import { HUD_COLORS } from "@/tokens";
import type { RendererOverlayPass } from "../renderer-backend";
import type { ChestGlow, ChestPresentationBeats, ChestTransitions } from "./chest-transitions";

/** The transition slot of the chest a reward stages: it stands on no tile. */
const CENTRE_KEY = "centre";
/** How long the veil takes to fall over the board, and to lift: the HUD's veil over its panels takes the same. */
export const CHEST_VEIL_SECONDS = 0.35;
/** How much of the screen's height the staged chest fills, whatever the map's zoom (owner's pick B, 2026-10-28). */
const STAGE_SCREEN_SHARE = 0.22;
/** How dark the board goes behind the chest: the veil's opacity, in the HUD's ink. */
const BOARD_VEIL_OPACITY = 0.88;

/** What staging needs once the chest's model is ready: the stage's chest pool, and its animation clock. */
export interface ReadyStage {
  transitions: ChestTransitions;
  time: number;
}

/**
 * The one chest a reward stages, drawn over everything: after the map, in two passes of its own, first a veil that
 * darkens the whole board, then the chest with its own camera and light, centred on the screen (the renderer clears
 * depth before each pass). Like a card pulled out of the board toward the player, nothing of the map, no model and no
 * label stands over or beside it.
 *
 * From its request to its end, its model's loading included, each request is a generation: ending the stage (the map is
 * left) or a newer request makes every earlier one stale, and a stale request stages and announces nothing once its
 * loading finishes, however late, even after the map is entered again.
 */
export class RewardStage {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(45, 1, 0.1, 100);
  /** The board's veil: a quad over the whole view, in a pass of its own under the chest's. */
  private readonly veil = new Mesh(
    new PlaneGeometry(2, 2),
    new MeshBasicMaterial({
      color: HUD_COLORS.ink,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  private readonly veilPass: RendererOverlayPass = {
    name: "reward-stage-veil",
    scene: new Scene(),
    camera: new OrthographicCamera(-1, 1, 1, -1, 0, 2),
  };
  private readonly chestPass: RendererOverlayPass = { name: "reward-stage", scene: this.scene, camera: this.camera };
  /** How far the veil has fallen, from 0 (lifted) to 1. */
  private veilAmount = 0;
  private generation = 0;
  private transitions?: ChestTransitions;

  /** `prepare` loads what the chest needs; null when it cannot stand. */
  constructor(private readonly prepare: () => Promise<ReadyStage | null>) {
    this.veil.position.z = -1;
    this.veilPass.scene.add(this.veil);
    this.camera.add(stageKeyLight());
    this.scene.add(this.camera, stageSkyLight());
  }

  async present(beats: ChestPresentationBeats, glow?: ChestGlow): Promise<boolean> {
    const generation = ++this.generation;
    const ready = await this.prepare();
    if (generation !== this.generation || !ready) return false;
    this.hold(ready.transitions);
    return ready.transitions.present(CENTRE_KEY, new Matrix4(), ready.time, beats, glow);
  }

  /** Ends the staged chest, if one stands, every request still loading, and the veil at once: the map is left. */
  end(): void {
    this.generation++;
    this.transitions?.cancel(CENTRE_KEY);
    this.setVeil(0);
  }

  /** A frame: the stage looks as the map's camera does, the veil falls or lifts, and the chest plays on its clock. */
  update(delta: number, animationTime: number, view: PerspectiveCamera): void {
    if (!this.passes().length) return;
    this.frame(view);
    const step = delta / CHEST_VEIL_SECONDS;
    this.setVeil(this.isPresenting() ? this.veilAmount + step : this.veilAmount - step);
    this.transitions?.update(delta, animationTime, this.camera.position);
  }

  /** The veil while it is down or lifting, then the chest while it stands; nothing otherwise, so it costs nothing. */
  passes(): RendererOverlayPass[] {
    return [...(this.veilAmount > 0 ? [this.veilPass] : []), ...(this.isPresenting() ? [this.chestPass] : [])];
  }

  dispose(): void {
    this.end();
    this.veil.geometry.dispose();
    this.veil.material.dispose();
  }

  private isPresenting(): boolean {
    return this.transitions?.has(CENTRE_KEY) ?? false;
  }

  private hold(transitions: ChestTransitions): void {
    this.transitions = transitions;
    if (transitions.group.parent !== this.scene) this.scene.add(transitions.group);
  }

  /**
   * The map camera's angle, field and shape, at the distance where the chest (one unit from its centre to a corner)
   * fills the stage's share of the screen: the chest is seen as the board is, at one size whatever the zoom.
   */
  private frame(view: PerspectiveCamera): void {
    const halfFov = MathUtils.degToRad(view.fov) / 2;
    this.camera.fov = view.fov;
    this.camera.aspect = view.aspect;
    this.camera.quaternion.copy(view.quaternion);
    this.camera.position.set(0, 0, 1 / (STAGE_SCREEN_SHARE * 2 * Math.tan(halfFov))).applyQuaternion(view.quaternion);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  private setVeil(amount: number): void {
    this.veilAmount = MathUtils.clamp(amount, 0, 1);
    this.veil.material.opacity = BOARD_VEIL_OPACITY * this.veilAmount;
  }
}

/** The stage's key light, over the viewer's left shoulder whatever the camera's angle: the chest always in daylight. */
const stageKeyLight = (): DirectionalLight => {
  const light = new DirectionalLight(0xfff1dc, 3.2);
  light.position.set(-2, 3, 2);
  return light;
};

/** The stage's sky: a warm fill from above and the realm's violet from below, as the board's own light is. */
const stageSkyLight = (): HemisphereLight => new HemisphereLight(0xfff6e8, 0x6a3a6a, 2.8);
