import { WALLET_WORDS } from "@/ui/design-system/kit/words";
import { AppButton } from "@/ui/design-system/kit/app-elements";

/** The account's wallet could not be read: never taken for none (that would ask a passkey owner for another wallet). */
export const WalletUnread = ({ onRetry }: { onRetry: () => void }) => (
  <div className="flex w-full flex-col gap-2.5">
    <span className="text-app-label text-app-bad">{WALLET_WORDS.walletUnread}</span>
    <AppButton kind="secondary" icon="refresh" onClick={onRetry}>
      {WALLET_WORDS.tryAgain}
    </AppButton>
  </div>
);
