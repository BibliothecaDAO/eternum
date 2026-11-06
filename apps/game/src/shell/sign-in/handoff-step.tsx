import { SIGN_IN_WORDS } from "@/ui/design-system/kit/words";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { SIGN_IN_CODE_LENGTH, type SocialProvider } from "@realms-world/identity";
import { useState } from "react";

import { AppButton, AppCode } from "@/ui/design-system/kit/app-elements";

import { FailureLine } from "./failure-line";
import { SIGN_IN_PROVIDER_MARKS } from "./provider-marks";

/**
 * After a provider: where it finished in this browser, the page has already moved on. A phone often finishes it in
 * another one (Safari's view over the home-screen app, the browser a provider's app opens), which shows a code: six
 * boxes take it here, and the provider can be tried again.
 */
export const HandoffStep = ({
  provider,
  checking,
  error,
  onCode,
  onRetry,
  onTyping,
}: {
  provider: SocialProvider;
  checking: boolean;
  error: string | null;
  /** Signs in with the code; false when it was refused, and the boxes clear for another try. */
  onCode: (code: string) => Promise<boolean>;
  onRetry: () => void;
  onTyping: () => void;
}) => {
  const [code, setCode] = useState("");
  const type = (value: string) => {
    onTyping();
    const digits = value.replace(/\D/g, "").slice(0, SIGN_IN_CODE_LENGTH);
    setCode(digits);
    if (digits.length === SIGN_IN_CODE_LENGTH) void onCode(digits).then((signedIn) => signedIn || setCode(""));
  };
  return (
    <div className="flex flex-col items-center gap-5 pt-2">
      <p className="flex items-center gap-3 text-app-body text-app-muted">
        <SemanticIcon name={SIGN_IN_PROVIDER_MARKS[provider]} size={28} />
        {SIGN_IN_WORDS.handoff(provider)}
      </p>
      <AppCode
        label={SIGN_IN_WORDS.handoffCode(provider)}
        code={code}
        length={SIGN_IN_CODE_LENGTH}
        refused={error !== null}
        disabled={checking}
        onType={type}
      />
      {checking && <p className="text-app-strong text-app-muted">{SIGN_IN_WORDS.checking}</p>}
      <AppButton kind="secondary" icon={SIGN_IN_PROVIDER_MARKS[provider]} onClick={onRetry}>
        {SIGN_IN_WORDS.tryAgain(provider)}
      </AppButton>
      <FailureLine line={error} />
    </div>
  );
};
