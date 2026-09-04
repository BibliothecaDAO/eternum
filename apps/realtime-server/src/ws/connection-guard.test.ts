import { describe, expect, it } from "vitest";

import { createConnectionGuard, frameByteLength } from "./connection-guard";

describe("connection guard", () => {
  it("throttles a one-socket flood and enforces connection caps", () => {
    const guard = createConnectionGuard({ globalCap: 2, perPlayerCap: 1, messagesPerSecond: 1, messageBurst: 2 });
    const socket = {};

    expect(guard.canConnect("alice")).toBe(true);
    guard.connected("alice");
    expect(guard.canConnect("alice")).toBe(false);
    expect(guard.consume(socket, 1_000)).toBe(true);
    expect(guard.consume(socket, 1_000)).toBe(true);
    expect(guard.consume(socket, 1_000)).toBe(false);
    expect(guard.consume(socket, 2_000)).toBe(true);
  });

  it("measures utf-8 frames for the message-size cap", () => {
    expect(frameByteLength("four")).toBe(4);
    expect(frameByteLength("⚔")).toBe(3);
    expect(frameByteLength(new Uint8Array(9))).toBe(9);
  });
});
