import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HexceptionScene lifecycle – Stage 1 subscription leaks", () => {
  const source = readFileSync(new URL("./hexception.tsx", import.meta.url), "utf8");

  describe("Bug 1a: Building update subscription management", () => {
    it("has a buildingUpdateUnsubscribe field for tracking the subscription", () => {
      expect(source).toMatch(/private\s+buildingUpdateUnsubscribe/);
    });

    it("calls buildingUpdateUnsubscribe before re-registering in setup()", () => {
      // The unsubscribe call must appear BEFORE the onBuildingUpdate registration
      const unsubscribeCallIndex = source.indexOf("this.buildingUpdateUnsubscribe?.()");
      const registrationIndex = source.indexOf("this.worldUpdateListener.Buildings.onBuildingUpdate(");
      expect(unsubscribeCallIndex).toBeGreaterThan(-1);
      expect(registrationIndex).toBeGreaterThan(-1);
      expect(unsubscribeCallIndex).toBeLessThan(registrationIndex);
    });

    it("stores the unsubscribe handle from onBuildingUpdate", () => {
      // The return value of onBuildingUpdate should be captured
      expect(source).toMatch(
        /this\.buildingUpdateUnsubscribe\s*=\s*this\.worldUpdateListener\.Buildings\.onBuildingUpdate\(/,
      );
    });

    it("calls buildingUpdateUnsubscribe in destroy()", () => {
      // Find destroy() method and check it contains the unsubscribe call
      const destroyIndex = source.indexOf("destroy()");
      expect(destroyIndex).toBeGreaterThan(-1);
      const destroyBody = source.substring(destroyIndex, destroyIndex + 2000);
      expect(destroyBody).toContain("this.buildingUpdateUnsubscribe?.()");
    });
  });

  describe("Bug 1b: HexHoverLabel disposal in destroy()", () => {
    it("calls dispose on hoverLabelManager in destroy()", () => {
      const destroyIndex = source.indexOf("destroy()");
      expect(destroyIndex).toBeGreaterThan(-1);
      const destroyBody = source.substring(destroyIndex, destroyIndex + 2000);
      expect(destroyBody).toMatch(/this\.hoverLabelManager\.dispose\(\)/);
    });
  });
});
