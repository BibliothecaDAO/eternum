import { useWorldAppearanceStore } from "@/hooks/store/use-world-appearance-store";
import type { HexagonScene } from "../scenes/hexagon-scene";
import type { SceneName } from "../types";
import { SceneFlight, canFlyBetweenScenes } from "./scene-flight";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { useUIStore } from "@/hooks/store/use-ui-store";

const FADE_DURATION = 300;

export class TransitionManager {
  private fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private resolveFadeOut: ((completed: boolean) => void) | null = null;
  private destroyed = false;
  private flight: SceneFlight | null = null;

  startSceneFlight(
    scene: HexagonScene | undefined,
    from: SceneName | undefined,
    to: SceneName,
  ): Promise<boolean> | null {
    if (this.destroyed || !scene || !canFlyBetweenScenes(from, to, useWorldAppearanceStore.getState().reducedMotion))
      return null;
    this.cancelPendingFadeOut();
    this.flight?.destroy();
    this.flight = new SceneFlight(scene, to);
    return this.flight.flyOut();
  }

  onFrameRendered(source: HTMLCanvasElement, sceneName: SceneName): void {
    this.flight?.onFrameRendered(source, sceneName);
  }

  fadeOut(): Promise<boolean> {
    if (this.destroyed) {
      return Promise.resolve(false);
    }

    this.cancelPendingFadeOut();
    this.flight?.destroy();
    this.flight = null;

    const { setIsLoadingScreenEnabled } = useUIStore.getState();
    setIsLoadingScreenEnabled(true);
    return new Promise((resolve) => {
      this.resolveFadeOut = resolve;
      this.fadeTimeoutId = setTimeout(() => this.completeFadeOut(), FADE_DURATION);
    });
  }

  fadeIn(scene?: HexagonScene) {
    if (scene) this.flight?.reveal(scene);
    this.cancelPendingFadeOut();
    useUIStore.getState().setIsLoadingScreenEnabled(false);
    useTooltipStore.getState().setTooltip(null);
  }

  isActive() {
    return !this.destroyed;
  }

  destroy() {
    this.destroyed = true;
    this.flight?.destroy();
    this.flight = null;
    this.cancelPendingFadeOut();
  }

  private completeFadeOut() {
    const resolve = this.resolveFadeOut;
    this.fadeTimeoutId = null;
    this.resolveFadeOut = null;
    resolve?.(true);
  }

  private cancelPendingFadeOut() {
    if (this.fadeTimeoutId) {
      clearTimeout(this.fadeTimeoutId);
      this.fadeTimeoutId = null;
    }

    const resolve = this.resolveFadeOut;
    this.resolveFadeOut = null;
    resolve?.(false);
  }
}
