import type { Camera, Object3D, Object3DEventMap } from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { runWithFrameWorkOwner } from "./frame-work-owner";
import { resolveLabelRenderDecision, resolveLabelRenderIntervalMs } from "./game-renderer-policy";
import { incrementWorldmapRenderCounter } from "./perf/worldmap-render-diagnostics";
import { keepLabelsBesideHudColumns } from "./utils/labels/hud-clearance";

export type RendererLabelCadenceView = "close" | "medium" | "far" | undefined;

export interface RendererLabelRuntime {
  /** Whether the world UI's label layer is mounted to draw into. */
  isReady(): boolean;
  markDirty(): void;
  resize(width: number, height: number): void;
  shouldRender(input: { cadenceView: RendererLabelCadenceView; labelsActive: boolean; now: number }): boolean;
  render(scene: Object3D<Object3DEventMap>, camera: Camera): void;
  dispose(): void;
}

interface CreateRendererLabelRuntimeInput {
  isMobileDevice: boolean;
}

export function createRendererLabelRuntime(input: CreateRendererLabelRuntimeInput): RendererLabelRuntime {
  return new GameRendererLabelRuntime(input);
}

/** The world UI's label layer (`ui/layouts/world.tsx`), while a game's page is mounted. */
const findLabelLayer = () => document.getElementById("labelrenderer") as HTMLDivElement | null;

/**
 * The scenes' labels draw into the world UI's label layer, which the renderer outlives: leaving a game keeps the game
 * booted for a return, while its page unmounts with the layer and the return mounts a new one. So the runtime follows
 * the layer mounted now, bound again whenever it changes (each label moves into it on the next draw), and draws nothing
 * while none is mounted.
 */
class GameRendererLabelRuntime implements RendererLabelRuntime {
  private renderer?: CSS2DRenderer;
  private labelLayer: HTMLDivElement | null = null;
  private size?: { width: number; height: number };
  private labelsDirty = true;
  private lastLabelRenderTime = 0;
  private lastLabelsActive = false;
  private isDisposed = false;

  constructor(private readonly input: CreateRendererLabelRuntimeInput) {}

  public isReady(): boolean {
    return Boolean(this.followMountedLayer());
  }

  public markDirty(): void {
    this.labelsDirty = true;
  }

  public resize(width: number, height: number): void {
    this.size = { width, height };
    this.markDirty();
    this.renderer?.setSize(width, height);
  }

  public shouldRender(input: { cadenceView: RendererLabelCadenceView; labelsActive: boolean; now: number }): boolean {
    const decision = resolveLabelRenderDecision({
      now: input.now,
      lastLabelRenderTime: this.lastLabelRenderTime,
      labelsDirty: this.labelsDirty,
      lastLabelsActive: this.lastLabelsActive,
      labelsActive: input.labelsActive,
      intervalMs: resolveLabelRenderIntervalMs(input.cadenceView, this.input.isMobileDevice),
    });

    this.labelsDirty = decision.nextLabelsDirty;
    this.lastLabelsActive = decision.nextLastLabelsActive;
    this.lastLabelRenderTime = decision.nextLastLabelRenderTime;

    return decision.shouldRender;
  }

  public render(scene: Object3D<Object3DEventMap>, camera: Camera): void {
    const renderer = this.followMountedLayer();
    if (!renderer) return;
    incrementWorldmapRenderCounter("css2dLabelRenders");
    runWithFrameWorkOwner("labels:css2d", () => {
      renderer.render(scene as never, camera as never);
      keepLabelsBesideHudColumns(renderer.domElement);
    });
  }

  public dispose(): void {
    this.isDisposed = true;
    this.labelLayer?.replaceChildren();
    this.renderer = undefined;
    this.labelLayer = null;
  }

  /** The renderer bound to the label layer mounted now, bound afresh when that layer is another than the last. */
  private followMountedLayer(): CSS2DRenderer | undefined {
    if (this.isDisposed) return undefined;
    const mounted = findLabelLayer();
    if (mounted !== this.labelLayer) this.bindTo(mounted);
    return this.renderer;
  }

  private bindTo(labelLayer: HTMLDivElement | null): void {
    this.labelLayer = labelLayer;
    this.renderer = labelLayer ? new CSS2DRenderer({ element: labelLayer }) : undefined;
    const size = this.size ?? { width: window.innerWidth, height: window.innerHeight };
    this.renderer?.setSize(size.width, size.height);
    this.markDirty();
  }
}
