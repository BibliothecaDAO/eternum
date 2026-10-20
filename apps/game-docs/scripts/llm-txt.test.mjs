import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

/** The export generator and the post-build check, as the build runs them. */
const { renderLlmTxt } = await import(new URL("../vite-plugin-llm-txt.mjs", import.meta.url).href);
const { exportProblems, forbiddenValues } = await import(new URL("./check-rendered-balance.mjs", import.meta.url).href);

let root;

before(async () => {
  root = await mkdtemp(join(tmpdir(), "llm-txt-test-"));
  await writeFile(join(root, "rules.mjs"), "export const stats = { stamina: 120 };\n");
});

after(() => rm(root, { recursive: true, force: true }));

/** Exports one page holding `body`, as the build does. */
const exportPage = async (name, body) => {
  const file = join(root, `${name}.mdx`);
  await writeFile(file, `import { stats as rules } from "./rules.mjs";\n\n# Page\n\n${body}\n`);
  return renderLlmTxt([file], root);
};

test("a finite value is written as its number", async () => {
  const llm = await exportPage("finite", "An army holds {rules.stamina} stamina, {60 * 2} at most.");
  assert.match(llm, /An army holds 120 stamina, 120 at most\./);
  assert.deepEqual(exportProblems(llm, []), []);
  assert.deepEqual(forbiddenValues(root, llm), []);
});

for (const [name, expression] of [
  ["nan", "Number.NaN"],
  ["infinity", "1 / 0"],
  ["renamed-missing", "rules.missing"],
  ["object-missing", "({}).missing"],
]) {
  test(`{${expression}} fails the export, naming its page and expression`, async () => {
    await assert.rejects(exportPage(name, `Value: {${expression}}`), (error) => {
      assert.match(error.message, new RegExp(`${name}\\.mdx: \\{${expression.replace(/[().*/]/g, "\\$&")}\\}`));
      return true;
    });
  });
}

test("an expression left in the export is reported whatever its name", () => {
  const llm = "file: docs/pages/a.mdx\nmeta: {}\n\nValue: {rules.missing}\n";
  assert.deepEqual(exportProblems(llm, []), [
    { page: "llm.txt docs/pages/a.mdx", run: ["unevaluated {rules.missing}"] },
  ]);
});

test("NaN and a u64 maximum in the export are forbidden values", () => {
  const llm = "file: docs/pages/a.mdx\nmeta: {}\n\nUp to +NaN armies, and 18,446,744,073,709,550 kg.\n";
  assert.equal(forbiddenValues(root, llm).length, 2);
});
