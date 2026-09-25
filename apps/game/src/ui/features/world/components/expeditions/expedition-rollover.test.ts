import { expect, it } from "vitest";

import { describeNewExpedition } from "./expedition-rollover";

it("opens the day's muster only when the realm has troops to muster", () => {
  expect(describeNewExpedition(3_000)).toContain("today's muster is open");
  expect(describeNewExpedition(0)).not.toContain("muster is open");
  expect(describeNewExpedition(0)).toContain("a barracks on the realm board trains them");
});

it("claims no muster while the troops at home are unknown", () => {
  expect(describeNewExpedition(undefined)).not.toContain("muster");
  expect(describeNewExpedition(undefined)).not.toContain("no troops");
});
