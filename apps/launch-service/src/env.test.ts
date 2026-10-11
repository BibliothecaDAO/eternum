import { describe, expect, it } from "vitest";
import { decodeLaunchEnv } from "./env";

const vars = (launchers: string) => ({
  ENVIRONMENT: "staging",
  BASE_URL: "https://play.dev-realms.party",
  LAUNCHER_ALLOWLIST: launchers,
  DEPLOYER_PRIVATE_KEY: "0x2",
  OPERATOR_TOKEN: "operator",
});

describe("the launch Worker's environment", () => {
  it("names each launcher by address and refuses a wildcard", () => {
    expect([...decodeLaunchEnv(vars(" 0x0A, 0xb ,")).launchers]).toHaveLength(2);
    expect(() => decodeLaunchEnv(vars("0xa,*"))).toThrow("LAUNCHER_ALLOWLIST must name launcher addresses, not *");
    expect(() => decodeLaunchEnv(vars(""))).toThrow();
  });
});
it("starts with the documented launch settings and no second ledger configuration", () => {
  const settings = vars("0x1");
  expect(decodeLaunchEnv(settings).BASE_URL).toBe(settings.BASE_URL);
});
