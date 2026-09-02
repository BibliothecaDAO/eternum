import { IDENTITY_POPOVER_ID, useIdentitySession, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import Button from "@/ui/design-system/atoms/button";
import { Popover } from "@/ui/design-system/molecules/popover";
import { IdentityLogin } from "@/ui/modules/identity/identity-login";
import type { Session } from "@realms-world/identity";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const resolveChipLabel = (status: "loading" | "anonymous" | "signed-in", session: Session | null): string => {
  if (status === "loading") return "…";
  if (status === "signed-in" && session) return session.user.name || shortId(session.user.id);
  return "Sign in";
};

const shortId = (id: string): string => `${id.slice(0, 6)}…${id.slice(-4)}`;

/**
 * The landing's identity chip: the one sign-in surface. A surface that needs a session calls `requestSignIn`,
 * which opens this popover; once the session lands the pending redirect replays with its route state.
 */
export const LandingIdentityChip = () => {
  const { status, session } = useIdentitySession();
  const signInRequest = useIdentitySessionStore((state) => state.signInRequest);
  const clearSignInRequest = useIdentitySessionStore((state) => state.clearSignInRequest);
  const closePopover = usePopoverStore((state) => state.close);
  const togglePopover = usePopoverStore((state) => state.toggle);
  const navigate = useNavigate();

  useEffect(() => {
    if (status !== "signed-in" || !signInRequest) return;
    clearSignInRequest();
    closePopover(IDENTITY_POPOVER_ID);
    navigate(signInRequest.redirectTo, { replace: true, state: signInRequest.redirectState });
  }, [clearSignInRequest, closePopover, navigate, signInRequest, status]);

  return (
    <Popover
      id={IDENTITY_POPOVER_ID}
      ariaLabel="Identity"
      align="end"
      trigger={
        <Button
          className="h-9 min-w-[128px] px-4"
          isLoading={status === "loading"}
          onClick={() => togglePopover(IDENTITY_POPOVER_ID)}
        >
          {resolveChipLabel(status, session)}
        </Button>
      }
    >
      {status === "signed-in" && session ? (
        <SignedInPanel session={session} />
      ) : (
        <SignInPanel prompted={signInRequest !== null} />
      )}
    </Popover>
  );
};

const SignedInPanel = ({ session }: { session: Session }) => (
  <div className="flex flex-col gap-1">
    <span className="text-sm font-semibold text-gold">{session.user.name || "Signed in"}</span>
    <span className="font-mono text-xs text-gold/60">{shortId(session.user.id)}</span>
  </div>
);

const SignInPanel = ({ prompted }: { prompted: boolean }) => (
  <div className="flex flex-col gap-3">
    <p className="text-sm text-gold/85">
      {prompted ? "Sign in required. " : ""}Sign in with your Starknet identity wallet before entering Blitz. Your
      gameplay account is prepared automatically after login.
    </p>
    <IdentityLogin className="items-start" />
  </div>
);
