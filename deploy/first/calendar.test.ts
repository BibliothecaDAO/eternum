import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RpcProvider } from "starknet";
import * as processTools from "./process";
import { seasonSteps } from "./season-steps";
import { PrivateStore } from "./private-store";
import type { Deployment } from "./main";
import { environments, type Inputs } from "./settings";

const temporary: string[] = [];
const originalFetch = globalThis.fetch;
afterEach(() => {
  mock.restore();
  globalThis.fetch = originalFetch;
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});
const now = Date.parse("2027-01-01T00:00:00Z");
const input = {
  frontierStart: "2027-02-01T00:00:00Z",
  frontierEnd: "2027-02-21T00:00:00Z",
} as Inputs;
type Phase = { phase: string; startsAt: string; endsAt: string };
function setup(phases: Phase[], target: (typeof environments)[keyof typeof environments] = environments.dev) {
  spyOn(Date, "now").mockReturnValue(now);
  const base = mkdtempSync(join(tmpdir(), "calendar-recovery-"));
  temporary.push(base);
  mkdirSync(join(base, "repo"));
  const store = new PrivateStore(join(base, "private"), join(base, "repo"), true);
  store.write("pull-request.json", { number: 1 });
  const revision = "a".repeat(40);
  spyOn(processTools, "command").mockImplementation(async ({ argv }) => {
    if (argv[0] === "git") return revision;
    if (argv[1] === "run") return JSON.stringify([{ conclusion: "success", event: "push" }]);
    if (argv[1] === "pr") return JSON.stringify({ state: "MERGED", mergeCommit: { oid: revision } });
    throw new Error("Unexpected command");
  });
  const writes: { url: string; body: unknown }[] = [];
  const output: string[] = [];
  const ledgerReads: string[][] = [];
  globalThis.fetch = mock(async (url, init) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      const name = String(url).split("/").at(-1)!;
      writes.push({ url: String(url), body });
      phases = [...phases.filter((phase) => phase.phase !== name), { phase: name, ...body }];
    }
    return Response.json({ phases });
  }) as unknown as typeof fetch;
  const context = {
    target,
    environment: target.environment,
    apply: true,
    revision,
    store,
    inputs: input,
    assets: { ledger: "0x1", lords: "0x2", mmr: "0x3", chests: "0x4", cosmetics: "0x5" },
    output: (line: string) => output.push(line),
    provider: {
      getBlockWithTxHashes: async () => ({ block_number: 100, timestamp: Date.now() / 1000 }),
      callContract: async ({ calldata }: { calldata: string[] }) => {
        ledgerReads.push(calldata);
        throw new Error("the calendar step reads no ledger");
      },
    } as unknown as RpcProvider,
  } as Deployment;
  return {
    context,
    output,
    writes,
    ledgerReads,
    step: seasonSteps(context).find((step) => step.name === "Season calendar")!,
  };
}
test.each(["dev", "production"] as const)(
  "%s writes its Frontier phase alone and reads no ledger season",
  async (environment) => {
    const { step, writes, ledgerReads } = setup([], environments[environment]);
    expect((await step.inspect()).done).toBe(false);
    await step.apply();
    expect(writes.map(({ url, body }) => [url.split("/").at(-1), body])).toEqual([
      ["frontier", { startsAt: "2027-02-01T00:00:00.000Z", endsAt: "2027-02-21T00:00:00.000Z" }],
    ]);
    expect(ledgerReads).toEqual([]);
    expect((await step.inspect()).done).toBe(true);
  },
);
test("an ended Frontier phase, including the exact end boundary, is replaced with the explicit new dates", async () => {
  const { step, writes } = setup([
    { phase: "frontier", startsAt: "2026-01-01T00:00:00Z", endsAt: "2027-01-01T00:00:00Z" },
  ]);
  expect((await step.inspect()).done).toBe(false);
  await step.apply();
  expect(writes.map(({ body }) => body)).toEqual([
    { startsAt: "2027-02-01T00:00:00.000Z", endsAt: "2027-02-21T00:00:00.000Z" },
  ]);
  expect((await step.inspect()).done).toBe(true);
});
test("a published phase remains authoritative when the private directory has earlier dates", async () => {
  const { step, writes } = setup([
    { phase: "frontier", startsAt: "2026-12-01T00:00:00Z", endsAt: "2027-04-01T00:00:00Z" },
  ]);
  const observation = await step.inspect();
  expect(observation.done).toBe(true);
  expect(observation.detail).toContain("2026-12-01T00:00:00Z");
  await step.apply();
  expect(writes).toEqual([]);
});

test("an unset phase accepts the unchanged entered dates after its start", async () => {
  const startsAt = "2026-10-12T07:00:00Z";
  const endsAt = "2026-10-18T23:00:00Z";
  const { step, context, writes, output } = setup([]);
  context.inputs = { ...input, frontierStart: startsAt, frontierEnd: endsAt };
  spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-12T18:00:00Z"));
  expect((await step.inspect()).done).toBe(false);
  await step.apply();
  expect(output).toEqual(["Setting frontier calendar: 2026-10-12T07:00:00.000Z to 2026-10-18T23:00:00.000Z."]);
  expect(writes.map(({ body }) => body)).toEqual([
    { startsAt: "2026-10-12T07:00:00.000Z", endsAt: "2026-10-18T23:00:00.000Z" },
  ]);
  expect((await step.inspect()).done).toBe(true);
});

test.each([0, 1000])("an unset phase at or beyond its end refuses before writing (%i ms)", async (elapsed) => {
  const { step, writes } = setup([]);
  spyOn(Date, "now").mockReturnValue(Date.parse(input.frontierEnd) + elapsed);
  await expect(step.apply()).rejects.toThrow("A phase must end in the future");
  expect(writes).toEqual([]);
});

test("publishes the explicit window and no preset", async () => {
  const { context, step, writes } = setup([]);
  context.inputs = {
    ...input,
    frontierStart: "2027-11-03T06:30:00Z",
    frontierEnd: "2027-11-06T14:30:00Z",
  };
  await step.apply();
  expect(writes.map(({ body }) => body)).toEqual([
    { startsAt: "2027-11-03T06:30:00.000Z", endsAt: "2027-11-06T14:30:00.000Z" },
  ]);
});
