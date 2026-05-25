// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("RealmInfoPanel transfer bars wiring", () => {
  it("shows current and automation transfer bars in the sidebar overview", () => {
    const source = readSource("src/ui/modules/entity-details/realm/realm-info-panel.tsx");

    expect(source).toContain("RealmTransferBars");
    expect(source).toContain("buildRealmTransferBarModels");
    expect(source).toContain("transferBarModels.current");
    expect(source).toContain("transferBarModels.automation");
    expect(source).toContain("useTransferAutomationStore((state) => state.entries)");
    expect(source).not.toContain("useTransferAutomationStore((state) => Object.values(state.entries))");
  });
});
