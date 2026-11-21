import { lazy, Suspense, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { FragmentPrice } from "@realms-world/identity";

import { l2Provider } from "@/runtime/l2-rpc";
import { AppChoice, AppNotice } from "@/ui/design-system/kit/app-elements";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { FRAGMENTS_PAGE_WORDS } from "@/ui/design-system/kit/words";
import { tokenBalanceOf } from "@/ui/modules/identity/wallet-send";

import { Loading } from "../loading";
import { lordsOf } from "../value/ledger";
import { PAY_TOKEN_ICONS, payTokensFor, paymentIn, type PayToken, type TokenPayment } from "./pay-tokens";

const WalletSign = lazy(() =>
  import("@/shell/value/wallet-actions").then((module) => ({ default: module.WalletSign })),
);

type Quote = NonNullable<FragmentPrice["quote"]>;

export const PayWith = ({
  payer,
  passkey,
  quote,
  cents,
  onSent,
}: {
  payer: string;
  passkey: boolean;
  quote: Quote;
  cents: number;
  onSent: (hash: string) => void;
}) => {
  const tokens = payTokensFor(quote);
  const reading = useTokenPayments(tokens, quote, payer, passkey);
  const [chosen, setChosen] = useState<PayToken["key"] | null>(null);
  if (reading.pending) return <AppNotice line={FRAGMENTS_PAGE_WORDS.pricingTokens} />;
  const payable = reading.payable;
  if (payable.length === 0 && reading.failure)
    return <ServiceFailure service={reading.failure.service} error={reading.failure.error} retry={reading.retry} />;
  if (payable.length === 0)
    return (
      <AppNotice
        tone="warn"
        line={FRAGMENTS_PAGE_WORDS.tooLittle(
          cents,
          tokens.map(({ symbol }) => symbol),
        )}
      />
    );
  const paying = payable.find(({ payment }) => payment.token.key === chosen) ?? payable[0]!;
  return (
    <div className="flex flex-col gap-3">
      <span className="text-app-label text-app-muted">{FRAGMENTS_PAGE_WORDS.payWith}</span>
      <div className="grid grid-cols-2 gap-2" data-pay-tokens>
        {payable.map(({ payment, held }) => (
          <AppChoice
            key={payment.token.key}
            icon={PAY_TOKEN_ICONS[payment.token.key]}
            title={payment.token.symbol}
            price={costOf(payment)}
            detail={FRAGMENTS_PAGE_WORDS.holds(unitsOf(held, payment.token))}
            selected={payment.token.key === paying.payment.token.key}
            onClick={() => setChosen(payment.token.key)}
          />
        ))}
      </div>
      <Suspense fallback={<Loading />}>
        <WalletSign
          key={paying.payment.token.key}
          owner={payer}
          calls={paying.payment.calls}
          lordsBought={paying.payment.lordsBought}
          onSent={onSent}
          onLanded={() => undefined}
        />
      </Suspense>
    </div>
  );
};

const useTokenPayments = (tokens: PayToken[], quote: Quote, payer: string, passkey: boolean) => {
  const balances = useQueries({
    queries: tokens.map((token) => ({
      queryKey: ["payTokenBalance", token.address, payer],
      queryFn: () => tokenBalanceOf(l2Provider(), token.address, payer),
    })),
  });
  const payments = useQueries({
    queries: tokens.map((token, index) => ({
      queryKey: ["payTokenPayment", token.address, quote.id, payer, passkey],
      queryFn: () => paymentIn(token, quote, payer, passkey),
      enabled: (balances[index]?.data ?? 0n) > 0n,
      retry: false,
    })),
  });
  const pending = balances.some(({ isPending }) => isPending) || payments.some(({ isLoading }) => isLoading);
  const payable = tokens.flatMap((_, index) => {
    const held = balances[index]?.data;
    const payment = payments[index]?.data;
    return held !== undefined && payment && held >= payment.most ? [{ payment, held }] : [];
  });
  const unread = balances.find(({ error }) => error);
  const unpriced = payments.find(({ error }) => error);
  const failure = unread
    ? { service: "ledger" as const, error: unread.error }
    : unpriced
      ? { service: "market" as const, error: unpriced.error }
      : null;
  const retry = () => {
    for (const query of [...balances, ...payments]) if (query.error) void query.refetch();
  };
  return { pending, payable, failure, retry };
};

const costOf = (payment: TokenPayment) =>
  payment.token.key === "lords"
    ? FRAGMENTS_PAGE_WORDS.lordsCost(lordsOf(payment.cost))
    : FRAGMENTS_PAGE_WORDS.tokenCost(unitsOf(payment.cost, payment.token), payment.token.symbol);

const unitsOf = (amount: bigint, token: PayToken) => Number(amount) / 10 ** token.decimals;
