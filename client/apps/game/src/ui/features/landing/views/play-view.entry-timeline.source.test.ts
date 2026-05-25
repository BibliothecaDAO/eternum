// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("PlayView entry timeline", () => {
  it("starts a fresh game entry timeline before opening the entry modal", () => {
    const source = readSource("src/ui/features/landing/views/play-view.tsx");

    expect(source).toContain("startGameEntryTimeline");
    expect(source).toContain("startGameEntryTimeline();");
  });
});
