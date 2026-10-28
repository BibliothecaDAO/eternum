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
  frontierPresetId: "5",
  frontierStart: "2027-02-01T00:00:00Z",
  frontierEnd: "2027-02-21T00:00:00Z",
  blitzStart: "2027-02-01T00:00:00Z",
  blitzEnd: "2027-03-01T00:00:00Z",
  amount: "1000",
} as Inputs;
type Phase = { phase: string; presetId?: number; startsAt: string; endsAt: string };
function setup(
  phases: Phase[],
  windows = [{ startsAt: input.blitzStart!, endsAt: input.blitzEnd! }],
  target: (typeof environments)[keyof typeof environments] = environments.dev,
) {
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
        const window = windows[Number(calldata[0]) - 1];
        if (!window) throw { code: 40, message: "Ledger: unknown Blitz season" };
        return [
          ...Array(10).fill("0"),
          "1",
          "1",
          String(Date.parse(window.startsAt) / 1000),
          String(Date.parse(window.endsAt) / 1000),
          "0",
          "0",
        ];
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
test("a Frontier-only environment writes its Frontier phase alone and reads no Blitz season", async () => {
  const { blitzStart: _blitzStart, blitzEnd: _blitzEnd, ...frontierOnly } = input;
  const { context, step, writes, ledgerReads } = setup([], [], environments.production);
  context.inputs = frontierOnly as Inputs;
  expect((await step.inspect()).done).toBe(false);
  await step.apply();
  expect(writes.map(({ url, body }) => [url.split("/").at(-1), body])).toEqual([
    ["frontier", { presetId: 5, startsAt: "2027-02-01T00:00:00.000Z", endsAt: "2027-02-21T00:00:00.000Z" }],
  ]);
  expect(ledgerReads).toEqual([]);
  expect((await step.inspect()).done).toBe(true);
});
test("ended phases, including the exact end boundary, are replaced with explicit new dates", async () => {
  const { step, writes } = setup(
    ["frontier", "blitz"].map((phase) => ({
      phase,
      ...(phase === "frontier" ? { presetId: 5 } : {}),
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2027-01-01T00:00:00Z",
    })),
  );
  expect((await step.inspect()).done).toBe(false);
  await step.apply();
  expect(writes).toHaveLength(2);
  expect(writes[0]!.body).toEqual({
    presetId: 5,
    startsAt: "2027-02-01T00:00:00.000Z",
    endsAt: "2027-02-21T00:00:00.000Z",
  });
  expect((await step.inspect()).done).toBe(true);
});
test("published phases remain authoritative when the private directory has earlier dates", async () => {
  const { step, writes } = setup(
    ["frontier", "blitz"].map((phase) => ({
      phase,
      ...(phase === "frontier" ? { presetId: 5 } : {}),
      startsAt: "2026-12-01T00:00:00Z",
      endsAt: "2027-04-01T00:00:00Z",
    })),
  );
  const observation = await step.inspect();
  expect(observation.done).toBe(true);
  expect(observation.detail).toContain("2026-12-01T00:00:00Z");
  await step.apply();
  expect(writes).toEqual([]);
});
test("a matching future phase is preserved while the ended phase is replaced", async () => {
  const { step, writes } = setup([
    { phase: "frontier", presetId: 5, startsAt: input.frontierStart, endsAt: input.frontierEnd },
    { phase: "blitz", startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-02-01T00:00:00Z" },
  ]);
  await step.apply();
  expect(writes).toHaveLength(1);
  expect(writes[0]!.url).toEndWith("/blitz");
});

test("calendar accepts season two from the ledger after the first ended", async () => {
  const { step, writes } = setup(
    [],
    [
      { startsAt: "2026-01-01T00:00:00Z", endsAt: "2027-01-01T00:00:00Z" },
      { startsAt: input.blitzStart!, endsAt: input.blitzEnd! },
    ],
  );
  await step.apply();
  expect(writes).toHaveLength(2);
  expect((await step.inspect()).done).toBe(true);
});
test("a conflicting future ledger season refuses before any calendar write", async () => {
  const { step, writes } = setup([], [{ startsAt: "2027-02-01T00:00:00Z", endsAt: "2027-04-01T00:00:00Z" }]);
  await expect(step.inspect()).rejects.toThrow("running or future Blitz season");
  await expect(step.apply()).rejects.toThrow("running or future Blitz season");
  expect(writes).toEqual([]);
});

test("unset phases accept the unchanged entered dates after their start", async () => {
  const startsAt = "2026-10-12T07:00:00Z";
  const endsAt = "2026-10-18T23:00:00Z";
  const { step, context, writes, output } = setup([], [{ startsAt, endsAt }]);
  context.inputs = { ...input, frontierStart: startsAt, frontierEnd: endsAt, blitzStart: startsAt, blitzEnd: endsAt };
  spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-12T18:00:00Z"));
  expect((await step.inspect()).done).toBe(false);
  await step.apply();
  expect(output).toEqual([
    "Setting frontier preset 5 calendar: 2026-10-12T07:00:00.000Z to 2026-10-18T23:00:00.000Z.",
    "Setting blitz calendar: 2026-10-12T07:00:00.000Z to 2026-10-18T23:00:00.000Z.",
  ]);
  expect(writes.map(({ url }) => url.split("/").at(-1))).toEqual(["frontier", "blitz"]);
  expect(writes.map(({ body }) => body)).toEqual([
    { presetId: 5, startsAt: "2026-10-12T07:00:00.000Z", endsAt: "2026-10-18T23:00:00.000Z" },
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

test("publishes the selected Devcon preset with its explicit window and keeps Blitz preset-free", async () => {
  const { context, step, writes } = setup([]);
  context.inputs = {
    ...input,
    frontierPresetId: "6",
    frontierStart: "2027-11-03T06:30:00Z",
    frontierEnd: "2027-11-06T14:30:00Z",
  };
  await step.apply();
  expect(writes[0]!.body).toEqual({
    presetId: 6,
    startsAt: "2027-11-03T06:30:00.000Z",
    endsAt: "2027-11-06T14:30:00.000Z",
  });
  expect(writes[1]!.body).toEqual({ startsAt: "2027-02-01T00:00:00.000Z", endsAt: "2027-03-01T00:00:00.000Z" });
});
