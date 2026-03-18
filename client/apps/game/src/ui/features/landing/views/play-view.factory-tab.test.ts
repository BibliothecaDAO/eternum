import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("PlayView factory tab integration", () => {
  it("supports factory as a valid home tab and lets the user choose between v1 and v2", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");
    const suspenseIndex = source.indexOf("<Suspense");
    const chooserCopyIndex = source.indexOf("Choose the legacy factory or the new Factory V2.");

    expect(source).toContain('type PlayTab = "play" | "learn" | "news" | "factory"');
    expect(source).toContain('const FACTORY_TAB_BLEED_CLASS_NAME = "-mx-6 lg:-mx-10"');
    expect(source).toContain('case "factory":');
    expect(source).toContain('import("../../factory-v2")');
    expect(source).toContain('import("../../admin")');
    expect(source).toContain('type FactoryVersion = "v2" | "v1"');
    expect(source).toContain('activeTab === "factory" && FACTORY_TAB_BLEED_CLASS_NAME');
    expect(source).toContain("FactoryVersionChooser");
    expect(source).toContain("Factory versions");
    expect(source).toContain('{selectedFactoryVersion === "v2" ? <FactoryV2Content /> : <FactoryPage embedded />}');
    expect(suspenseIndex).toBeGreaterThan(-1);
    expect(chooserCopyIndex).toBeGreaterThan(suspenseIndex);
  });
});
