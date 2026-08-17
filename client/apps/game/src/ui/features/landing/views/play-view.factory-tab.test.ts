import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("PlayView factory tab integration", () => {
  it("supports factory as a valid home tab rendering Factory V2 only", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");

    expect(source).toContain('type PlayTab = "play" | "learn" | "news" | "factory"');
    expect(source).toContain('const FACTORY_TAB_BLEED_CLASS_NAME = "-mx-6 lg:-mx-10"');
    expect(source).toContain('case "factory":');
    expect(source).toContain('import("../../factory-v2")');
    // The legacy (v1) factory is excised — no chooser, no admin import.
    expect(source).not.toContain('import("../../admin")');
    expect(source).not.toContain("FactoryVersionChooser");
    expect(source).toContain('activeTab === "factory" && FACTORY_TAB_BLEED_CLASS_NAME');
    expect(source).toContain("<FactoryV2Content />");
  });
});
