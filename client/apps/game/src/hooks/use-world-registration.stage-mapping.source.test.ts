import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("World registration stage mapping source", () => {
  it("uses explicit availability states and confirmation stages", () => {
    const source = readFileSync(resolve(process.cwd(), "src/hooks/use-world-registration.ts"), "utf8");

    expect(source).toContain('type RegistrationAvailabilityState =');
    expect(source).toContain('"submitting-obtain-token"');
    expect(source).toContain('"confirming-entry-token"');
    expect(source).toContain('"submitting-registration"');
    expect(source).toContain('"confirming-registration"');
    expect(source).toContain("mapRegistrationError");
  });
});
