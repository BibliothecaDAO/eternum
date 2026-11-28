const STRIPE_SCRIPT_URL = "https://js.stripe.com/v3/";

export interface StripePaymentElement {
  mount: (container: HTMLElement) => void;
  unmount: () => void;
}

export interface StripeElements {
  create: (type: "payment") => StripePaymentElement;
}

export interface StripeInstance {
  elements: (options: { clientSecret: string; appearance?: { theme: string } }) => StripeElements;
  confirmPayment: (options: {
    elements: StripeElements;
    redirect: "if_required";
  }) => Promise<{ error?: { message?: string }; paymentIntent?: { id: string; status: string } }>;
}

type StripeConstructor = (publishableKey: string) => StripeInstance;

interface WindowWithStripe extends Window {
  Stripe?: StripeConstructor;
}

let scriptPromise: Promise<StripeConstructor> | null = null;

const loadStripeConstructor = (): Promise<StripeConstructor> => {
  const existing = (window as WindowWithStripe).Stripe;
  if (typeof existing === "function") return Promise.resolve(existing);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<StripeConstructor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = STRIPE_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      const loaded = (window as WindowWithStripe).Stripe;
      if (typeof loaded === "function") resolve(loaded);
      else {
        scriptPromise = null;
        reject(new Error("Stripe.js loaded without window.Stripe"));
      }
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load Stripe.js"));
    };
    document.head.append(script);
  });
  return scriptPromise;
};

export const loadStripeJs = async (publishableKey: string): Promise<StripeInstance> => {
  if (!publishableKey.trim()) throw new Error("Missing Stripe publishable key");
  const Stripe = await loadStripeConstructor();
  return Stripe(publishableKey);
};
