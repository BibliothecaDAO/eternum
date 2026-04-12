// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("FactoryV2 legacy route wiring", () => {
  it("keeps the legacy factory CTA pointed at a standalone legacy route", () => {
    const appSource = readSource("src/app.tsx");
    const factoryV2Source = readSource("src/ui/features/factory-v2/pages/factory-v2.tsx");

    expect(appSource).toContain('path="/factory/legacy"');
    expect(factoryV2Source).toContain('onOpenLegacy={() => navigate("/factory/legacy")}');
  });
});
