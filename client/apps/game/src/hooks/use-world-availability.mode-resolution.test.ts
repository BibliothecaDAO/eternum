import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("World availability mode resolution", () => {
  it("uses shared mode and boolean parsing helpers", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/use-world-availability.ts"), "utf8");

    expect(source).toContain("resolveGameModeFromBlitzFlag");
    expect(source).toContain("parseMaybeBooleanFlag");
    expect(source).toContain("meta.mode = resolveGameModeFromBlitzFlag(modeRow?.blitz_mode_on);");
  });
});
