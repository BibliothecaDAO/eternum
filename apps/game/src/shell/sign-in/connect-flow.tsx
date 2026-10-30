import { SIGN_IN_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { IdentityRequestError } from "@realms-world/identity";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  identityClient,
  identityUsername,
  useIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import { failureSentence, type IdentityAction } from "@/ui/modules/identity/identity-failures";

import { returnPathOf } from "../return-path";
import { CodeStep } from "./code-step";
import { useConnectStore } from "./connect";
import { ShellWindow } from "../frame/shell-window";
import { forgetDiscordStart, pendingDiscordStart, rememberDiscordStart, type DiscordPending } from "./discord-pending";
import { HandoffStep } from "./handoff-step";
import { ProfileStep } from "./profile-step";
import { StartStep } from "./start-step";

/**
 * The one sign-in flow (spec 02), in the Connect window over whatever page the player is on, the game included; there
 * is no sign-in page. Discord or an emailed code, then, for a new account only, its name and portrait. It opens when a
 * surface asks (the bar's Connect, every Sign in, Play free: useRequestSignIn), when a sign-in comes back failed (an
 * `error` on the address), and for a session that has not claimed a name yet; once the account carries a name it
 * closes and the player goes on to the asker's `next`, or stays where they were.
 *
 * Discord returns the player to that same page. A phone may finish Discord in another browser than the one that asked
 * (an iPhone home-screen app's Safari view, the browser the Discord app opens): that browser is not signed in, it
 * shows a one-time code instead, and the Discord step here takes it (apps/realms/server/discord-handoff.ts).
 */
export const ConnectFlow = () => {
  const { status, session } = useIdentitySession();
  const { request, nameDismissed, close } = useConnectStore();
  const returned = useReturnedFailure();
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const named = session !== null && identityUsername(session) !== null;
  const [pending, setPending] = useState(pendingDiscordStart);
  const endPending = useCallback(() => {
    forgetDiscordStart();
    setPending(null);
  }, []);
  // A Discord sign-in that came back failed is over: Connect starts again with the reason.
  useEffect(() => {
    if (returned.line) endPending();
  }, [returned.line, endPending]);
  useGoOnOnceNamed(named, pending, endPending);

  if (status === "loading" || named) return null;
  if (session) {
    if (nameDismissed && !request) return null;
    return (
      <ShellWindow title={SIGN_IN_WORDS.yourName} onClose={close}>
        <ProfileStep session={session} onClaimed={() => void refresh()} />
      </ShellWindow>
    );
  }
  if (!request && !returned.line && !pending) return null;
  const resumeDiscord = pending !== null && !returned.line;
  return (
    <AnonymousConnect
      key={resumeDiscord ? "discord" : "start"}
      next={request?.next ?? pending?.next ?? null}
      resumeDiscord={resumeDiscord}
      returnedFailure={returned.line}
      onClose={() => {
        returned.clear();
        endPending();
        close();
      }}
    />
  );
};

type Step = { kind: "start" } | { kind: "code"; email: string; expiresAt: number | undefined } | { kind: "discord" };

/**
 * Before a session: Discord, or an email and then its code; after Discord, the code another browser shows, also after
 * the page reloaded while Discord was out (`resumeDiscord`).
 */
const AnonymousConnect = ({
  next,
  resumeDiscord,
  returnedFailure,
  onClose,
}: {
  next: string | null;
  resumeDiscord: boolean;
  returnedFailure: string | null;
  onClose: () => void;
}) => {
  const location = useLocation();
  const providers = useSignInProviders();
  const applySession = useIdentitySessionStore((state) => state.applySession);
  const [step, setStep] = useState<Step>({ kind: resumeDiscord ? "discord" : "start" });
  const { run, running, error, setError } = useIdentityAction(returnedFailure);
  useRefreshOnReturn(step.kind === "discord");

  // Discord brings the player back to `next`, or to this page; a failure comes back to the same page.
  const continueWithDiscord = () =>
    void run("discord", async () => {
      const url = await identityClient.discordSignInUrl(next ?? returnPathOf(location));
      rememberDiscordStart(next);
      setStep({ kind: "discord" });
      window.location.assign(url);
    });

  const emailCode = (email: string) =>
    void run("send-code", async () => {
      setStep({ kind: "code", email, expiresAt: codeExpiry(await identityClient.sendSignInCode(email)) });
    });

  if (step.kind === "discord")
    return (
      <ShellWindow title={SIGN_IN_WORDS.discord} onClose={onClose}>
        <HandoffStep
          checking={running === "handoff"}
          error={error}
          onCode={(code) => run("handoff", async () => applySession(await identityClient.claimDiscordHandoff(code)))}
          onDiscord={continueWithDiscord}
          onTyping={() => setError(null)}
        />
      </ShellWindow>
    );
  if (step.kind === "code")
    return (
      <ShellWindow title={SIGN_IN_WORDS.codeSent} onClose={onClose}>
        <CodeStep
          email={step.email}
          expiresAt={step.expiresAt}
          checking={running === "code"}
          sending={running === "send-code"}
          error={error}
          onCode={(code) =>
            run("code", async () => applySession(await identityClient.signInWithCode(step.email, code)))
          }
          onNewCode={() => emailCode(step.email)}
          onTyping={() => setError(null)}
          onChangeEmail={() => {
            setError(null);
            setStep({ kind: "start" });
          }}
        />
      </ShellWindow>
    );
  return (
    <ShellWindow title={WORDS.connect} onClose={onClose}>
      <StartStep
        sending={running === "send-code" || running === "discord"}
        error={error}
        onDiscord={providers.includes("discord") ? continueWithDiscord : undefined}
        onEmail={emailCode}
      />
    </ShellWindow>
  );
};

/** The sign-in providers the identity service lists; Discord shows only once it does. */
const useSignInProviders = () => {
  const [providers, setProviders] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    void identityClient
      .availableSignInProviders()
      .then((value) => {
        if (active) setProviders(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return providers;
};

/**
 * A sign-in that came back failed: the identity service returns Discord's refusals to the page with an `error` on its
 * address. It is read once, as the Discord step's line, and taken off the address so a reload does not show it again.
 */
const useReturnedFailure = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("error");
    if (!code) return;
    setLine(failureSentence("discord", new IdentityRequestError(400, code)));
    params.delete("error");
    params.delete("error_description");
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "", hash: location.hash },
      { replace: true },
    );
  }, [location, navigate]);
  return { line, clear: () => setLine(null) };
};

/**
 * While Discord is out: back on this page, the session is read again, since Discord may have finished in another tab of
 * this same browser (the Discord app opens a new one), and that signs this page in too.
 */
const useRefreshOnReturn = (waiting: boolean) => {
  const refresh = useIdentitySessionStore((state) => state.refresh);
  useEffect(() => {
    if (!waiting) return;
    const back = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("pageshow", back);
    return () => {
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("pageshow", back);
    };
  }, [refresh, waiting]);
};

/**
 * Once the account carries a name, the request ends and the player goes on to where the asker, or the Discord sign-in
 * that brought them back, was taking them.
 */
const useGoOnOnceNamed = (named: boolean, pending: DiscordPending | null, endPending: () => void) => {
  const navigate = useNavigate();
  const location = useLocation();
  const request = useConnectStore((state) => state.request);
  const close = useConnectStore((state) => state.close);
  useEffect(() => {
    if (!named || (!request && !pending)) return;
    const next = request?.next ?? pending?.next ?? null;
    close();
    endPending();
    if (next && next !== `${location.pathname}${location.search}${location.hash}`) navigate(next);
  }, [close, endPending, location, named, navigate, pending, request]);
};

/**
 * When the sent code stops working, as the identity Worker stored it (whole seconds, never later than the Worker's
 * instant). A Worker that does not return it yet leaves it unknown.
 */
const codeExpiry = (sent: { expires_at?: number }): number | undefined =>
  sent.expires_at === undefined ? undefined : Math.floor(sent.expires_at);

/** Runs one identity action at a time; its name is the step its button shows, a failure the one line under it. */
const useIdentityAction = (initialError: string | null) => {
  const [running, setRunning] = useState<IdentityAction | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const busy = useRef(false);
  useEffect(() => {
    setError(initialError);
  }, [initialError]);
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
