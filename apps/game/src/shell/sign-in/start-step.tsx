import { SIGN_IN_WORDS } from "@/ui/design-system/kit/words";
import { useState, type FormEvent } from "react";

import { AppButton, AppField } from "@/ui/design-system/kit/app-elements";

import { FailureLine } from "./failure-line";

/**
 * The first step (spec 02): Discord as the primary, then an emailed code; the first sign-in by either creates the
 * player's Realms account.
 */
export const StartStep = ({
  sending,
  error,
  onDiscord,
  onEmail,
}: {
  sending: boolean;
  error: string | null;
  onDiscord?: (() => void) | undefined;
  onEmail: (email: string) => void;
}) => {
  const [email, setEmail] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onEmail(email.trim());
  };
  return (
    <div className="flex flex-col gap-4">
      {onDiscord && (
        <>
          <AppButton kind="primary" size="lg" icon="discord" onClick={onDiscord} disabled={sending}>
            {SIGN_IN_WORDS.discord}
          </AppButton>
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
          kind={onDiscord ? "secondary" : "primary"}
          size="lg"
          type="submit"
          icon="mail"
          busy={sending ? SIGN_IN_WORDS.sending : undefined}
        >
          {SIGN_IN_WORDS.sendCode}
        </AppButton>
      </form>
      <FailureLine line={error} />
    </div>
  );
};
