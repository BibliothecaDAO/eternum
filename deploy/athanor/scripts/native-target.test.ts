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
    const error = await runWithoutTarget("deploy/athanor/scripts/deploy-gameplay-contracts.ts", target);
    expect(error).toContain("protected operator credential");
    expect(error).toContain("operator-command.py");
  });

  test("the package mounts the protected operator file instead of rendering its value", async () => {
    const compose = Bun.YAML.parse(await Bun.file(resolve(root, "deploy/shard/compose.yml")).text()) as {
      services: Record<
        string,
        {
          environment?: Record<string, unknown>;
          volumes?: { target?: string; read_only?: boolean; bind?: { create_host_path?: boolean } }[];
        }
      >;
    };
    for (const [name, service] of Object.entries(compose.services)) {
      const environment = service.environment ?? {};
      expect(Object.hasOwn(environment, "OPERATOR_TOKEN")).toBe(false);
      if (["prepare", "init", "harness"].includes(name)) {
        expect(environment.OPERATOR_TOKEN_FILE).toBe("/opt/athanor/operator-token");
        const mount = service.volumes?.find((volume) => volume.target === "/opt/athanor/operator-token");
        expect(mount?.read_only).toBe(true);
        expect(mount?.bind?.create_host_path).toBe(false);
      } else expect(Object.hasOwn(environment, "OPERATOR_TOKEN_FILE")).toBe(false);
    }
  });
});
