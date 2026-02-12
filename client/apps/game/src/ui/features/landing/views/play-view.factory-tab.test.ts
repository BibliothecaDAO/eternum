import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("PlayView factory tab integration", () => {
  it("supports factory as a valid home tab and renders a factory case", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");

    expect(source).toContain('type PlayTab = "play" | "learn" | "news" | "factory"');
    expect(source).toContain('case "factory":');
  });
});
