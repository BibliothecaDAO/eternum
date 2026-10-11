import { expect, test } from "bun:test";

const workflow = Bun.YAML.parse(await Bun.file(new URL("../workflows/deploy-workers.yml", import.meta.url)).text()) as {
  jobs: Record<string, { steps?: { name: string; run?: string }[] }>;
  on: { push: { branches: string[]; paths?: string[]; "paths-ignore"?: string[] } };
};

test("staging follows next and every change can trigger its Worker build", () => {
  expect(workflow.on.push.branches).toEqual(["next"]);
  expect(workflow.on.push.paths).toBeUndefined();
  expect(workflow.on.push["paths-ignore"]).toBeUndefined();
});

const identitySecrets = Object.values(workflow.jobs)
  .flatMap(({ steps }) => steps ?? [])
  .find(({ name }) => name === "Set identity secrets")!.run!;
const required = {
  BETTER_AUTH_SECRET: "test-session",
  L2_RPC_URL: "https://test.invalid",
  OPERATOR_TOKEN: "test-operator",
  WEB_PUSH_VAPID_PUBLIC_KEY: "test-public",
  WEB_PUSH_VAPID_PRIVATE_KEY: "test-private",
  RESEND_API_KEY: "test-mail",
};

test.each([
  ["", ""],
  ["test-client", ""],
  ["", "test-secret"],
  ["test-client", "test-secret"],
])("only uploads Discord as a complete nonempty pair: %s / %s", async (id, secret) => {
  const result = Bun.spawn(
    [
      "bash",
      "-c",
      `pnpm() { cat; }
${identitySecrets}`,
    ],
    {
      env: {
        PATH: process.env.PATH,
        TARGET: "staging",
        ...required,
        DISCORD_CLIENT_ID: id,
        DISCORD_CLIENT_SECRET: secret,
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const uploaded = await new Response(result.stdout).json();
  expect(await result.exited).toBe(0);
  expect(uploaded).toEqual({
    ...required,
    ...(id && secret ? { DISCORD_CLIENT_ID: id, DISCORD_CLIENT_SECRET: secret } : {}),
  });
  expect(await new Response(result.stderr).text()).toBe("");
});
