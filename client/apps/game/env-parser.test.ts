// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parseGameEnv } from "./env-parser";

const minimalValidEnv = {
  VITE_PUBLIC_MASTER_ADDRESS: "0x1",
  VITE_PUBLIC_MASTER_PRIVATE_KEY: "0x2",
  VITE_PUBLIC_ACCOUNT_CLASS_HASH: "0x3",
  VITE_PUBLIC_FEE_TOKEN_ADDRESS: "0x4",
  VITE_PUBLIC_CLIENT_FEE_RECIPIENT: "0x5",
  VITE_SOCIAL_LINK: "https://example.com",
  VITE_PUBLIC_MOBILE_VERSION_URL: "https://m.example.com",
  VITE_PUBLIC_SLOT: "test-slot",
};

describe("parseGameEnv", () => {
  it("preserves zero subscription setup timeout so operators can disable the timeout", () => {
    const env = parseGameEnv({
      ...minimalValidEnv,
      VITE_PUBLIC_TORII_SUBSCRIPTION_SETUP_TIMEOUT_MS: "0",
    });

    expect(env.VITE_PUBLIC_TORII_SUBSCRIPTION_SETUP_TIMEOUT_MS).toBe(0);
  });
});
