// @vitest-environment node
import { formatDate } from "@bibliothecadao/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeDateSeparators } from "./message-grouping";

const at = (createdAt: string) => ({ id: createdAt, createdAt });
/** How an older day reads: the words module's date of that UTC day. */
const dayLine = (iso: string) => formatDate(Date.parse(`${iso}T12:00:00Z`) / 1000);

describe("computeDateSeparators", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("puts a day line above the oldest message and above each later day's first", () => {
    const separators = computeDateSeparators([
      at("2026-09-27T23:24:00Z"),
      at("2026-09-28T02:12:00Z"),
      at("2026-09-28T09:30:00Z"),
      at("2026-10-12T22:02:00Z"),
    ]);
    expect([...separators]).toEqual([
      [0, dayLine("2026-09-27")],
      [1, dayLine("2026-09-28")],
      [3, dayLine("2026-10-12")],
    ]);
  });

  it("puts one line above a single day's messages, at the start", () => {
    const separators = computeDateSeparators([at("2026-10-01T10:00:00Z"), at("2026-10-01T23:59:00Z")]);
    expect([...separators]).toEqual([[0, dayLine("2026-10-01")]]);
  });

  it("splits days at UTC midnight", () => {
    const separators = computeDateSeparators([at("2026-10-01T23:59:00Z"), at("2026-10-02T00:01:00Z")]);
    expect([...separators.keys()]).toEqual([0, 1]);
  });

  it("names yesterday and today", () => {
    const separators = computeDateSeparators([at("2026-10-17T08:00:00Z"), at("2026-10-18T08:00:00Z")]);
    expect([...separators]).toEqual([
      [0, "Yesterday"],
      [1, "Today"],
    ]);
  });

  it("has no line for no messages", () => {
    expect(computeDateSeparators([]).size).toBe(0);
  });
});
