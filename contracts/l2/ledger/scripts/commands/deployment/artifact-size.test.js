import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getContractArtifactPaths, readContractArtifacts } from "../../../../../scripts-runtime/js/artifacts.js";

test("the built ledger satisfies the declaration limit, which local contract tests do not enforce", () => {
  const target = fileURLToPath(new URL("../../../target/dev/", import.meta.url));
  const paths = getContractArtifactPaths(target, "game_ledger", "GameLedger");
  assert.doesNotThrow(() => readContractArtifacts(paths));
});
