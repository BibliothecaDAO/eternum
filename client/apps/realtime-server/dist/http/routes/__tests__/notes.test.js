import { describe, expect, it } from "vitest";
import { noteCreateSchema } from "@bibliothecadao/types";
import { formatZodError } from "../../utils/zod";
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
//# sourceMappingURL=notes.test.js.map