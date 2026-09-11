// @vitest-environment node
import { describe, it, expect } from "vitest";
import { computeDateSeparators } from "./message-grouping";

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
