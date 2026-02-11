import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Factory page callback ordering", () => {
  it("declares checkAllWorldStatuses before first invocation", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/admin/pages/factory.tsx"), "utf8");

    const declarationIndex = source.indexOf("const checkAllWorldStatuses = useCallback");
    const invocationIndex = source.indexOf("checkAllWorldStatuses();");

    expect(declarationIndex).toBeGreaterThan(-1);
    expect(invocationIndex).toBeGreaterThan(-1);
    expect(declarationIndex).toBeLessThan(invocationIndex);
  });
});
