// @vitest-environment node
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "vite";
import { afterEach, expect, it, vi } from "vitest";
import { envSchema, suppliedPublicEnv } from "../env";
import { retiredVariableProblem } from "./retired-env";

const APP = join(__dirname, "..");
const LEFTOVER_KEY = "FAKE_LEFTOVER_RPC_KEY_9f3a";
const ENTRY = "virtual:whole-env-module";
const LISTED_VALUE = "https://listed-canary.example";

afterEach(() => vi.unstubAllEnvs());

/** Every file the client's environment entry emits, built as production builds it, with `variables` in the build environment. */
async function emitted(variables: Record<string, string>) {
  for (const [name, value] of Object.entries(variables)) vi.stubEnv(name, value);
  const result = await build({
    root: APP,
    configFile: false,
    mode: "production",
    logLevel: "silent",
    plugins: [
      {
        name: "whole-module-entry",
        resolveId: (id) => (id === ENTRY ? id : undefined),
        load: (id) =>
          id === ENTRY
            ? `import * as everything from ${JSON.stringify(join(APP, "env.ts"))}; globalThis.everything = everything;`
            : undefined,
      },
    ],
    build: { write: false, minify: false, rollupOptions: { input: ENTRY } },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((one) => ("output" in one ? one.output : []));
  return outputs.map((file) => ("code" in file ? file.code : String(file.source))).join("\n");
}

it("emits no variable the app does not list, a leftover RPC key included, and still emits the listed ones", async () => {
  const code = await emitted({
    VITE_PUBLIC_L2_RPC_URL: `https://rpc.example/${LEFTOVER_KEY}`,
    VITE_SOCIAL_LINK: LISTED_VALUE,
  });
  expect(code).toContain(LISTED_VALUE);
  expect(code).not.toContain(LEFTOVER_KEY);
}, 120_000);

it("lists exactly the schema's variables", () => {
  expect(Object.keys(suppliedPublicEnv).sort()).toEqual(Object.keys(envSchema.fields).sort());
});

const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

it("reads import.meta.env nowhere as a whole, since a whole read ships every variable the build was given", async () => {
  const bare = /import\.meta\.env(?![.?\w])/;
  const found: string[] = [];
  const scan = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await scan(path);
      else if (
        /\.(ts|tsx)$/.test(entry.name) &&
        !/\.test\./.test(entry.name) &&
        bare.test(withoutComments(await readFile(path, "utf8")))
      )
        found.push(path.slice(APP.length + 1));
    }
  };
  await scan(join(APP, "src"));
  expect(found).toEqual([]);
  expect(bare.test(withoutComments(await readFile(join(APP, "env.ts"), "utf8")))).toBe(false);
});

it("refuses a retired variable by name and never shows its value", () => {
  const problem = retiredVariableProblem({ VITE_PUBLIC_L2_RPC_URL: `https://rpc.example/${LEFTOVER_KEY}` });
  expect(problem).toContain("VITE_PUBLIC_L2_RPC_URL is retired");
  expect(problem).not.toContain(LEFTOVER_KEY);
  expect(retiredVariableProblem({ VITE_PUBLIC_L2_RPC_URL: "" })).toBeNull();
  expect(retiredVariableProblem({})).toBeNull();
});
