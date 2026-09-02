import { BootLoaderShell } from "@/ui/modules/boot-loader";
import { IdentityLogin } from "@/ui/modules/identity/identity-login";

interface PlayRouteReconnectScreenProps {
  onRetry: () => void;
  onReturnToDashboard: () => void;
  reconnectError: string | null;
  showRetry: boolean;
}

const actionClassName =
  "rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold transition hover:bg-gold/20";

/** A player route with no gameplay account and no session restoring one: the sign-in surface, on the route itself. */
export const PlayRouteReconnectScreen = ({
  onRetry,
  onReturnToDashboard,
  reconnectError,
  showRetry,
}: PlayRouteReconnectScreenProps) => (
  <BootLoaderShell
    mode="indeterminate"
    title="Sign in to Continue"
    subtitle="This world route is still valid. Sign in with your Starknet identity wallet and your gameplay account is prepared here."
    caption="Account Recovery"
    detail={
      <div className="flex flex-col items-center gap-3">
        {reconnectError ? (
          <p role="alert" className="max-w-md text-center text-sm text-red-300">
            {reconnectError}
          </p>
        ) : null}
        <IdentityLogin className="items-center" />
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
