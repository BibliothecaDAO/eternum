import { IdentityRequestError } from "@realms-world/identity";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import {
  identityClient,
  identityUsername,
  useIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import { useFrontierType } from "@/ui/features/frontier/use-frontier-type";
import { useBootDocumentState } from "@/ui/modules/boot-loader";
import { failureSentence, type IdentityAction } from "@/ui/modules/identity/identity-failures";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { paintingSources } from "../paintings";
import { LORE_LINE, SIGN_IN_WORDS, WORDS } from "../words";
import { CodeStep } from "./code-step";
import { ProfileStep } from "./profile-step";
import { nextOf, signInHref } from "./sign-in-route";
import { StartStep } from "./start-step";

/** The sign-in flow's painting: Brooding Plains, the mist. */
const PAINTING = "brooding-plains";

/**
 * The one sign-in flow (spec 02): Discord or an emailed code, then, for a new account only, its name and portrait; it
 * returns the player to `next` the moment the account carries a name. Back leads there on every step.
 */
export const SignInPage = () => {
  useBootDocumentState("app-ready");
  useFrontierType();
  const { search } = useLocation();
  const next = nextOf(search);
  const { status, session } = useIdentitySession();
  const refresh = useIdentitySessionStore((state) => state.refresh);

  if (status === "loading") return <SignInFrame next={next} title={WORDS.signIn} />;
  if (!session) return <AnonymousSignIn next={next} />;
  // The refreshed session carries the claimed name, and the player is back where they were going.
  if (identityUsername(session) !== null) return <Navigate to={next} replace />;
  return (
    <SignInFrame next={next} title={SIGN_IN_WORDS.yourName}>
      <ProfileStep session={session} onClaimed={() => void refresh()} />
    </SignInFrame>
  );
};

/** Before a session: Discord, or an email and then its code. */
const AnonymousSignIn = ({ next }: { next: string }) => {
  const { search } = useLocation();
  const applySession = useIdentitySessionStore((state) => state.applySession);
  const [sent, setSent] = useState<{ email: string; expiresAt: number | undefined } | null>(null);
  // Discord returns to the flow with an `error` query parameter when its sign-in did not complete.
  const { run, running, error, setError } = useIdentityAction(() => discordReturnError(search));

  const continueWithDiscord = () =>
    void run("discord", async () => window.location.assign(await identityClient.discordSignInUrl(signInHref(next))));

  const emailCode = (email: string) =>
    void run("send-code", async () => {
      setSent({ email, expiresAt: codeExpiry(await identityClient.sendSignInCode(email)) });
    });

  const signInWithCode = (email: string, code: string) =>
    run("code", async () => applySession(await identityClient.signInWithCode(email, code)));

  if (!sent) {
    return (
      <SignInFrame next={next} title={WORDS.signIn} hero>
        <StartStep
          sending={running === "send-code"}
          error={error}
          onDiscord={continueWithDiscord}
          onEmail={emailCode}
        />
      </SignInFrame>
    );
  }
  return (
    <SignInFrame next={next} title={SIGN_IN_WORDS.codeSent}>
      <CodeStep
        email={sent.email}
        expiresAt={sent.expiresAt}
        checking={running === "code"}
        sending={running === "send-code"}
        error={error}
        onCode={(code) => signInWithCode(sent.email, code)}
        onNewCode={() => emailCode(sent.email)}
        onTyping={() => setError(null)}
        onChangeEmail={() => {
          setError(null);
          setSent(null);
        }}
      />
    </SignInFrame>
  );
};

/**
 * When the sent code stops working, as the identity Worker stored it (whole seconds, never later than the Worker's
 * instant). A Worker that does not return it yet leaves it unknown.
 */
const codeExpiry = (sent: { expires_at?: number }): number | undefined =>
  sent.expires_at === undefined ? undefined : Math.floor(sent.expires_at);

/** Runs one identity action at a time; its name is the step its button shows, a failure the one line under it. */
const useIdentityAction = (initialError: () => string | null) => {
  const [running, setRunning] = useState<IdentityAction | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const busy = useRef(false);
  const run = useCallback(async (action: IdentityAction, body: () => Promise<void>): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setRunning(action);
    setError(null);
    try {
      await body();
      return true;
    } catch (cause) {
      setError(failureSentence(action, cause));
      return false;
    } finally {
      busy.current = false;
      setRunning(null);
    }
  }, []);
  return { run, running, error, setError };
};

/**
 * The flow's frame on PageFrame, with no tabs: on a phone one column, the painting and the lore line above the first
 * step only; on desktop the painting at full strength across the window, the lore line at its bottom left and the
 * steps in a 440 px panel at the right.
 */
const SignInFrame = ({
  next,
  title,
  hero = false,
  children,
}: {
  next: string;
  title: string;
  hero?: boolean;
  children?: ReactNode;
}) => {
  const layout = useLayout();
  return (
    <PageFrame back={next} title={title} tabs={false}>
      {layout === "phone" ? (
        <div className="flex flex-col gap-5">
          {hero && <PhoneHero />}
          {children}
        </div>
      ) : (
        <DesktopPanel>{children}</DesktopPanel>
      )}
    </PageFrame>
  );
};

const PhoneHero = () => (
  <section className="relative isolate -mx-4 flex h-[38dvh] items-end overflow-hidden px-4 pb-3">
    <img
      {...paintingSources(PAINTING)}
      sizes="100vw"
      alt=""
      className="absolute inset-0 -z-10 size-full object-cover"
    />
    <span className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-transparent to-kit-ground" />
    <p className="font-display text-[26px] leading-[1.15] text-kit-cream">{LORE_LINE}</p>
  </section>
);

const DesktopPanel = ({ children }: { children?: ReactNode }) => (
  // No stacking context of its own: the fixed painting must sit behind the frame's title row (Back), not over it.
  <div className="flex min-h-[38rem] items-start justify-end">
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 top-[68px] -z-10">
      <img {...paintingSources(PAINTING)} sizes="100vw" alt="" className="size-full object-cover" />
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-kit-ground/60" />
    </div>
    <p className="fixed bottom-10 left-10 max-w-[32rem] font-display text-[40px] leading-[1.1] text-kit-cream">
      {LORE_LINE}
    </p>
    <div className="w-[440px] plate p-6">{children}</div>
  </div>
);

const discordReturnError = (search: string): string | null => {
  const returned = new URLSearchParams(search).get("error");
  // Discord's return carries the service's refusal code, so a refusal a retry cannot fix is named as such.
  return returned ? failureSentence("discord", new IdentityRequestError(400, returned)) : null;
};
