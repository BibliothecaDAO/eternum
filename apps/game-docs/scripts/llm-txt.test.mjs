import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { after, before, test } from "node:test";

/** The export generator and the post-build check, as the build runs them. */
const { renderLlmTxt } = await import(new URL("../vite-plugin-llm-txt.mjs", import.meta.url).href);
const { exportProblems, forbiddenValues, frontierGuardPhrases } = await import(
  new URL("./check-rendered-balance.mjs", import.meta.url).href
);

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

test("the expedition page gives camps and rifts their own correct guard column at every depth", async () => {
  const server = await createServer({ configFile: false, logLevel: "silent", appType: "custom" });
  try {
    const { frontierPreset } = await server.ssrLoadModule(
      fileURLToPath(new URL("../../../config/source/frontier/native.ts", import.meta.url)),
    );
    const { previewRiftGuardBound } = await server.ssrLoadModule(
      fileURLToPath(new URL("../../../contracts/l3/world-native/schema/site-previews.gen.ts", import.meta.url)),
    );
    const pages = [
      { page: "frontier/expedition", phrases: frontierGuardPhrases(frontierPreset, previewRiftGuardBound) },
    ];
    const docs = fileURLToPath(new URL("../docs", import.meta.url));
    const llm = await renderLlmTxt([join(docs, "pages/frontier/expedition.mdx")], docs);
    assert.deepEqual(exportProblems(llm, pages), []);
    const combined = llm
      .split("\n")
      .map((line) => {
        if (!line.startsWith("|")) return line;
        const cells = line.split("|").map((cell) => cell.trim());
        if (cells.length !== 8) return line;
        if (cells[2] === "Camps") cells[2] = "Camps and rifts";
        cells.splice(3, 1);
        return cells.join(" | ");
      })
      .join("\n");
    assert.equal(exportProblems(combined, pages).length, 5);
  } finally {
    await server.close();
  }
});
