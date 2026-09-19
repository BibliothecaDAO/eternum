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
    RPC_URL: "http://127.0.0.1:1",
    DEPLOYER_ACCOUNT_ADDRESS: "0x1",
    DEPLOYER_PRIVATE_KEY: "0x2",
    BINDING_AUTHORITY_ADDRESS: "0x3",
  };

  for (const name of Object.keys(target)) {
    test(`gameplay deployment refuses missing ${name} before contacting the chain`, async () => {
      const environment: Record<string, string> = { ...target };
      delete environment[name];
      const error = await runWithoutTarget("deploy/athanor/scripts/deploy-gameplay-contracts.ts", environment);
      expect(error).toContain(`${name} is required`);
    });
  }

  test("sequencing authority preparation has no default RPC or credential", async () => {
    const error = await runWithoutTarget("deploy/athanor/harness/native/prepare-authority.ts", {});
    expect(error).toContain("RANDOMNESS_PRIVATE_KEY, RPC_URL and NATIVE_AUTHORITY_FILE are required");
  });
});
