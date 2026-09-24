import { identityClient, useIdentitySession, useIdentitySessionStore } from "@/hooks/context/identity-session";
import Button from "@/ui/design-system/atoms/button";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";

import { failureSentence, type IdentityAction } from "./identity-failures";

const INPUT_CLASS =
  "w-full rounded-lg border border-gold/30 bg-black/40 px-3 py-2.5 text-[14px] text-gold outline-none placeholder:text-gold/40 focus:border-gold";

/**
 * Sign-in to a Realms account: Discord, or a code emailed to the player. The first sign-in creates the account. No
 * wallet loads here; a wallet is linked afterwards on the account page.
 */
export const IdentityLogin = ({ className = "" }: { className?: string }) => {
  const { status, session } = useIdentitySession();
  const applySession = useIdentitySessionStore((state) => state.applySession);
  const signInRequest = useIdentitySessionStore((state) => state.signInRequest);
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState<IdentityAction | null>(null);
  // Discord returns here with an `error` query parameter when sign-in did not complete.
  const [error, setError] = useState<string | null>(() => discordReturnError(location.search));
  const running = useRef(false);

  const run = useCallback(async (action: IdentityAction, body: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setPending(action);
    setError(null);
    try {
      await body();
    } catch (cause) {
      setError(failureSentence(action, cause));
    } finally {
      running.current = false;
      setPending(null);
    }
  }, []);

  // Discord returns the player to the page that asked for sign-in, or to this one.
  const continueWithDiscord = () =>
    run("discord", async () => {
      const returnTo = signInRequest?.redirectTo ?? `${location.pathname}${location.search}`;
      window.location.assign(await identityClient.discordSignInUrl(returnTo));
    });

  const emailCode = (event: FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    void run("send-code", async () => {
      await identityClient.sendSignInCode(address);
      setCode("");
      setCodeSentTo(address);
    });
  };

  const signInWithCode = (event: FormEvent) => {
    event.preventDefault();
    if (!codeSentTo) return;
    void run("code", async () => applySession(await identityClient.signInWithCode(codeSentTo, code.trim())));
  };

  if (status === "signed-in" && session) return null;
  const busy = pending !== null || status === "loading";

  return (
    <div className={`flex w-full flex-col gap-2 ${className}`}>
      <Button
        className="w-full px-4 py-2"
        disabled={busy}
        isLoading={pending === "discord"}
        onClick={() => void continueWithDiscord()}
      >
        Continue with Discord
      </Button>
      {codeSentTo === null ? (
        <form className="flex w-full flex-col gap-1" onSubmit={emailCode}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Your email"
            className={INPUT_CLASS}
          />
          <Button type="submit" className="w-full px-4 py-2" disabled={busy} isLoading={pending === "send-code"}>
            Email me a code
          </Button>
        </form>
      ) : (
        <form className="flex w-full flex-col gap-1" onSubmit={signInWithCode}>
          <span className="text-xs text-gold/60">We sent a six-digit code to {codeSentTo}.</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Code"
            className={INPUT_CLASS}
          />
          <Button type="submit" className="w-full px-4 py-2" disabled={busy} isLoading={pending === "code"}>
            Sign in
          </Button>
          <button
            type="button"
            className="pt-1 text-left text-xs text-gold/60 underline"
            onClick={() => setCodeSentTo(null)}
          >
            Use another address or send a new code
          </button>
        </form>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
};

const discordReturnError = (search: string): string | null => {
  const returned = new URLSearchParams(search).get("error");
  return returned ? failureSentence("discord", new Error(returned)) : null;
};
