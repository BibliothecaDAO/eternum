import { BootLoaderShell } from "@/ui/modules/boot-loader";
import type { PlayRouteReconnectStatus } from "@/game-entry/play-route-boot";

interface PlayRouteReconnectScreenProps {
  onReconnect: () => void;
  onRetry: () => void;
  onReturnToDashboard: () => void;
  reconnectError: string | null;
  reconnectStatus: PlayRouteReconnectStatus;
  showRetry: boolean;
}

const actionClassName =
  "inline-flex min-w-[11rem] items-center justify-center rounded-lg border border-gold/30 bg-gold/10 px-4 py-2 font-['Space_Grotesk',ui-sans-serif,system-ui,sans-serif] text-sm font-semibold uppercase tracking-[0.18em] text-gold transition-colors hover:bg-gold/20 disabled:cursor-wait disabled:opacity-60";

const resolveReconnectActionLabel = (status: PlayRouteReconnectStatus): string => {
  if (status === "connecting") {
    return "Connecting...";
  }

  if (status === "failed") {
    return "Retry Connection";
  }

  return "Reconnect";
};

export const PlayRouteReconnectScreen = ({
  onReconnect,
  onRetry,
  onReturnToDashboard,
  reconnectError,
  reconnectStatus,
  showRetry,
}: PlayRouteReconnectScreenProps) => {
  const isManualAttemptPending = reconnectStatus === "connecting";

  return (
    <BootLoaderShell
      mode="indeterminate"
      title="Reconnect to Continue"
      subtitle="This world route is still valid. Reconnect your Cartridge Controller session and continue from here."
      caption="Session Recovery"
      detail={
        <div className="flex flex-col items-center gap-3">
          {reconnectError ? (
            <p role="alert" className="max-w-md text-center text-sm text-red-300">
              {reconnectError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onReconnect}
            className={actionClassName}
            disabled={isManualAttemptPending}
            aria-busy={isManualAttemptPending}
          >
            {resolveReconnectActionLabel(reconnectStatus)}
          </button>
          {showRetry ? (
            <button type="button" onClick={onRetry} className={actionClassName}>
              Retry Bootstrap
            </button>
          ) : null}
          <button type="button" onClick={onReturnToDashboard} className={actionClassName}>
            Return to Dashboard
          </button>
        </div>
      }
    />
  );
};
