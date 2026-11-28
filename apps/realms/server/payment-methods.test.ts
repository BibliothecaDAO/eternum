import { expect, it } from "vitest";
import { evmPaymentRail, solanaPaymentRail } from "@realms-world/chain";

import { handlePaymentMethods } from "./payment-methods";

it("returns only enabled rail capabilities and never leaks secrets or RPC URLs", async () => {
  const disabled = handlePaymentMethods(new Request("https://realms.test/api/shop/payment-methods"), {
    ENVIRONMENT: "production",
    EVM_RPC_URL: undefined,
    SOLANA_RPC_URL: undefined,
    STRIPE_SECRET_KEY: undefined,
    STRIPE_WEBHOOK_SECRET: undefined,
    STRIPE_PUBLISHABLE_KEY: undefined,
  });
  expect(disabled.status).toBe(200);
  expect(await disabled.json()).toEqual({
    starknet: true,
    evm: null,
    solana: null,
    stripe: null,
  });

  const enabled = handlePaymentMethods(new Request("https://realms.test/api/shop/payment-methods"), {
    ENVIRONMENT: "production",
    EVM_RPC_URL: "https://eth-secret-rpc.example/key",
    SOLANA_RPC_URL: "https://sol-secret-rpc.example/key",
    STRIPE_SECRET_KEY: "sk_live_never_expose",
    STRIPE_WEBHOOK_SECRET: "whsec_never_expose",
    STRIPE_PUBLISHABLE_KEY: "pk_live_public",
  });
  const text = await enabled.text();
  expect(text).not.toContain("eth-secret-rpc");
  expect(text).not.toContain("sol-secret-rpc");
  expect(text).not.toContain("sk_live_never_expose");
  expect(text).not.toContain("whsec_never_expose");
  expect(JSON.parse(text)).toEqual({
    starknet: true,
    evm: { chainId: evmPaymentRail("production").chainId },
    solana: { cluster: solanaPaymentRail("production").cluster },
    stripe: { publishableKey: "pk_live_public" },
  });
});
