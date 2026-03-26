import { describe, expect, it } from "vitest";
import { extractAgentMentions } from "./mention-detector";

describe("extractAgentMentions", () => {
  it("extracts a single UUID from @agent:uuid", () => {
    const result = extractAgentMentions("Hey @agent:a1b2c3d4-e5f6-7890-abcd-ef1234567890 check this out");
    expect(result).toEqual(["a1b2c3d4-e5f6-7890-abcd-ef1234567890"]);
  });

  it("extracts multiple UUIDs", () => {
    const result = extractAgentMentions(
      "@agent:a1b2c3d4-e5f6-7890-abcd-ef1234567890 and @agent:11111111-2222-3333-4444-555555555555",
    );
    expect(result).toHaveLength(2);
  });

  it("deduplicates same agent mentioned twice", () => {
    const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const result = extractAgentMentions(`@agent:${id} hey @agent:${id}`);
    expect(result).toEqual([id]);
  });

  it("returns empty array for no mentions", () => {
    expect(extractAgentMentions("no mentions here")).toEqual([]);
  });

  it("ignores partial/malformed UUIDs", () => {
    expect(extractAgentMentions("@agent:not-a-uuid")).toEqual([]);
    expect(extractAgentMentions("@agent:1234")).toEqual([]);
  });

  it("is case insensitive", () => {
    const result = extractAgentMentions("@Agent:A1B2C3D4-E5F6-7890-ABCD-EF1234567890");
    expect(result).toEqual(["a1b2c3d4-e5f6-7890-abcd-ef1234567890"]);
  });
});
