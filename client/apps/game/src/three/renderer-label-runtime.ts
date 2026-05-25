import type { Camera, Object3D, Object3DEventMap } from "three";
import { CSS2DRenderer } from "three-stdlib";
import { resolveLabelRenderDecision, resolveLabelRenderIntervalMs } from "./game-renderer-policy";

export type RendererLabelCadenceView = "close" | "medium" | "far" | undefined;

export interface RendererLabelRuntime {
  initialize(): Promise<void>;
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

interface WaitForRendererLabelElementInput {
  getElementById: (id: string) => HTMLDivElement | null;
  isDisposed: () => boolean;
  requestAnimationFrame: (callback: () => void) => void;
}

export function createRendererLabelRuntime(input: CreateRendererLabelRuntimeInput): RendererLabelRuntime {
  return new GameRendererLabelRuntime(input);
}

export function waitForRendererLabelElement(input: WaitForRendererLabelElementInput): Promise<HTMLDivElement> {
  return new Promise((resolve, reject) => {
    const warnAfterAttempts = 300;
    let attempts = 0;

    const checkElement = () => {
      if (input.isDisposed()) {
        reject(new Error("GameRenderer destroyed while waiting for label renderer element"));
        return;
      }

      const element = input.getElementById("labelrenderer");
      if (element) {
        resolve(element);
        return;
      }

      attempts++;
      if (attempts === warnAfterAttempts) {
        console.warn("GameRenderer: labelrenderer element not found yet; continuing to wait for world UI to mount");
      }

      input.requestAnimationFrame(checkElement);
    };

    checkElement();
  });
}

class GameRendererLabelRuntime implements RendererLabelRuntime {
  private renderer?: CSS2DRenderer;
  private labelRendererElement?: HTMLDivElement;
  private labelsDirty = true;
  private lastLabelRenderTime = 0;
  private lastLabelsActive = false;
  private isDisposed = false;

  constructor(private readonly input: CreateRendererLabelRuntimeInput) {}

  public async initialize(): Promise<void> {
    if (this.renderer || this.isDisposed) {
      return;
    }

    const labelRendererElement = await waitForRendererLabelElement({
      getElementById: (id) => document.getElementById(id) as HTMLDivElement | null,
      isDisposed: () => this.isDisposed,
      requestAnimationFrame,
    });
    if (this.isDisposed) {
      return;
    }

    this.labelRendererElement = labelRendererElement;
    this.renderer = new CSS2DRenderer({ element: labelRendererElement });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public isReady(): boolean {
    return Boolean(this.renderer);
  }

  public markDirty(): void {
    this.labelsDirty = true;
  }

  public resize(width: number, height: number): void {
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
    this.renderer?.render(scene as never, camera as never);
  }

  public dispose(): void {
    this.isDisposed = true;
    this.labelRendererElement?.replaceChildren();
    this.renderer = undefined;
    this.labelRendererElement = undefined;
  }
}
