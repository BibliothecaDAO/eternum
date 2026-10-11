import { expect, it } from "vitest";
import { decodeLaunchEnv } from "./env";
it("starts with operator credentials and no wallet authority", () => {
  const settings = {
    ENVIRONMENT: "staging",
    BASE_URL: "https://play.dev-realms.party",
    DEPLOYER_PRIVATE_KEY: "0x2",
    OPERATOR_TOKEN: "operator",
  };
  expect(decodeLaunchEnv(settings).BASE_URL).toBe(settings.BASE_URL);
  expect(() => decodeLaunchEnv({ ...settings, OPERATOR_TOKEN: undefined })).toThrow();
});
