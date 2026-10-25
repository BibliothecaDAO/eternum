import type { RendererActiveMode } from "./renderer-backend";
import { buildRendererRecoveryUrl } from "./renderer-build-mode";

/**
 * A lost GPU takes every buffer, texture and pipeline the scenes made with it, so the page boots again, its route kept:
 * on WebGL after a lost WebGPU device (native WebGPU instance matrices use storage attributes WebGL cannot carry), on
 * the same renderer after a lost WebGL context. A phone loses its tab's context in the background, so the boot waits
 * until the page is seen again.
 */
export function rebootAfterDeviceLoss(lostMode: RendererActiveMode, page: Pick<Window, "document" | "location">): void {
  const href = lostMode === "webgpu" ? buildRendererRecoveryUrl(page.location.href) : page.location.href;
  whenSeen(page.document, () => page.location.replace(href));
}

const whenSeen = (document: Document, run: () => void): void => {
  if (document.visibilityState === "visible") return run();
  const onShown = () => {
    if (document.visibilityState !== "visible") return;
    document.removeEventListener("visibilitychange", onShown);
    run();
  };
  document.addEventListener("visibilitychange", onShown);
};
