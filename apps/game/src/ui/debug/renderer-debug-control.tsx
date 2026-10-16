import { snapshotRendererDiagnostics } from "@/three/renderer-diagnostics";
import {
  buildRendererDebugUrl,
  resolveRendererBuildModeFromSearch,
  type RendererBuildMode,
} from "@/three/renderer-build-mode";
import { env } from "../../../env";

interface RendererDebugControlProps {
  className?: string;
  /** Boot and error screens show the fallback reason and adapter; Settings shows only the switch. */
  diagnostics?: boolean;
}

const rendererModes: ReadonlyArray<{ label: string; mode: RendererBuildMode }> = [
  { label: "WebGPU", mode: "webgpu-auto" },
  { label: "WebGL2", mode: "webgpu-force-webgl" },
];

const formatActiveMode = (activeMode: ReturnType<typeof snapshotRendererDiagnostics>["activeMode"]): string => {
  if (activeMode === "webgpu") return "WebGPU";
  if (activeMode === "webgl2-fallback") return "WebGL2";
  return "Pending";
};

export const RendererDebugControl = ({
  className = "",
  diagnostics: showDiagnostics = true,
}: RendererDebugControlProps) => {
  // Each host mounts after renderer init or already rerenders while booting, so this snapshot needs no subscription.
  const diagnostics = snapshotRendererDiagnostics();
  const currentHref = window.location.href;
  const currentUrl = new URL(currentHref);
  const requestedMode =
    diagnostics.requestedMode ??
    resolveRendererBuildModeFromSearch({
      envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
      search: currentUrl.search,
    });
  const adapter = diagnostics.adapterInfo?.description || diagnostics.adapterInfo?.vendor || null;

  return (
    <div
      className={`pointer-events-auto rounded-md border border-gold/20 bg-black/75 px-3 py-2 font-mono text-sm text-gold/70 backdrop-blur ${className}`}
      data-testid="renderer-debug-control"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-kit-muted">Renderer</span>
        <span className="text-gold/90" data-testid="renderer-active-mode">
          {formatActiveMode(diagnostics.activeMode)}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1" role="group" aria-label="Renderer backend">
        {rendererModes.map(({ label, mode }) => {
          const isRequested = requestedMode === mode;
          return (
            <a
              key={mode}
              href={buildRendererDebugUrl(currentHref, mode)}
              className={`rounded border px-2 py-1 text-center transition max-lg:flex max-lg:min-h-11 max-lg:items-center max-lg:justify-center ${
                isRequested
                  ? "border-gold/60 bg-gold/20 text-gold"
                  : "border-gold/20 bg-black/30 text-kit-muted hover:bg-gold/10 hover:text-gold"
              }`}
              aria-label={`Reload with ${label}`}
              aria-current={isRequested ? "true" : undefined}
              title={isRequested ? `Retry ${label}` : `Switch to ${label}`}
            >
              {label}
            </a>
          );
        })}
      </div>

      {showDiagnostics && diagnostics.fallbackReason ? (
        <div className="mt-1 truncate text-amber-300/80" title={diagnostics.fallbackReason}>
          {diagnostics.fallbackReason}
        </div>
      ) : null}
      {showDiagnostics && adapter ? (
        <div className="mt-1 truncate text-kit-muted" title={adapter}>
          {adapter}
        </div>
      ) : null}
      {showDiagnostics && (
        <div className="mt-1 text-kit-muted">Reloads with console diagnostics for that page load.</div>
      )}
    </div>
  );
};
