import { BootLoaderShell } from "@/ui/modules/boot-loader";
import { useRequestSignIn } from "@/shell/sign-in/sign-in-route";

interface PlayRouteReconnectScreenProps {
  onReturnToDashboard: () => void;
  reconnectError: string | null;
}

const actionClassName =
  "rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold transition hover:bg-gold/20";

/**
 * A player route with no gameplay account and no session restoring one: the way into the sign-in flow, which brings the
 * player back to this route.
 */
export const PlayRouteReconnectScreen = ({ onReturnToDashboard, reconnectError }: PlayRouteReconnectScreenProps) => {
  const requestSignIn = useRequestSignIn();
  return (
    <BootLoaderShell
      mode="indeterminate"
      title="Sign in to Continue"
      subtitle="This world route is still valid. Sign in with your Realms account and your gameplay account is prepared here."
      caption="Account Recovery"
      detail={
        <div className="flex flex-col items-center gap-3">
          {reconnectError ? (
            <p role="alert" className="max-w-md text-center text-sm text-red-300">
              {reconnectError}
            </p>
          ) : null}
          <button type="button" onClick={() => requestSignIn()} className={actionClassName}>
            Sign in
          </button>
          <button type="button" onClick={onReturnToDashboard} className={actionClassName}>
            Return to Dashboard
          </button>
        </div>
      }
    />
  );
};
