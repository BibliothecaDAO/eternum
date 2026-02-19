import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("HexGridBackground exposes opt-out for pointer hover glow", () => {
  const component = read("src/components/HexGridBackground.tsx");

  assert.match(
    component,
    /disableHover\?: boolean;/,
    "Expected HexGridBackground to support disabling hover interaction"
  );
});

test("Eternum and Blitz heroes disable hex hover interaction", () => {
  const eternum = read("src/routes/eternum.tsx");
  const blitz = read("src/routes/blitz.tsx");

  assert.match(
    eternum,
    /<HexGridBackground[\s\S]*disableHover=\{true\}/,
    "Expected Eternum hero to disable hex hover interaction"
  );
  assert.match(
    blitz,
    /<HexGridBackground[\s\S]*disableHover=\{true\}/,
    "Expected Blitz hero to disable hex hover interaction"
  );
});
