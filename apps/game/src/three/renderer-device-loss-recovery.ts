import { buildRendererRecoveryUrl } from "./renderer-build-mode";

export function reloadWithWebGLRenderer(): void {
  window.location.replace(buildRendererRecoveryUrl(window.location.href));
}
