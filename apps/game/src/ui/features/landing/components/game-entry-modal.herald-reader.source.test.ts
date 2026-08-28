// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("GameEntryModal Herald pre-session reads", () => {
  it("uses the selected world's Herald snapshot reader with no gameplay SQL client", () => {
    const source = readSource("src/ui/features/landing/components/game-entry-modal.tsx");

    expect(source).toContain("createHeraldPreSessionReader");
    expect(source).toContain("selectedWorldReader");
    expect(source).toContain("selectedWorldReader.fetchPlayerStructures(account.address)");
    expect(source).not.toContain("createSqlApi");
    expect(source).not.toContain("/sql");
  });
});
