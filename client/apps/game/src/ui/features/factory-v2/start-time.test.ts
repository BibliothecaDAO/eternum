import { describe, expect, it } from "vitest";
import { buildFactoryStartAtValue, resolveFactoryStartDatePart, resolveFactoryStartTimePart } from "./start-time";

describe("factory start time helpers", () => {
  it("splits the stored startAt value into date and time parts", () => {
    expect(resolveFactoryStartDatePart("2026-03-18T12:00")).toBe("2026-03-18");
    expect(resolveFactoryStartTimePart("2026-03-18T12:00")).toBe("12:00");
  });

  it("rebuilds the startAt value while preserving the untouched part", () => {
    expect(buildFactoryStartAtValue("2026-03-19", "12:00", "2026-03-18T12:00")).toBe("2026-03-19T12:00");
    expect(buildFactoryStartAtValue("2026-03-19", "14:30", "2026-03-19T12:00")).toBe("2026-03-19T14:30");
  });

  it("falls back to the current startAt value when either part is missing", () => {
    expect(buildFactoryStartAtValue("", "12:00", "2026-03-18T12:00")).toBe("2026-03-18T12:00");
    expect(buildFactoryStartAtValue("2026-03-18", "", "2026-03-18T12:00")).toBe("2026-03-18T12:00");
  });
});
