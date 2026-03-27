// @vitest-environment node
import { describe, it, expect } from "vitest";
import { computeGroupFlags, computeDateSeparators } from "./message-grouping";

describe("computeGroupFlags", () => {
  it("returns true for the first message (always starts a group)", () => {
    const msgs = [{ id: "1", senderId: "alice", createdAt: "2024-01-01T10:00:00Z" }];
    expect(computeGroupFlags(msgs)[0]).toBe(true);
  });

  it("groups consecutive messages from same sender within 2-minute window", () => {
    const msgs = [
      { id: "1", senderId: "alice", createdAt: "2024-01-01T10:00:00Z" },
      { id: "2", senderId: "alice", createdAt: "2024-01-01T10:01:00Z" },
      { id: "3", senderId: "alice", createdAt: "2024-01-01T10:01:30Z" },
    ];
    const flags = computeGroupFlags(msgs);
    expect(flags).toEqual([true, false, false]);
  });

  it("starts a new group after 2-minute gap", () => {
    const msgs = [
      { id: "1", senderId: "alice", createdAt: "2024-01-01T10:00:00Z" },
      { id: "2", senderId: "alice", createdAt: "2024-01-01T10:02:01Z" },
    ];
    const flags = computeGroupFlags(msgs);
    expect(flags).toEqual([true, true]);
  });

  it("starts a new group when sender changes", () => {
    const msgs = [
      { id: "1", senderId: "alice", createdAt: "2024-01-01T10:00:00Z" },
      { id: "2", senderId: "bob", createdAt: "2024-01-01T10:00:30Z" },
    ];
    const flags = computeGroupFlags(msgs);
    expect(flags).toEqual([true, true]);
  });

  it("returns empty array for empty input", () => {
    expect(computeGroupFlags([])).toEqual([]);
  });

  it("handles Date objects as createdAt", () => {
    const msgs = [
      { id: "1", senderId: "alice", createdAt: new Date("2024-01-01T10:00:00Z") },
      { id: "2", senderId: "alice", createdAt: new Date("2024-01-01T10:01:00Z") },
    ];
    const flags = computeGroupFlags(msgs);
    expect(flags).toEqual([true, false]);
  });
});

describe("computeDateSeparators", () => {
  it("inserts separator between messages from different calendar days", () => {
    const msgs = [
      { id: "1", createdAt: "2024-01-01T23:59:00Z" },
      { id: "2", createdAt: "2024-01-02T00:01:00Z" },
    ];
    const separators = computeDateSeparators(msgs);
    expect(separators.has(1)).toBe(true);
  });

  it("does not insert separator for same-day messages", () => {
    const msgs = [
      { id: "1", createdAt: "2024-01-01T10:00:00Z" },
      { id: "2", createdAt: "2024-01-01T23:59:00Z" },
    ];
    const separators = computeDateSeparators(msgs);
    expect(separators.size).toBe(0);
  });

  it("does not insert separator at start of list", () => {
    const msgs = [{ id: "1", createdAt: "2024-01-01T10:00:00Z" }];
    const separators = computeDateSeparators(msgs);
    expect(separators.size).toBe(0);
  });

  it("returns empty map for empty input", () => {
    expect(computeDateSeparators([]).size).toBe(0);
  });

  it("labels today as 'Today'", () => {
    const today = new Date();
    const todayStr = today.toISOString();
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const msgs = [
      { id: "1", createdAt: yesterdayDate.toISOString() },
      { id: "2", createdAt: todayStr },
    ];
    const separators = computeDateSeparators(msgs);
    expect(separators.get(1)).toBe("Today");
  });

  it("labels yesterday as 'Yesterday'", () => {
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const msgs = [
      { id: "1", createdAt: twoDaysAgo.toISOString() },
      { id: "2", createdAt: yesterday.toISOString() },
    ];
    const separators = computeDateSeparators(msgs);
    expect(separators.get(1)).toBe("Yesterday");
  });
});
