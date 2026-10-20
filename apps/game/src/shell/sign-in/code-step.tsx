import { SIGN_IN_WORDS } from "@/ui/design-system/kit/words";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { SIGN_IN_CODE_LENGTH } from "@realms-world/identity";
import { useState } from "react";

import { AppButton, AppCode } from "@/ui/design-system/kit/app-elements";
import { AppClockChip } from "@/ui/design-system/kit/clock-chip";
import { useNowSeconds } from "../use-now";
import { FailureLine } from "./failure-line";

/**
 * The code step (spec 02): the address the code went to (tap to change it), six boxes that sign in on the sixth digit,
 * and when the code expires; at that moment the clock becomes New code on the same spot. When the Worker did not say
 * when the code expires, the clock is a dash and New code stands beside it, since no moment will bring it.
 */
export const CodeStep = ({
  email,
  expiresAt,
  checking,
  sending,
  error,
  onCode,
  onNewCode,
  onChangeEmail,
  onTyping,
}: {
  email: string;
  /** Unix seconds the code stops working, as the identity Worker stored it; undefined when it did not say. */
  expiresAt: number | undefined;
  checking: boolean;
  sending: boolean;
  error: string | null;
  /** Signs in with the code; false when it was refused, and the boxes clear for another try. */
  onCode: (code: string) => Promise<boolean>;
  onNewCode: () => void;
  onChangeEmail: () => void;
  /** Typing again clears the last refusal. */
  onTyping: () => void;
}) => {
  const [code, setCode] = useState("");
  const now = useNowSeconds();
  const expired = expiresAt !== undefined && now >= expiresAt;
  const newCode = (
    <AppButton kind="secondary" icon="mail" onClick={onNewCode} busy={sending ? SIGN_IN_WORDS.sending : undefined}>
      {SIGN_IN_WORDS.newCode}
    </AppButton>
  );

  const type = (value: string) => {
    onTyping();
    const digits = value.replace(/\D/g, "").slice(0, SIGN_IN_CODE_LENGTH);
    setCode(digits);
    if (digits.length === SIGN_IN_CODE_LENGTH) void onCode(digits).then((signedIn) => signedIn || setCode(""));
  };

  return (
    <div className="flex flex-col items-center gap-5 pt-4">
      <button
        type="button"
        onClick={onChangeEmail}
        className="flex min-h-12 max-w-full items-center gap-2 text-app-strong text-app-ink"
      >
        <SemanticIcon name="mail" size={22} />
        <span className="truncate">{email}</span>
        <SemanticIcon name="edit" size={20} />
      </button>
      <AppCode
        label={SIGN_IN_WORDS.code}
        code={code}
        length={SIGN_IN_CODE_LENGTH}
        refused={error !== null}
        disabled={checking || expired}
        onType={type}
      />
      {expired ? (
        newCode
      ) : checking ? (
        <p className="text-app-strong text-app-muted">{SIGN_IN_WORDS.checking}</p>
      ) : (
        <AppClockChip prefix="expires" at={expiresAt} now={now} />
      )}
      {expiresAt === undefined && !checking && newCode}
      <FailureLine line={error} />
    </div>
  );
};
