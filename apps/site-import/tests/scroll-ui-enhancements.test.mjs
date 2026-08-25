import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

test("Scroll: library exposes similar-post selector", () => {
  const scrollLibPath = join(ROOT, "src", "lib", "scroll.ts");
  const content = readFileSync(scrollLibPath, "utf8");

  assert.match(content, /export function getSimilarScrollPosts\(/);
});

test("Scroll detail: includes hero area for article cover", () => {
  const detailPath = join(ROOT, "src", "routes", "scroll", "$slug.tsx");
  const content = readFileSync(detailPath, "utf8");

  assert.match(content, /className="scroll-hero/);
});

test("Scroll detail: renders similar article cards section", () => {
  const detailPath = join(ROOT, "src", "routes", "scroll", "$slug.tsx");
  const content = readFileSync(detailPath, "utf8");

  assert.match(content, /Similar Scrolls/i);
  assert.match(content, /className="similar-scroll-card/);
});

test("Styles: includes classes for hero and similar cards", () => {
  const cssPath = join(ROOT, "src", "index.css");
  const css = readFileSync(cssPath, "utf8");

  assert.match(css, /\.scroll-hero/);
  assert.match(css, /\.similar-scroll-card/);
});
