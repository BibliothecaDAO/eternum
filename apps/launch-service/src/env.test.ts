import { describe, expect, it } from "vitest";
import { decodeLaunchEnv } from "./env";

const vars = (launchers: string) => ({
  ENVIRONMENT: "staging",
  BASE_URL: "https://staging.realms.party",
  LAUNCHER_ALLOWLIST: launchers,
  SHARD_URL: "https://staging-herald.realms.party",
  DEPLOYER_ACCOUNT_ADDRESS: "0x1",
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
