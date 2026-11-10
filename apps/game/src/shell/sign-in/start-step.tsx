import { SIGN_IN_WORDS } from "@/ui/design-system/kit/words";
import type { SocialProvider } from "@realms-world/identity";
import { useState, type FormEvent } from "react";

import { AppButton, AppField } from "@/ui/design-system/kit/app-elements";

import { FailureLine } from "./failure-line";
import { SIGN_IN_PROVIDER_MARKS } from "./provider-marks";

/**
 * Connect's first step (spec 02): the providers the identity service offers, one tap each, then an emailed code; the
 * first sign-in by any of them creates the player's Realms account. Every provider's button looks the same, its own
 * mark beside the wording its brand allows; the sheet's order (Google first) leads.
 */
export const StartStep = ({
  sending,
  preparing,
  opening,
  error,
  providers,
  onProvider,
  onEmail,
}: {
  sending: boolean;
  /** The provider whose sign-in address is on its way: its button waits for it. */
  preparing: SocialProvider | null;
  /** The provider whose app is coming up (a phone's Discord): its button waits until the player is back or goes on. */
  opening: SocialProvider | null;
  error: string | null;
  providers: readonly SocialProvider[];
  onProvider: (provider: SocialProvider) => void;
  onEmail: (email: string) => void;
}) => {
  const [email, setEmail] = useState("");
  const busyWord = (provider: SocialProvider) => {
    if (provider === opening) return SIGN_IN_WORDS.opening(provider);
    if (provider === preparing) return SIGN_IN_WORDS.preparing;
    return undefined;
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onEmail(email.trim());
  };
  return (
    <div className="flex flex-col gap-4">
      {providers.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            {providers.map((provider) => (
              <AppButton
                key={provider}
                kind="secondary"
                size="lg"
                icon={SIGN_IN_PROVIDER_MARKS[provider]}
                onClick={() => onProvider(provider)}
                disabled={sending}
                busy={busyWord(provider)}
              >
                {SIGN_IN_WORDS.continueWith(provider)}
              </AppButton>
            ))}
          </div>
          <div className="flex items-center gap-3 text-app-label text-app-muted">
            <span className="h-px flex-1 bg-app-line" />
            {SIGN_IN_WORDS.or}
            <span className="h-px flex-1 bg-app-line" />
          </div>
        </>
      )}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <AppField
          label={SIGN_IN_WORDS.email}
          icon="mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@mail.com"
        />
        <AppButton
          kind={providers.length > 0 ? "secondary" : "primary"}
          size="lg"
          type="submit"
          icon="mail"
          busy={sending ? SIGN_IN_WORDS.sending : undefined}
        >
          {SIGN_IN_WORDS.sendCode}
        </AppButton>
      </form>
      <p className="text-app-label text-app-muted">{SIGN_IN_WORDS.firstSignIn}</p>
      <FailureLine line={error} />
    </div>
  );
};
