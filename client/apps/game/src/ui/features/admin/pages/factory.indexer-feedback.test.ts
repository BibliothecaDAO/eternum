import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Factory indexer feedback", () => {
  it("tracks create-indexer progress in local state and renders a loading label", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/admin/pages/factory.tsx"), "utf8");

    expect(source).toContain("const [creatingIndexer, setCreatingIndexer]");
    expect(source).toContain("Creating Indexer...");
    expect(source).toContain("setCreatingIndexer((prev) => ({ ...prev, [worldName]: true }))");
  });
});
