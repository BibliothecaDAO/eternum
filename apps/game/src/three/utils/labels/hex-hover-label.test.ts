import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HexHoverLabel", () => {
  const source = readFileSync(new URL("./hex-hover-label.ts", import.meta.url), "utf8");

  describe("dispose() method", () => {
    it("has a dispose() method defined", () => {
      expect(source).toMatch(/dispose\s*\(\s*\)\s*[:{]/);
    });

    it("dispose() calls clear() internally", () => {
      // Find the dispose method body and check it calls clear
      const disposeIndex = source.indexOf("dispose()");
      expect(disposeIndex).toBeGreaterThan(-1);
      const disposeBody = source.substring(disposeIndex, disposeIndex + 200);
      expect(disposeBody).toContain("this.clear()");
    });
  });

  describe("clear() safety", () => {
    it("clear() guards against null label with early return", () => {
      expect(source).toMatch(/clear\(\)[\s\S]*?if\s*\(!this\.label\)/);
    });
  });
});
