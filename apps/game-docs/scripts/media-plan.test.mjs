/**
 * The capture list (media.json) and the pages name the same media: every file a page embeds has an entry that captures
 * it, and every entry is embedded by a page. A rename on one side alone fails here.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import fg from "fast-glob";

const app = fileURLToPath(new URL("..", import.meta.url));
const docs = join(app, "docs/pages");
const plan = JSON.parse(readFileSync(join(app, "media.json"), "utf8")).map(({ name }) => name);
const embedded = fg
  .sync("**/*.mdx", { cwd: docs })
  .flatMap((page) => [...readFileSync(join(docs, page), "utf8").matchAll(/<(?:Video|Shot)\b[^>]*\bname="([^"]+)"/gs)])
  .map(([, name]) => name);

test("every embedded video and screenshot is captured by an entry of the plan", () => {
  assert.deepEqual(
    embedded.filter((name) => !plan.includes(name)),
    [],
  );
});

test("every entry of the plan is embedded by a page, once", () => {
  assert.deepEqual(
    plan.filter((name) => !embedded.includes(name)),
    [],
  );
  assert.deepEqual(plan, [...new Set(plan)]);
});
