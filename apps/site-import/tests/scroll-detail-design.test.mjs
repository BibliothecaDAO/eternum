import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("Scroll detail: uses themed scriptorium layout", () => {
  const detail = read("src/routes/scroll/$slug.tsx");

  assert.match(detail, /createFileRoute\("\/scroll\/\$slug"\)/);
  assert.match(
    detail,
    /scroll-scriptorium-stage/,
    "Expected themed wrapper stage for individual scroll pages"
  );
  assert.match(
    detail,
    /scroll-detail-hero/,
    "Expected themed hero panel for scroll detail"
  );
  assert.match(
    detail,
    /scroll-detail-body/,
    "Expected dedicated content body wrapper"
  );
  assert.match(
    detail,
    /scroll-detail-neighbors/,
    "Expected neighbor navigation cards section"
  );
  assert.match(
    detail,
    /scroll-detail-similar/,
    "Expected themed similar-posts section"
  );
});
