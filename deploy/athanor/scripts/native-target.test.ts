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
    // A key with no value is Compose's pass-through: the container gets the starting shell's value, or none when the
    // shell has none. Read from the file itself, since what this proves is the package's wiring, not Compose.
    const compose = Bun.YAML.parse(await Bun.file(resolve(root, "deploy/shard/compose.yml")).text()) as {
      services: Record<string, { environment?: Record<string, unknown> }>;
    };
    for (const [name, service] of Object.entries(compose.services)) {
      const environment = service.environment ?? {};
      if (name === "prepare" || name === "init") {
        expect(Object.hasOwn(environment, "OPERATOR_TOKEN")).toBe(true);
        expect(environment.OPERATOR_TOKEN).toBeNull();
      } else expect(Object.hasOwn(environment, "OPERATOR_TOKEN")).toBe(false);
    }
  });

  test("sequencing authority preparation has no default RPC or credential", async () => {
    const error = await runWithoutTarget("deploy/athanor/harness/native/prepare-authority.ts", {});
    expect(error).toContain("RANDOMNESS_PRIVATE_KEY, RPC_URL and NATIVE_AUTHORITY_FILE are required");
  });
});
