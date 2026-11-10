import { WALLET_WORDS } from "@/ui/design-system/kit/words";
import { SIGN_IN_CODE_LENGTH } from "@realms-world/identity";
import { useCallback, useEffect, useState } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { AppCode, AppNotice } from "@/ui/design-system/kit/app-elements";
import { failureSentence } from "@/ui/modules/identity/identity-failures";

/**
 * The emailed sign-in code that confirms one step taken while signed in (a wallet change, an account's deletion): sent
 * when the step opens, entered in six boxes, and spent on the step the moment the sixth digit lands. `resend` sends a
 * new one; a refused step says why in `error`.
 */
export const useEmailCode = (
  email: string,
  spend: (code: string) => Promise<void>,
  refusal: (cause: unknown) => string,
) => {
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    setSent(false);
    setError(null);
    try {
      await identityClient.sendSignInCode(email);
      setSent(true);
    } catch (cause) {
      setError(failureSentence("send-code", cause));
    }
  }, [email]);
  useEffect(() => {
    void send();
  }, [send]);

  const spendCode = async (entered: string) => {
    setBusy(true);
    setError(null);
    try {
      await spend(entered);
    } catch (cause) {
      setError(refusal(cause));
    } finally {
      setBusy(false);
    }
  };
  const type = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, SIGN_IN_CODE_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === SIGN_IN_CODE_LENGTH) void spendCode(digits);
  };
  const resend = () => {
    setCode("");
    void send();
  };
  return { email, code, sent, busy, error, type, resend };
};

/** Where the code went, and its six boxes, shut while it is on its way or being spent. */
export const EmailCodeBoxes = ({ entry }: { entry: ReturnType<typeof useEmailCode> }) => (
  <>
    <AppNotice line={entry.sent ? `${WALLET_WORDS.codeSentTo} ${entry.email}` : WALLET_WORDS.sending} />
    <AppCode
      label={WALLET_WORDS.stepCode}
      code={entry.code}
      length={SIGN_IN_CODE_LENGTH}
      refused={entry.error !== null}
      disabled={!entry.sent || entry.busy}
      onType={entry.type}
    />
  </>
);
