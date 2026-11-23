import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { balanceReads } from "./check-decoders-read-no-balance.mjs";

const withDecoder = (files, check) => {
  const root = mkdtempSync(join(tmpdir(), "decoder-balance-"));
  try {
    mkdirSync(join(root, "src", "native"), { recursive: true });
    for (const [path, text] of Object.entries(files)) writeFileSync(join(root, "src", path), text);
    check(balanceReads(root, ["src"]));
  } finally {
    rmSync(root, { recursive: true });
  }
};

test("a balance number reached through the game client's re-export is found, aliased or not", () => {
  withDecoder(
    {
      "fold.ts": 'import { nativeRuleConstants } from "@bibliothecadao/eternum/game-client";\n',
      "native/read.ts": 'import { nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";\n',
      "identity.ts": 'import * as client from "@bibliothecadao/eternum/game-client";\nclient.nativeBalanceIdentity;\n',
    },
    (reads) =>
      assert.deepEqual(reads.map(({ path, read }) => `${path} ${read}`).sort(), [
        "src/fold.ts nativeRuleConstants",
        "src/identity.ts nativeBalanceIdentity",
        "src/native/read.ts nativeOathConstants",
      ]),
  );
});

test("the balance module imported by path is found, and the identifiers the schema hashes pass", () => {
  withDecoder(
    {
      "path.ts": 'import { x } from "../../contracts/l3/world-native/schema/balance.gen";\n',
      "ids.ts": 'import { nativeIdentifiers } from "./client.gen";\nnativeIdentifiers.rule.SEASON_CLOSE;\n',
    },
    (reads) => assert.deepEqual(reads, [{ path: "src/path.ts", read: "schema/balance.gen" }]),
  );
});

test("Herald and the value relay read no balance number", () => {
  assert.deepEqual(balanceReads(join(import.meta.dirname, "..")), []);
});
