import { describe, expect, it } from "vitest";
import { Effect, Result } from "effect";

import { directMessageCreateSchema } from "@bibliothecadao/types";
import {
  buildThreadId,
  DirectMessageError,
  isBlockedPair,
  isThreadRecipient,
  persistDirectMessage,
  sortParticipants,
} from "../../../services/direct-messages";

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

describe("direct message block policy", () => {
  it("blocks delivery in both directions", () => {
    const blocks = [{ blockerId: "player-a", blockedId: "player-b" }];
    expect(isBlockedPair(blocks, "player-a", "player-b")).toBe(true);
    expect(isBlockedPair(blocks, "player-b", "player-a")).toBe(true);
    expect(isBlockedPair(blocks, "player-a", "player-c")).toBe(false);
  });

  it("cannot substitute a third player into an existing thread", () => {
    expect(isThreadRecipient(["player-a", "player-b"], ["player-a"], "player-b")).toBe(true);
    expect(isThreadRecipient(["player-a", "player-b"], ["player-a"], "player-c")).toBe(false);
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

  it("returns a typed failure for a self-message before storage", async () => {
    const result = await Effect.runPromise(
      Effect.result(
        persistDirectMessage(
          { playerId: "player-a", membershipPlayerId: null, aliases: ["player-a"] },
          { recipientId: "player-a", content: "hello" },
        ),
      ),
    );

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) expect(result.failure).toBeInstanceOf(DirectMessageError);
  });
});
