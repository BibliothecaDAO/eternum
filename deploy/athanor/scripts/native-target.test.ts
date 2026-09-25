import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../..");

async function runWithoutTarget(script: string, environment: Record<string, string>) {
  const child = Bun.spawn([process.execPath, script], {
    cwd: root,
    env: environment,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [status, error] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  expect(status).not.toBe(0);
  return error;
}

/** The package's required inputs, so its compose file renders. */
const packageEnvironment = {
  SHARD_NAME: "test-shard",
  CHAIN_ID: "TEST_SHARD",
  GUARDIAN_URL: "https://identity.test/api/guardian",
  PUBLIC_RPC_URL: "https://rpc.test/rpc/v0_10_2",
  PUBLIC_ADMISSION_URL: "https://admission.test",
  PRESETS: "2,5",
  HOST_UID: "1000",
  HOST_GID: "1000",
  SHARD_INIT_IMAGE: "init@sha256:" + "1".repeat(64),
  SHARD_HERALD_IMAGE: "herald@sha256:" + "2".repeat(64),
  SHARD_GATEWAY_IMAGE: "gateway@sha256:" + "3".repeat(64),
};

describe("native deployment target is explicit", () => {
  const target = {
    GAMEPLAY_CONTRACTS_PATH: "/tmp/unused-gameplay-contracts.json",
    RPC_URL: "http://127.0.0.1:1",
    DEPLOYER_ACCOUNT_ADDRESS: "0x1",
    DEPLOYER_PRIVATE_KEY: "0x2",
  };

  for (const name of Object.keys(target)) {
    test(`gameplay deployment refuses missing ${name} before contacting the chain`, async () => {
      const environment: Record<string, string> = { ...target };
      delete environment[name];
      const error = await runWithoutTarget("deploy/athanor/scripts/deploy-gameplay-contracts.ts", environment);
      expect(error).toContain(`${name} is required`);
    });
  }

  test("gameplay deployment names the missing operator approval before contacting the chain", async () => {
    const error = await runWithoutTarget("deploy/athanor/scripts/deploy-gameplay-contracts.ts", {
      ...target,
      OPERATOR_ENROLMENT_PATH: "/nonexistent/operator-enrolment.json",
    });
    expect(error).toContain("OPERATOR_TOKEN");
    expect(error).toContain("enrol-operator.ts");
  });

  test("the shard package passes the operator token to initialization only from the shell that starts it", async () => {
    const initEnvironment = async (extra: Record<string, string>) => {
      const child = Bun.spawn(["docker", "compose", "-f", "deploy/shard/compose.yml", "config", "--format", "json"], {
        cwd: root,
        env: { ...process.env, ...packageEnvironment, ...extra },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [status, output] = await Promise.all([child.exited, new Response(child.stdout).text()]);
      expect(status).toBe(0);
      const services = JSON.parse(output).services;
      return [services.prepare.environment, services.init.environment];
    };
    for (const environment of await initEnvironment({ OPERATOR_TOKEN: "operator-secret" }))
      expect(environment.OPERATOR_TOKEN).toBe("operator-secret");
    // Unset in the shell, the name stays without a value, so the container gets none.
    for (const environment of await initEnvironment({})) expect(environment.OPERATOR_TOKEN ?? null).toBeNull();
  });

  test("sequencing authority preparation has no default RPC or credential", async () => {
    const error = await runWithoutTarget("deploy/athanor/harness/native/prepare-authority.ts", {});
    expect(error).toContain("RANDOMNESS_PRIVATE_KEY, RPC_URL and NATIVE_AUTHORITY_FILE are required");
  });
});
