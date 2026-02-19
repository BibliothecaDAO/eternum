import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("HexGridBackground component is fully removed", () => {
  const componentPath = join(ROOT, "src", "components", "HexGridBackground.tsx");
  assert.equal(
    existsSync(componentPath),
    false,
    "Expected HexGridBackground component file to be removed"
  );
});

test("Eternum and Blitz pages do not import HexGridBackground", () => {
  const eternum = read("src/routes/eternum.tsx");
  const blitz = read("src/routes/blitz.tsx");

  assert.doesNotMatch(
    eternum,
    /import\s+\{\s*HexGridBackground\s*\}\s+from/,
    "Expected Eternum page to not import HexGridBackground"
  );
  assert.doesNotMatch(
    blitz,
    /import\s+\{\s*HexGridBackground\s*\}\s+from/,
    "Expected Blitz page to not import HexGridBackground"
  );
});

test("Eternum and Blitz heroes do not render HexGridBackground", () => {
  const eternum = read("src/routes/eternum.tsx");
  const blitz = read("src/routes/blitz.tsx");

  assert.doesNotMatch(
    eternum,
    /<HexGridBackground/,
    "Expected Eternum hero to not render HexGridBackground"
  );
  assert.doesNotMatch(
    blitz,
    /<HexGridBackground/,
    "Expected Blitz hero to not render HexGridBackground"
  );
});
