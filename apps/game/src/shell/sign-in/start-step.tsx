import { SIGN_IN_WORDS } from "@/ui/design-system/kit/words";
import { aspects } from "@bibliothecadao/types";
import type { SocialProvider } from "@realms-world/identity";
import { useState, type FormEvent } from "react";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { AppButton, AppField } from "@/ui/design-system/kit/app-elements";

import { FailureLine } from "./failure-line";
import { SIGN_IN_PROVIDER_MARKS } from "./provider-marks";

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
  preparing: SocialProvider | null;
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
  const [leadProvider, ...otherProviders] = providers;
  return (
    <div className="flex flex-col gap-3.5">
      {leadProvider && (
        <div className="signin-providers">
          <AppButton
            key={leadProvider}
            kind="primary"
            size="lg"
            icon={SIGN_IN_PROVIDER_MARKS[leadProvider]}
            className="w-full"
            onClick={() => onProvider(leadProvider)}
            disabled={sending}
            busy={busyWord(leadProvider)}
          >
            {SIGN_IN_WORDS.continueWith(leadProvider)}
          </AppButton>
          {otherProviders.length > 0 && (
            <>
              <div className="signin-divider">{SIGN_IN_WORDS.or}</div>
              <div className="signin-providers__grid">
                {otherProviders.map((provider) => (
                  <AppButton
                    key={provider}
                    kind="secondary"
                    size="md"
                    icon={SIGN_IN_PROVIDER_MARKS[provider]}
                    className="w-full"
                    onClick={() => onProvider(provider)}
                    disabled={sending}
                    busy={busyWord(provider)}
                  >
                    {SIGN_IN_WORDS.continueWith(provider)}
                  </AppButton>
                ))}
              </div>
            </>
          )}
          <div className="signin-divider">{SIGN_IN_WORDS.email}</div>
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-2.5">
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
          kind={leadProvider ? "secondary" : "primary"}
          size="lg"
          type="submit"
          icon="mail"
          className="w-full"
          busy={sending ? SIGN_IN_WORDS.sending : undefined}
        >
          {SIGN_IN_WORDS.sendCode}
        </AppButton>
      </form>
      <p className="text-app-label text-app-muted">{SIGN_IN_WORDS.firstSignIn}</p>
      <div className="signin-foot-facets" aria-hidden="true">
        {aspects.map(({ id }) => (
          <AspectMark key={id} aspect={id} size={28} decorative />
        ))}
      </div>
      <FailureLine line={error} />
    </div>
  );
};
