import { Effect, Result } from "effect";
import { expect, test } from "vitest";
import { readLaunchServiceConfig } from "./config";

const environment = {
  DATABASE_URL: "postgres://launch",
  IDENTITY_URL: "http://127.0.0.1:3000",
  CORS_ORIGIN: "https://play.realms.party",
  LAUNCHER_ALLOWLIST: "0x123",
  RPC_URL: "http://rpc",
  ADMISSION_URL: "http://admission",
  HERALD_URL: "http://herald",
  NATIVE_WORLD_MANIFEST: "manifest.json",
  DEPLOYER_ACCOUNT_ADDRESS: "0x456",
  DEPLOYER_PRIVATE_KEY: "0x1",
};

test("the release configuration refuses a wildcard launcher allowlist", async () => {
  expect((await Effect.runPromise(readLaunchServiceConfig(environment))).launcherAllowlist).toEqual(new Set(["0x123"]));
  const wildcard = await Effect.runPromise(
    Effect.result(readLaunchServiceConfig({ ...environment, LAUNCHER_ALLOWLIST: "0x123,*" })),
  );
  const reason = Result.isFailure(wildcard) ? (wildcard.failure.cause as { cause?: Error }).cause?.message : undefined;
  expect(reason).toContain("LAUNCHER_ALLOWLIST");
});
