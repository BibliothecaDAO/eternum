import { afterEach, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Deployment } from "./main";
import { PrivateStore } from "./private-store";
import { runSteps } from "./run";
import { seasonSteps } from "./season-steps";
import { environments, type Inputs } from "./settings";

const temporary: string[] = [];
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

/** The service's seal-price route as the Worker answers it: set once, the same value again is a no-op. */
function launch(inputs: Partial<Inputs>, held: number | null = null) {
  const base = mkdtempSync(join(tmpdir(), "seal-price-"));
  temporary.push(base);
  mkdirSync(join(base, "repo"));
  const store = new PrivateStore(join(base, "private"), join(base, "repo"), true);
  const posts: unknown[] = [];
  globalThis.fetch = mock(async (url, init) => {
    expect(String(url)).toBe(`${environments.dev.origin}/api/operator/seal-price`);
    if (init?.method !== "POST")
      return held === null
        ? Response.json({ error: "seal_price_not_set" }, { status: 404 })
        : Response.json({ usd: held });
    const { usd } = JSON.parse(String(init.body));
    posts.push(usd);
    if (held !== null && held !== usd) return Response.json({ error: "seal_price_already_set" }, { status: 409 });
    held = usd;
    return Response.json({ usd });
  }) as unknown as typeof fetch;
  const output: string[] = [];
  const context = {
    target: environments.dev,
    environment: "dev",
    apply: true,
    store,
    inputs: inputs as Inputs,
    assets: { ledger: "0x1", lords: "0x2", mmr: "0x3", chests: "0x4", cosmetics: "0x5" },
    output: (line: string) => output.push(line),
  } as unknown as Deployment;
  const step = seasonSteps(context).find((step) => step.name === "Seal launch price")!;
  return { step, store, posts, output };
}

test("the launch sets the Seal's reviewed price once, records it, and a second run writes nothing", async () => {
  const { step, store, posts } = launch({ sealLordsUsd: 0.003637 });
  expect((await step.inspect()).done).toBe(false);
  expect(await runSteps([step], true, () => undefined)).toBe(true);
  expect(await runSteps([step], true, () => undefined)).toBe(true);
  expect(posts).toEqual([0.003637]);
  expect(store.read<{ usd: number }>("seal-launch-price.json")).toMatchObject({ usd: 0.003637 });
});

test("a season whose inputs name no reviewed Seal price fails loudly, in a dry run too", async () => {
  for (const sealLordsUsd of [undefined, 0, -1, Number.NaN]) {
    const { step, posts } = launch({ sealLordsUsd });
    await expect(step.inspect()).rejects.toThrow("sealLordsUsd");
    await expect(step.apply()).rejects.toThrow("sealLordsUsd");
    expect(posts).toEqual([]);
  }
});

test("a price already set to another value stops the launch instead of being replaced", async () => {
  const { step, posts } = launch({ sealLordsUsd: 0.004 }, 0.003637);
  await expect(step.inspect()).rejects.toThrow("not the reviewed $0.004");
  expect(posts).toEqual([]);
});

test("a price the service refuses fails the launch step", async () => {
  const { step } = launch({ sealLordsUsd: 0.004 }, 0.003637);
  await expect(step.apply()).rejects.toThrow("seal_price_already_set");
});
