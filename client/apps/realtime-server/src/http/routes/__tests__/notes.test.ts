import { describe, expect, it } from "vitest";

import { formatZodError } from "../../utils/zod";
import { noteCreateSchema } from "../../../../../../../common/validation/realtime/notes";

describe("note validation", () => {
  it("rejects invalid payloads", () => {
    const result = noteCreateSchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatZodError(result.error);
      expect(formatted.errors.length).toBeGreaterThan(0);
    }
  });

  it("accepts valid payloads", () => {
    const result = noteCreateSchema.safeParse({
      zoneId: "zone-1",
      title: "Test Note",
      content: "Hello world",
      location: { x: 1, y: 2 },
    });

    expect(result.success).toBe(true);
  });
});
