import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Factory Set button state", () => {
  it("does not hard-disable Set based only on worldDeployedStatus cache", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/admin/pages/factory.tsx"), "utf8");

    expect(source).not.toContain("!worldDeployedStatus[name] ||");
    expect(source).toContain("World is not deployed yet. Deploy first.");
  });
});
