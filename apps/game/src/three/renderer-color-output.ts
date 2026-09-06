import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import type { RendererSurfaceLike } from "./renderer-backend";

/** Keep terrain previews and the game on the same baseline color transform. */
export function configureRendererColorOutput(
  renderer: Pick<RendererSurfaceLike, "toneMapping" | "toneMappingExposure" | "outputColorSpace">,
): void {
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
}
