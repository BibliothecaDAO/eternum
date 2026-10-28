import { expect, it } from "vitest";

import { replyMetadata, replyOf } from "./reply";

it("quotes the answered message's first 80 characters, and reads the same reply back", () => {
  const answered = { id: "m1", playerId: "0xa1", content: "x".repeat(100) };
  const metadata = replyMetadata(answered);
  expect(replyOf(metadata)).toEqual({ id: "m1", playerId: "0xa1", excerpt: "x".repeat(80) });
});

it("reads no reply from a message that answers nothing, or whose metadata is something else", () => {
  expect(replyOf(undefined)).toBeNull();
  expect(replyOf({})).toBeNull();
  expect(replyOf({ replyTo: "m1" })).toBeNull();
  expect(replyOf({ replyTo: { id: "m1", playerId: 7, excerpt: "hi" } })).toBeNull();
});
