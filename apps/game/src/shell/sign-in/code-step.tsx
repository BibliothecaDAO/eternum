import { SIGN_IN_CODE_LENGTH } from "@realms-world/identity";
import { useState } from "react";

import { Button } from "@/ui/design-system/kit/button";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";

import { ClockChip } from "../clock-chip";
import { useNowSeconds } from "../use-now";
import { SIGN_IN_WORDS } from "../words";
import { CodeBoxes } from "./fields";
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
    <Button
      role="outline"
      word={SIGN_IN_WORDS.newCode}
      icon="Em"
      onClick={onNewCode}
      loading={sending ? SIGN_IN_WORDS.sending : undefined}
    />
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
        className="flex min-h-12 max-w-full items-center gap-2 font-ui text-[17px] font-bold text-kit-cream"
      >
        <KitIcon code="Em" size={22} />
        <span className="truncate">{email}</span>
        <KitIcon code="Ed" size={20} />
      </button>
      <CodeBoxes code={code} refused={error !== null} disabled={checking || expired} onType={type} />
      {expired ? (
        newCode
      ) : checking ? (
        <p className="font-ui text-[15px] font-bold text-kit-muted">{SIGN_IN_WORDS.checking}</p>
      ) : (
        <ClockChip prefix="expires" at={expiresAt} now={now} />
      )}
      {expiresAt === undefined && !checking && newCode}
      <FailureLine line={error} />
    </div>
  );
};
