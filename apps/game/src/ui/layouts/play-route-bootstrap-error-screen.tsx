import { RendererDebugControl } from "@/ui/debug/renderer-debug-control";
import { BootLoaderShell } from "@/ui/modules/boot-loader";

interface PlayRouteBootstrapErrorScreenProps {
  error: Error | null;
  onRetry: () => void;
  onReturnToDashboard: () => void;
}

const actionClassName =
  "rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold transition hover:bg-gold/20";

/** Keeps world/bootstrap failures out of account recovery, especially for anonymous spectators. */
export const PlayRouteBootstrapErrorScreen = ({
  error,
  onRetry,
  onReturnToDashboard,
}: PlayRouteBootstrapErrorScreenProps) => (
  <BootLoaderShell
    mode="indeterminate"
    title="Unable to Start"
    subtitle="The world could not finish loading. Retry, or return to the dashboard."
    caption="Bootstrap Error"
    detail={
      <div className="flex flex-col items-center gap-3">
        {error?.message ? (
          <p role="alert" className="max-w-md rounded bg-black/30 px-3 py-2 text-center font-mono text-xs text-red-300">
            {error.message}
          </p>
        ) : null}
        <RendererDebugControl className="w-full max-w-md" />
        <button type="button" onClick={onRetry} className={actionClassName}>
          Retry Bootstrap
        </button>
        <button type="button" onClick={onReturnToDashboard} className={actionClassName}>
          Return to Dashboard
        </button>
      </div>
    }
  />
);
