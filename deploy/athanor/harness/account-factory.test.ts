import { expect, it } from "bun:test";
import { join } from "node:path";

it.each(["limited", "recovered", "unrelated"])("bounds bot sign-in retries (%s)", async (scenario) => {
  const script = `
    import { mock, spyOn } from "bun:test";
    import * as timers from "node:timers/promises";
    let attempts = 0;
    const waits = [], inputs = [];
    spyOn(timers, "setTimeout").mockImplementation(async (ms) => { waits.push(ms); });
    mock.module("@bibliothecadao/eternum", () => ({
      deviceKeyOf: () => ({ publicKey: "0x2" }),
      joinBotAccount: async (input) => {
        inputs.push(input);
        attempts++;
        if (${JSON.stringify(scenario)} === "recovered" && attempts === 3) return { address: "0x3" };
        throw new Error("join failed", { cause: { code: ${scenario === "unrelated" ? -32000 : -32005} } });
      },
    }));
    mock.module("@bibliothecadao/eternum/game-client", () => ({ configureGameplayAccountSubmits: (account) => account }));
    const { createHarnessAccounts } = await import(${JSON.stringify(join(import.meta.dir, "account-factory.ts"))});
    let passed = false;
    try {
      await createHarnessAccounts({ count: 1, gameId: 1, provider: {}, shard: {}, identity: { operatorToken: "fixture" } });
      passed = true;
    } catch {}
    console.log(JSON.stringify({ attempts, waits, passed, sameInput: inputs.every(input => input === inputs[0]) }));
  `;
  const child = Bun.spawn(
    [process.execPath, "--tsconfig-override", join(import.meta.dir, "tsconfig.json"), "-e", script],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const deadline = setTimeout(() => child.kill(), 4_000);
  try {
    const [code, output, error] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    if (code !== 0) throw new Error(`Retry fixture exited ${code}: ${error}`);
    expect(JSON.parse(output.trim().split("\n").at(-1)!)).toEqual({
      attempts: scenario === "unrelated" ? 1 : 3,
      waits: scenario === "unrelated" ? [] : [60_000, 60_000],
      passed: scenario === "recovered",
      sameInput: true,
    });
  } finally {
    clearTimeout(deadline);
    child.kill();
  }
});
