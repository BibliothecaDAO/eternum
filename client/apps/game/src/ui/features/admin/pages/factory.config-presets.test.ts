import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Factory config presets", () => {
  it("shows sandbox and blitz preset cards with click handlers", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/admin/pages/factory.tsx"), "utf8");

    expect(source).toContain("SANDBOX (dev mode 72hrs)");
    expect(source).toContain("BLITZ SLOT (2 hr game onslot)");
    expect(source).toContain('onClick={() => applyConfigPreset("sandbox")}');
    expect(source).toContain('onClick={() => applyConfigPreset("blitz-slot")}');
  });

  it("applies expected core values for each preset", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/admin/pages/factory.tsx"), "utf8");

    expect(source).toContain('if (preset === "sandbox")');
    expect(source).toContain("setDevModeOn(true)");
    expect(source).toContain("setDurationHours(72)");

    expect(source).toContain('if (preset === "blitz-slot")');
    expect(source).toContain("setDevModeOn(false)");
    expect(source).toContain("setDurationHours(2)");
  });
});
