import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

test("Navigation: header includes a Scroll link to /scroll", () => {
  const topBarPath = join(ROOT, "src", "components", "layout", "TopBar.tsx");
  const topBar = readFileSync(topBarPath, "utf8");

  assert.match(topBar, />\s*Scroll\s*</);
  assert.match(topBar, /to="\/scroll"|href="\/scroll"/);
});

test("Navigation: footer includes a Scroll link to /scroll", () => {
  const footerPath = join(
    ROOT,
    "src",
    "components",
    "sections",
    "FooterSection.tsx"
  );
  const footer = readFileSync(footerPath, "utf8");

  assert.match(footer, />\s*Scroll\s*</);
  assert.match(footer, /to="\/scroll"|href="\/scroll"/);
});
