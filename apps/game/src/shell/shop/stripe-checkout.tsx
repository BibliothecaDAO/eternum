import { useEffect, useRef, useState, type FormEvent } from "react";
import type { StripePaymentIntent } from "@realms-world/identity";

import { identityClient } from "@/hooks/context/identity-session";
import { AppButton, AppFigure, AppNotice, AppPanel } from "@/ui/design-system/kit/app-elements";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { FRAGMENTS_PAGE_WORDS } from "@/ui/design-system/kit/words";

import type { SentPayment, ShopGameRef } from "./fragment-payment";
import { loadStripeJs, type StripeElements, type StripeInstance } from "./stripe-loader";

interface StripeCheckoutProps {
  readonly game: ShopGameRef;
  readonly fragments: number;
  readonly publishableKey: string;
  readonly onPaid: (payment: SentPayment) => void;
  readonly onCancel: () => void;
}

const StripeCheckout = ({ game, fragments, publishableKey, onPaid, onCancel }: StripeCheckoutProps) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<StripeInstance | null>(null);
  const elementsRef = useRef<StripeElements | null>(null);
  const [intent, setIntent] = useState<StripePaymentIntent | null>(null);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [decline, setDecline] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  const { chainId, gameId } = game;

  useEffect(() => {
    let active = true;
    let element: { unmount: () => void } | null = null;
    setReady(false);
    setLoadError(null);
    setDecline(null);
    const boot = async () => {
      try {
        const created = await identityClient.createStripeIntent({ chainId, gameId, fragments });
        if (!active) return;
        setIntent(created);
        const stripe = await loadStripeJs(publishableKey);
        if (!active || !mountRef.current) return;
        const elements = stripe.elements({ clientSecret: created.clientSecret, appearance: { theme: "night" } });
        const paymentElement = elements.create("payment");
        paymentElement.mount(mountRef.current);
        stripeRef.current = stripe;
        elementsRef.current = elements;
        element = paymentElement;
        setReady(true);
      } catch (caught) {
        if (active) setLoadError(caught);
      }
    };
    void boot();
    return () => {
      active = false;
      element?.unmount();
      stripeRef.current = null;
      elementsRef.current = null;
    };
  }, [chainId, gameId, fragments, publishableKey, attempt]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripeRef.current || !elementsRef.current || !intent || submitting) return;
    setDecline(null);
    setSubmitting(true);
    try {
      const result = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        redirect: "if_required",
      });
      if (result.error) {
        setDecline(result.error.message ?? FRAGMENTS_PAGE_WORDS.stripeUnavailable);
        setSubmitting(false);
        return;
      }
      onPaid({
        quoteId: intent.intentId,
        hash: result.paymentIntent?.id ?? intent.intentId,
        fragments: intent.fragments,
        rail: "stripe",
      });
    } catch (caught) {
      setDecline(caught instanceof Error ? caught.message : FRAGMENTS_PAGE_WORDS.stripeUnavailable);
      setSubmitting(false);
    }
  };

  return (
    <AppPanel icon="fragment" title={FRAGMENTS_PAGE_WORDS.stripeHeading}>
      <form className="flex flex-col gap-3" data-stripe-checkout onSubmit={(event) => void submit(event)}>
        <AppFigure
          tone="gold"
          value={FRAGMENTS_PAGE_WORDS.price(fragments)}
          label={FRAGMENTS_PAGE_WORDS.pack(fragments)}
        />
        {!ready && loadError === null && <AppNotice line={FRAGMENTS_PAGE_WORDS.stripeLoading} />}
        <div ref={mountRef} className="shop-stripe-element" data-stripe-element />
        {decline && <AppNotice tone="bad" line={decline} />}
        {loadError !== null && (
          <ServiceFailure service="season" error={loadError} retry={() => setAttempt((count) => count + 1)} />
        )}
        <div className="flex flex-wrap gap-2">
          <AppButton
            kind="primary"
            size="lg"
            type="submit"
            icon="fragment"
            disabled={!ready || submitting}
            busy={submitting ? FRAGMENTS_PAGE_WORDS.stripeProcessing : undefined}
          >
            {FRAGMENTS_PAGE_WORDS.pay(fragments)}
          </AppButton>
          <AppButton kind="quiet" disabled={submitting} onClick={onCancel}>
            {FRAGMENTS_PAGE_WORDS.cancelCheckout}
          </AppButton>
        </div>
      </form>
    </AppPanel>
  );
};

export default StripeCheckout;
