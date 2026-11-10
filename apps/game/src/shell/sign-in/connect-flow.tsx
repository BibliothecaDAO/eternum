import { SIGN_IN_PROVIDER_NAMES, SIGN_IN_WORDS, WALLET_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { IdentityRequestError, type Session, type SocialProvider } from "@realms-world/identity";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  identityClient,
  identityUsername,
  useIdentitySession,
  useIdentitySessionStore,
} from "@/hooks/context/identity-session";
import { payoutAddressOf } from "@/hooks/context/payout-wallet";
import { opensThirdPartySignIn } from "@/runtime/distribution-channel";
import { failureSentence, type IdentityAction } from "@/ui/modules/identity/identity-failures";

import { returnPathOf } from "../return-path";
import { CodeStep } from "./code-step";
import { claimDefaultName } from "./default-name";
import { useConnectStore } from "./connect";
import { ShellWindow } from "../frame/shell-window";
import { opensDiscordApp } from "./discord-app";
import { useSocialAttempt } from "./social-attempt";
import { forgetSocialStart, pendingSocialStart, rememberSocialStart, type SocialPending } from "./social-pending";
import { HandoffStep } from "./handoff-step";
import { ProfileStep } from "./profile-step";
import { PayoutWalletPanel } from "../profile/payout-wallet-panel";
import { StartStep } from "./start-step";

/**
 * The one sign-in flow (spec 02), in the Connect window over whatever page the player is on, the game included; there
 * is no sign-in page. A provider (Google, Apple, Discord, X) or an emailed code, then straight on: a new account takes its suggested name and a
 * portrait by itself (changed later on You), and only when no such name is free does the window ask for one. It opens
 * when a surface asks (the bar's Connect, every Sign in, Play free: useRequestSignIn) and when a sign-in comes back
 * failed (an `error` on the address); once the account carries a name it closes and the player goes on to the asker's
 * `next`, or stays where they were.
 *
 * A provider returns the player to that same page. A phone may finish it in another browser than the one that asked
 * (an iPhone home-screen app's Safari view, the browser a provider's app opens): that browser is not signed in, it
 * shows a one-time code instead, and the provider's step here takes it (apps/realms/server/social-handoff.ts).
 */
export const ConnectFlow = () => {
  const { status, session } = useIdentitySession();
  const { request, nameDismissed, walletDismissed, close, dismissWallet } = useConnectStore();
  const returned = useReturnedFailure();
  const refresh = useIdentitySessionStore((state) => state.refresh);
  const named = session !== null && identityUsername(session) !== null;
  const [pending, setPending] = useState(pendingSocialStart);
  const endPending = useCallback(() => {
    forgetSocialStart();
    setPending(null);
  }, []);
  // A provider's sign-in that came back failed is over: Connect starts again with the reason.
  useEffect(() => {
    if (returned.line) endPending();
  }, [returned.line, endPending]);
  useGoOnOnceNamed(named, pending, endPending);
  const naming = useDefaultName(session, named, refresh);

  if (status === "loading") return null;
  if (named) {
    if (walletDismissed || payoutAddressOf(session.user) !== null) return null;
    return (
      <ShellWindow title={WALLET_WORDS.yourWallet} onClose={dismissWallet}>
        <PayoutWalletPanel wallet={null} email={session.user.email} onChanged={() => void refresh()} />
      </ShellWindow>
    );
  }
  if (session) {
    if (naming !== "refused" || (nameDismissed && !request)) return null;
    return (
      <ShellWindow title={SIGN_IN_WORDS.yourName} onClose={close}>
        <ProfileStep session={session} onClaimed={() => void refresh()} />
      </ShellWindow>
    );
  }
  if (!request && !returned.line && !pending) return null;
  const resumed = returned.line ? null : (pending?.provider ?? null);
  return (
    <AnonymousConnect
      key={resumed ?? "start"}
      next={request?.next ?? pending?.next ?? null}
      resumed={resumed}
      returnedFailure={returned.line}
      onClose={() => {
        returned.clear();
        endPending();
        close();
      }}
    />
  );
};

type Step =
  | { kind: "start" }
  | { kind: "code"; email: string; expiresAt: number | undefined }
  | { kind: "inApp"; provider: SocialProvider }
  | { kind: "handoff"; provider: SocialProvider };

/**
 * Before a session: a provider, or an email and then its code; after a provider, the code another browser shows, also
 * after the page reloaded while the provider was out (`resumed`). A phone's tap that hands Discord to its app leaves
 * the screen as it was, its button busy (`inApp`): the code step shows once the page comes back from the app, when
 * there can be a code.
 */
const AnonymousConnect = ({
  next,
  resumed,
  returnedFailure,
  onClose,
}: {
  next: string | null;
  resumed: SocialProvider | null;
  returnedFailure: string | null;
  onClose: () => void;
}) => {
  const location = useLocation();
  const providers = useSignInProviders();
  const applySession = useIdentitySessionStore((state) => state.applySession);
  const [step, setStep] = useState<Step>(resumed ? { kind: "handoff", provider: resumed } : { kind: "start" });
  const { run, running, error, setError } = useIdentityAction(returnedFailure);
  const backFromApp = useCallback(
    () => setStep((now) => (now.kind === "inApp" ? { kind: "handoff", provider: now.provider } : now)),
    [],
  );
  useBackFromProvider(step.kind === "handoff" || step.kind === "inApp", backFromApp);

  // The provider brings the player back to `next`, or to this page; a failure comes back to the same page.
  const returnTo = next ?? returnPathOf(location);
  const appHere = opensDiscordApp();
  const usesDiscordApp = (provider: SocialProvider) => provider === "discord" && appHere;
  // The start screen, also drawn while the Discord app opens: Discord's address is kept ready under it.
  const onStartScreen = step.kind === "start" || step.kind === "inApp";
  const attempt = useSocialAttempt(
    returnTo,
    appHere && onStartScreen && providers.includes("discord") ? "discord" : null,
  );

  const startProvider = (provider: SocialProvider, out: Step, open: () => void) => {
    rememberSocialStart(provider, next);
    setStep(out);
    open();
  };
  // A provider's website shows its code step at once: a home-screen app's Safari view may cover the page, not hide it.
  const toWebsite = (provider: SocialProvider, address: string) =>
    startProvider(provider, { kind: "handoff", provider }, () => attempt.inBrowser(address));
  // A provider's website is a page load, which needs no tap: it opens once its address comes.
  const openWebsite = (provider: SocialProvider) =>
    void run("social", async () => {
      const address = await attempt.fetch(provider);
      if (address !== null) toWebsite(provider, address);
    });
  // A phone opens the Discord app only from a tap that holds the address; a tap without one asks and opens nothing.
  // An iPhone without the app goes on to the website the same way.
  const openDiscordApp = () => {
    const address = attempt.claim("discord");
    if (address === null) return prepareDiscordApp();
    startProvider("discord", { kind: "inApp", provider: "discord" }, () =>
      attempt.inApp(address, () => toWebsite("discord", address)),
    );
  };
  // A refused ask says why; an answer makes the next tap the one that opens the app.
  const prepareDiscordApp = () =>
    void run("social", async () => {
      await attempt.fetch("discord");
    });
  const continueWith = (provider: SocialProvider) =>
    usesDiscordApp(provider) ? openDiscordApp() : openWebsite(provider);
  // Every way in on the start screen comes through here. While a provider's app is opening, the screen stays with
  // that provider's button busy: any other way ends that sign-in first (its launch, address, saved return and step).
  const choose = (go: () => void) => {
    if (step.kind === "inApp") {
      attempt.end();
      forgetSocialStart();
      setStep({ kind: "start" });
    }
    go();
  };

  const emailCode = (email: string) =>
    void run("send-code", async () => {
      setStep({ kind: "code", email, expiresAt: codeExpiry(await identityClient.sendSignInCode(email)) });
    });

  if (step.kind === "handoff")
    return (
      <ShellWindow title={SIGN_IN_PROVIDER_NAMES[step.provider]} onClose={onClose}>
        <HandoffStep
          provider={step.provider}
          checking={running === "handoff"}
          preparing={attempt.asking === step.provider}
          error={error}
          onCode={(code) => run("handoff", async () => applySession(await identityClient.claimSocialHandoff(code)))}
          onRetry={() => continueWith(step.provider)}
          onBrowser={usesDiscordApp(step.provider) ? () => openWebsite("discord") : undefined}
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
        sending={running === "send-code" || running === "social"}
        preparing={attempt.asking}
        opening={step.kind === "inApp" ? step.provider : null}
        error={error}
        providers={providers}
        onProvider={(provider) => choose(() => continueWith(provider))}
        onEmail={(email) => choose(() => emailCode(email))}
      />
    </ShellWindow>
  );
};

/**
 * The sign-in providers the identity service offers; a provider's button shows only once it does. None where a sign-in
 * may not leave for a third party (the iOS app): there the emailed code is the way in.
 */
const useSignInProviders = () => {
  const [providers, setProviders] = useState<SocialProvider[]>([]);
  useEffect(() => {
    if (!opensThirdPartySignIn()) return;
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
 * A sign-in that came back failed: the identity service returns a provider's refusals to the page with an `error` on
 * its address. It is read once, as the start step's line, and taken off the address so a reload does not show it again.
 */
const useReturnedFailure = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("error");
    if (!code) return;
    setLine(failureSentence("social", new IdentityRequestError(400, code)));
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
 * While a provider is out: back on this page, the session is read again, since it may have finished in another tab of
 * this same browser (a provider's app opens a new one), and that signs this page in too; `onBack` moves the window on.
 */
const useBackFromProvider = (waiting: boolean, onBack: () => void) => {
  const refresh = useIdentitySessionStore((state) => state.refresh);
  useEffect(() => {
    if (!waiting) return;
    const back = () => {
      if (document.visibilityState !== "visible") return;
      void refresh();
      onBack();
    };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("pageshow", back);
    return () => {
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("pageshow", back);
    };
  }, [onBack, refresh, waiting]);
};

/**
 * A new account names itself once per session (claimDefaultName), then the session is read again so it carries the
 * name. "refused" when no default name could be saved: the name step asks the player.
 */
const useDefaultName = (session: Session | null, named: boolean, refresh: () => Promise<unknown>) => {
  const [state, setState] = useState<"naming" | "refused">("naming");
  const tried = useRef<string | null>(null);
  useEffect(() => {
    if (!session || named || tried.current === session.user.id) return;
    tried.current = session.user.id;
    setState("naming");
    void claimDefaultName(session).then((saved) => (saved ? refresh() : setState("refused")));
  }, [session, named, refresh]);
  return state;
};

/**
 * Once the account carries a name, the request ends and the player goes on to where the asker, or the provider's
 * sign-in that brought them back, was taking them.
 */
const useGoOnOnceNamed = (named: boolean, pending: SocialPending | null, endPending: () => void) => {
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
