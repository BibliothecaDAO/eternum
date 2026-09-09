import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("uses one label token for every header pill including player names", () => {
  const directory = "src/ui/features/world/containers/top-header/";
  for (const file of [
    "top-header.tsx",
    "identity-chip.tsx",
    "game-clock.tsx",
    "attention-pill.tsx",
    "game-finished-pill.tsx",
  ]) {
    const source = readFileSync(directory + file, "utf8");
    expect(source).toContain("HUD_LABEL_BRIGHT");
    expect(source).not.toContain("TOP_PILL_TEXT");
  }
  const identity = readFileSync(directory + "identity-chip.tsx", "utf8");
  expect(identity).not.toContain("truncate normal-case tracking-normal");
  expect(readFileSync(directory + "top-pill.ts", "utf8")).not.toContain("TOP_PILL_TEXT");
});
