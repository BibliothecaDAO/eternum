// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Realm transfer bar presentation", () => {
  it("renders a line-based transfer bar with animated resource icons", () => {
    const source = readSource("src/ui/modules/entity-details/realm/realm-transfer-bars.tsx");

    expect(source).toContain("TransferBar");
    expect(source).toContain("animate-transfer-token");
    expect(source).toContain("sourceLabel");
    expect(source).toContain("destinationLabel");
    expect(source).toContain("iconResources");
  });
});
