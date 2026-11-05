import { lazy, Suspense } from "react";

import { useDepositPaymentStore } from "@/hooks/store/use-deposit-payment-store";
import { Loading } from "@/shell/loading";
import { AppButton, AppDialog } from "@/ui/design-system/kit/app-elements";
import { CLOSE, VALUE_WORDS } from "@/ui/design-system/kit/words";

const WalletSign = lazy(() => import("./wallet-actions").then(({ WalletSign }) => ({ default: WalletSign })));

/**
 * The purse's deposit, paid where every wallet send is drawn: the one wallet send (its passkey fee in LORDS, or the
 * linked wallet's prompt), over the game. Closing it leaves the payment's terms with the purse, which offers it again.
 */
export const DepositPaymentDialog = () => {
  const payment = useDepositPaymentStore((state) => state.payment);
  const close = useDepositPaymentStore((state) => state.close);
  if (!payment) return null;
  const landed = () => {
    close();
    payment.onLanded();
  };
  return (
    <AppDialog
      title={VALUE_WORDS.depositTitle(payment.amount)}
      onClose={close}
      actions={
        <AppButton kind="quiet" onClick={close}>
          {CLOSE}
        </AppButton>
      }
    >
      <Suspense fallback={<Loading />}>
        <WalletSign key={payment.request} owner={payment.owner} calls={payment.calls} onLanded={landed} />
      </Suspense>
    </AppDialog>
  );
};
