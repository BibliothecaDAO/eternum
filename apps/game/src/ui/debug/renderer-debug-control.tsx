import { snapshotRendererDiagnostics } from "@/three/renderer-diagnostics";
import {
  buildRendererDebugUrl,
  resolveRendererBuildModeFromSearch,
  type RendererBuildMode,
} from "@/three/renderer-build-mode";
import { env } from "../../../env";

interface RendererDebugControlProps {
  className?: string;
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

export const RendererDebugControl = ({ className = "" }: RendererDebugControlProps) => {
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
      className={`pointer-events-auto rounded-md border border-gold/20 bg-black/75 px-3 py-2 font-mono text-[10px] text-gold/70 backdrop-blur ${className}`}
      data-testid="renderer-debug-control"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="uppercase tracking-[0.16em] text-gold/45">Renderer</span>
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
              className={`rounded border px-2 py-1 text-center transition ${
                isRequested
                  ? "border-gold/60 bg-gold/20 text-gold"
                  : "border-gold/20 bg-black/30 text-gold/55 hover:bg-gold/10 hover:text-gold"
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

      {diagnostics.fallbackReason ? (
        <div className="mt-1 truncate text-amber-300/80" title={diagnostics.fallbackReason}>
          {diagnostics.fallbackReason}
        </div>
      ) : null}
      {adapter ? (
        <div className="mt-1 truncate text-gold/45" title={adapter}>
          {adapter}
        </div>
      ) : null}
      <div className="mt-1 text-gold/35">Reloads with console diagnostics for that page load.</div>
    </div>
  );
};
