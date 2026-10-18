import { SIGN_IN_WORDS } from "@/ui/design-system/kit/words";
import { useState, type FormEvent } from "react";

import { Button } from "@/ui/design-system/kit/button";
import { Field } from "@/ui/design-system/kit/field";

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
          <Button role="primary" word={SIGN_IN_WORDS.discord} icon="discord" onClick={onDiscord} disabled={sending} />
          <div className="flex items-center gap-3 text-sm text-kit-muted">
            <span className="h-px flex-1 bg-kit-line" />
            {SIGN_IN_WORDS.or}
            <span className="h-px flex-1 bg-kit-line" />
          </div>
        </>
      )}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field
          size="lg"
          icon="mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@mail.com"
          aria-label={SIGN_IN_WORDS.email}
        />
        <Button
          role={onDiscord ? "secondary" : "primary"}
          type="submit"
          word={SIGN_IN_WORDS.sendCode}
          icon="mail"
          loading={sending ? SIGN_IN_WORDS.sending : undefined}
        />
      </form>
      <FailureLine line={error} />
    </div>
  );
};
