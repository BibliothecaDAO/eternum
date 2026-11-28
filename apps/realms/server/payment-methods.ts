import { evmPaymentRail, solanaPaymentRail } from "@realms-world/chain";

import { evmRpcUrlOf, solanaRpcUrlOf, stripeCredentialsOf, type IdentityEnv } from "./env";
import { json } from "./http";

type PaymentMethodsEnv = Pick<
  IdentityEnv,
  | "ENVIRONMENT"
  | "EVM_RPC_URL"
  | "SOLANA_RPC_URL"
  | "STRIPE_SECRET_KEY"
  | "STRIPE_WEBHOOK_SECRET"
  | "STRIPE_PUBLISHABLE_KEY"
>;

function paymentMethodsOf(env: PaymentMethodsEnv) {
  const stripe = stripeCredentialsOf(env);
  return {
    starknet: true,
    evm: evmRpcUrlOf(env) ? { chainId: evmPaymentRail(env.ENVIRONMENT).chainId } : null,
    solana: solanaRpcUrlOf(env) ? { cluster: solanaPaymentRail(env.ENVIRONMENT).cluster } : null,
    stripe: stripe ? { publishableKey: stripe.publishableKey } : null,
  };
}

export function handlePaymentMethods(request: Request, env: PaymentMethodsEnv): Response {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  return json(paymentMethodsOf(env));
}
