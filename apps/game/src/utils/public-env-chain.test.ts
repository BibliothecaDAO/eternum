// @vitest-environment node

import { describe, expect, it } from "vitest";

import { parsePublicEnv } from "../../env";

const REQUIRED_ENV = {
  VITE_PUBLIC_ACCOUNT_CLASS_HASH: "0x1",
  VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH: "0x2",
  VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS: "0x3",
  VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS: "0x4",
  VITE_PUBLIC_FEE_TOKEN_ADDRESS: "0x5",
  VITE_PUBLIC_CLIENT_FEE_RECIPIENT: "0x0",
  VITE_PUBLIC_NODE_URL: "https://rpc.realms.test/rpc/v0_9_0",
  VITE_PUBLIC_TORII: "https://torii.realms.test",
  VITE_PUBLIC_IDENTITY_ORIGIN: "https://realms.test",
  VITE_PUBLIC_IDENTITY_RPC_URL: "https://identity-rpc.realms.test",
};

describe("chain-specific public environment", () => {
  it("boots Madara without appchain master credentials", () => {
    expect(parsePublicEnv({ ...REQUIRED_ENV, VITE_PUBLIC_CHAIN: "madara" }).VITE_PUBLIC_CHAIN).toBe("madara");
  });

  it("fails immediately when appchain master credentials are absent", () => {
    expect(() => parsePublicEnv({ ...REQUIRED_ENV, VITE_PUBLIC_CHAIN: "appchain" })).toThrow(
      "Appchain builds require both VITE_PUBLIC_MASTER_ADDRESS and VITE_PUBLIC_MASTER_PRIVATE_KEY",
    );
  });
});
