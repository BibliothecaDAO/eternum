import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

describe("StoreManagers transfer route overlay source", () => {
  it("uses the active transfers hook instead of the generic story events feed", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(currentDir, "./store-managers.tsx"), "utf8");

    expect(source).toContain('import { useActiveTransfers } from "@/hooks/use-active-transfers";');
    expect(source).toContain('import { buildMockActiveTransfers } from "@/lib/transfer-route-overlay-mock";');
    expect(source).toContain('import { isMockTransferRoutesEnabled } from "@/ui/debug/mock-transfer-routes-overlay";');
    expect(source).toContain("const { data: activeTransfers = [] } = useActiveTransfers(");
    expect(source).toContain("const liveTransfers = isMockTransferRoutesEnabled()");
    expect(source).not.toContain("const { data: storyEvents = [] } = useStoryEvents(350);");
  });
});
