import { describe, expect, it } from "vitest";

import { directMessageCreateSchema } from "@bibliothecadao/types";
import { buildThreadId, sortParticipants } from "../direct-messages";

describe("direct message helpers", () => {
  it("builds deterministic thread ids", () => {
    expect(buildThreadId("player-a", "player-b")).toBe("player-a|player-b");
    expect(buildThreadId("player-b", "player-a")).toBe("player-a|player-b");
  });

  it("sorts participants lexicographically", () => {
    expect(sortParticipants("c", "a")).toEqual(["a", "c"]);
    expect(sortParticipants("1", "9")).toEqual(["1", "9"]);
  });
});

describe("direct message validation", () => {
  it("requires content in direct message creation", () => {
    const result = directMessageCreateSchema.safeParse({
      recipientId: "player-b",
      content: "",
    });

    expect(result.success).toBe(false);
  });
});
