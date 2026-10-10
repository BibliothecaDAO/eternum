import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readContractArtifacts } from "./artifacts.js";

function artifacts(sierraSize, casmSize) {
  const directory = mkdtempSync(join(tmpdir(), "contract-artifact-size-"));
  const paths = { sierraPath: join(directory, "sierra.json"), compiledPath: join(directory, "casm.json") };
  writeFileSync(paths.sierraPath, JSON.stringify({ sierra_program: Array(sierraSize).fill("0x0"), abi: [] }));
  writeFileSync(paths.compiledPath, JSON.stringify({ bytecode: Array(casmSize).fill("0x0") }));
  return { paths, close: () => rmSync(directory, { recursive: true }) };
}

test("the declaration artifact reader accepts the chain boundary and refuses either oversized program", () => {
  for (const [sierra, casm] of [
    [1, 81920],
    [81920, 1],
    [1, 81921],
    [81921, 1],
  ]) {
    const fixture = artifacts(sierra, casm);
    try {
      if (Math.max(sierra, casm) > 81920)
        assert.throws(() => readContractArtifacts(fixture.paths), /class exceeds Starknet felt limit/);
      else assert.equal(readContractArtifacts(fixture.paths).casm.bytecode.length, casm);
    } finally {
      fixture.close();
    }
  }
});

test("missing or empty compiled programs refuse before declaration", () => {
  const fixture = artifacts(1, 1);
  try {
    for (const bad of [{}, { bytecode: [] }]) {
      writeFileSync(fixture.paths.compiledPath, JSON.stringify(bad));
      assert.throws(() => readContractArtifacts(fixture.paths), /Missing CASM program/);
    }
  } finally {
    fixture.close();
  }
});
