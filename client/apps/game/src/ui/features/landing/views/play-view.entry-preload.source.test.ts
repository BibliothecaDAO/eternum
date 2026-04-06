// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("PlayView entry preloading", () => {
  it("preloads only the game route chunk as soon as the game entry modal opens", () => {
    const source = readSource("src/ui/features/landing/views/play-view.tsx");

    expect(source).toContain("primePlayEntryRoute");
    expect(source).toContain('openGameEntryModal(selection, "play")');
    expect(source).toContain("primePlayEntryRoute();");
    expect(source).not.toContain("primePlayEntryResources();");
  });
});
