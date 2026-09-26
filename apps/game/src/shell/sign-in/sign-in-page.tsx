import { useCallback, useRef, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import {
  identityClient,
  identityUsername,
  useIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useFrontierType } from "@/ui/features/frontier/use-frontier-type";
import { useBootDocumentState } from "@/ui/modules/boot-loader";
import { failureSentence, type IdentityAction } from "@/ui/modules/identity/identity-failures";

import { HERO_ART } from "../mode-art";
import { CodeStep } from "./code-step";
import { type ChosenProfile, ProfileStep } from "./profile-step";
import { nextOf, signInHref } from "./sign-in-route";
import { StartStep } from "./start-step";
import { WelcomeStep } from "./welcome-step";

/** The flow's four screens, as its progress dots count them. */
type Step = "start" | "code" | "profile" | "welcome";
const STEPS: Step[] = ["start", "code", "profile", "welcome"];

/**
 * The one sign-in flow (design o3), full screen: Discord or an emailed code, then a new player's name and portrait, then
 * "You're in" and back to `next`. A player who already has a name goes straight back to `next` once signed in.
 */
export const SignInPage = () => {
  useBootDocumentState("app-ready");
  useFrontierType();
  const { search } = useLocation();
  const next = nextOf(search);
  const { status, session } = useIdentitySession();
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const [welcome, setWelcome] = useState<ChosenProfile | null>(null);

  const choose = (profile: ChosenProfile) => {
    // The welcome shows first; the refreshed session then carries the name everywhere else.
    setWelcome(profile);
    void refresh();
  };

  if (welcome) {
    return (
      <SignInFrame step="welcome">
        <WelcomeStep profile={welcome} next={next} />
      </SignInFrame>
    );
  }
  if (status === "loading") return <SignInFrame />;
  if (!session) return <AnonymousSignIn next={next} />;
  if (identityUsername(session) !== null) return <Navigate to={next} replace />;
  return (
    <SignInFrame step="profile">
      <ProfileStep session={session} onChosen={choose} />
    </SignInFrame>
  );
};

/** Before a session: Discord, or an email and then its code. */
const AnonymousSignIn = ({ next }: { next: string }) => {
  const { search } = useLocation();
  const applySession = useIdentitySessionStore((state) => state.applySession);
  const [sent, setSent] = useState<{ email: string; at: number } | null>(null);
  // Discord returns to the flow with an `error` query parameter when its sign-in did not complete.
  const { run, pending, error, setError } = useIdentityAction(() => discordReturnError(search));

  const continueWithDiscord = () =>
    void run("discord", async () => window.location.assign(await identityClient.discordSignInUrl(signInHref(next))));

  const emailCode = (email: string) =>
    void run("send-code", async () => {
      await identityClient.sendSignInCode(email);
      setSent({ email, at: Date.now() });
    });

  const signInWithCode = (email: string, code: string) =>
    run("code", async () => applySession(await identityClient.signInWithCode(email, code)));

  if (!sent) {
    return (
      <SignInFrame step="start">
        <StartStep pending={pending} error={error} onDiscord={continueWithDiscord} onEmail={emailCode} />
      </SignInFrame>
    );
  }
  return (
    <SignInFrame step="code">
      <CodeStep
        email={sent.email}
        sentAt={sent.at}
        pending={pending}
        error={error}
        onCode={(code) => signInWithCode(sent.email, code)}
        onNewCode={() => emailCode(sent.email)}
        onChangeEmail={() => {
          setError(null);
          setSent(null);
        }}
      />
    </SignInFrame>
  );
};

/** Runs one identity action at a time; a failure becomes the one sentence the player can act on. */
const useIdentityAction = (initialError: () => string | null) => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const running = useRef(false);
  const run = useCallback(async (action: IdentityAction, body: () => Promise<void>): Promise<boolean> => {
    if (running.current) return false;
    running.current = true;
    setPending(true);
    setError(null);
    try {
      await body();
      return true;
    } catch (cause) {
      setError(failureSentence(action, cause));
      return false;
    } finally {
      running.current = false;
      setPending(false);
    }
  }, []);
  return { run, pending, error, setError };
};

/**
 * The flow's frame: a phone-width column, the progress dots on the screens between the first and the last, and on a
 * wide screen that column as a panel over the hero painting, dimmed.
 */
const SignInFrame = ({ step, children }: { step?: Step; children?: ReactNode }) => (
  <div className="relative isolate min-h-dvh bg-[#0c0a08] font-sans text-[#eadfc8] lg:py-12">
    <img
      src={HERO_ART}
      alt=""
      aria-hidden
      className="absolute inset-0 -z-10 hidden size-full object-cover opacity-25 blur-sm lg:block"
    />
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:min-h-0 lg:rounded-3xl lg:border lg:border-[#46351c] lg:bg-[#0c0a08]/90 lg:p-6">
      {(step === "code" || step === "profile") && <ProgressDots step={step} />}
      {children}
    </main>
  </div>
);

const ProgressDots = ({ step }: { step: Step }) => (
  <div aria-hidden className="flex justify-center gap-1.5 pt-6">
    {STEPS.map((dot) => (
      <span
        key={dot}
        className={cn(
          "h-2 rounded-full",
          dot === step ? "w-6 bg-[#f6ac1d]" : "w-2",
          dot !== step && (STEPS.indexOf(dot) < STEPS.indexOf(step) ? "bg-[#f6ac1d]" : "bg-[#46351c]"),
        )}
      />
    ))}
  </div>
);

const discordReturnError = (search: string): string | null => {
  const returned = new URLSearchParams(search).get("error");
  return returned ? failureSentence("discord", new Error(returned)) : null;
};
