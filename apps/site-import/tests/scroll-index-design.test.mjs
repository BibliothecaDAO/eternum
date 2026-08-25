import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("Scroll index: uses a designed codex-stage layout", () => {
  const route = read("src/routes/scroll/index.tsx");

  assert.match(route, /createFileRoute\("\/scroll\/"\)/);
  assert.match(
    route,
    /scroll-codex-stage/,
    "Expected dedicated themed wrapper for Scroll index"
  );
  assert.match(
    route,
    /Signal Archive|Codex Dispatches|Chronicle/i,
    "Expected elevated themed hero copy"
  );
  assert.match(
    route,
    /scroll-codex-metrics/,
    "Expected summary metrics strip in Scroll hero"
  );
  assert.match(
    route,
    /scroll-codex-feature/,
    "Expected featured lead article treatment"
  );
  assert.match(
    route,
    /scroll-codex-feed|scroll-codex-card/,
    "Expected stylized feed layout classes"
  );
  assert.doesNotMatch(
    route,
    /container mx-auto px-4 py-8 md:py-12/,
    "Expected old narrow container layout to be removed"
  );
});
