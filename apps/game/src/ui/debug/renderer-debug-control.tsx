import { snapshotRendererDiagnostics } from "@/three/renderer-diagnostics";
import {
  buildRendererDebugUrl,
  readRendererPreference,
  resolveRendererBuildModeFromSearch,
  type RendererBuildMode,
} from "@/three/renderer-build-mode";
import { env } from "../../../env";

interface RendererDebugControlProps {
  className?: string;
}

/** The two backends a player can ask for; asking reloads the game with the choice in its address. */
export const RENDERER_MODES: ReadonlyArray<{ label: string; mode: RendererBuildMode }> = [
  { label: "WebGPU", mode: "webgpu-auto" },
  { label: "WebGL2", mode: "webgpu-force-webgl" },
];

const formatActiveMode = (activeMode: ReturnType<typeof snapshotRendererDiagnostics>["activeMode"]): string => {
  if (activeMode === "webgpu") return "WebGPU";
  if (activeMode === "webgl2-fallback") return "WebGL2";
  return "Pending";
};

/**
 * The backend this page load asked for: the renderer's own record once it booted, else what the boot would ask for,
 * read once, so a choice saved since does not pass for the one loaded.
 */
export const requestedRendererMode = (): RendererBuildMode =>
  snapshotRendererDiagnostics().requestedMode ?? pageRendererMode();

let pageMode: RendererBuildMode | null = null;
const pageRendererMode = (): RendererBuildMode =>
  (pageMode ??= resolveRendererBuildModeFromSearch({
    envBuildMode: env.VITE_PUBLIC_RENDERER_BUILD_MODE,
    saved: readRendererPreference(localStorage),
    search: window.location.search,
  }));

/**
 * The boot and error screens' switch: the backend in use, a reload with either, and why it fell back, on what
 * adapter.
 */
export const RendererDebugControl = ({ className = "" }: RendererDebugControlProps) => {
  // Each host mounts after renderer init or already rerenders while booting, so this snapshot needs no subscription.
  const diagnostics = snapshotRendererDiagnostics();
  const currentHref = window.location.href;
  const requestedMode = requestedRendererMode();
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
        {RENDERER_MODES.map(({ label, mode }) => {
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

      {diagnostics.fallbackReason ? (
        <div className="mt-1 truncate text-amber-300/80" title={diagnostics.fallbackReason}>
          {diagnostics.fallbackReason}
        </div>
      ) : null}
      {adapter ? (
        <div className="mt-1 truncate text-kit-muted" title={adapter}>
          {adapter}
        </div>
      ) : null}
      <div className="mt-1 text-kit-muted">Reloads with console diagnostics for that page load.</div>
    </div>
  );
};
