import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Factory config defaults in form inputs", () => {
  it("uses current config defaults instead of empty values for override inputs", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/admin/pages/factory.tsx"), "utf8");

    expect(source).not.toContain('value={factoryAddressOverrides[name] || ""}');
    expect(source).not.toContain('value={blitzFeeAmountOverrides[name] || ""}');
    expect(source).not.toContain('value={blitzFeePrecisionOverrides[name] || ""}');
    expect(source).not.toContain('value={blitzFeeTokenOverrides[name] || ""}');
    expect(source).not.toContain('value={registrationCountMaxOverrides[name] || ""}');
  });
});
