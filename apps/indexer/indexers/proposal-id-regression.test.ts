import { describe, expect, it } from "vitest";

import {
  formatSnapshotProposalReference,
  isMatchingProposalVote,
  normalizeProposalId,
} from "../../web/src/lib/snapshot/proposal-id";

describe("normalizeProposalId", () => {
  it("parses plain numeric ids", () => {
    expect(normalizeProposalId("123")).toBe(123);
    expect(normalizeProposalId(456)).toBe(456);
  });

  it("parses snapshot proposal references", () => {
    expect(normalizeProposalId("sn:space/987")).toBe(987);
    expect(normalizeProposalId("  sn:space/42  ")).toBe(42);
  });

  it("returns null for invalid ids", () => {
    expect(normalizeProposalId("")).toBeNull();
    expect(normalizeProposalId("sn:space/not-a-number")).toBeNull();
    expect(normalizeProposalId(undefined)).toBeNull();
  });
});

describe("isMatchingProposalVote", () => {
  it("matches proposal ids across numeric and reference formats", () => {
    expect(isMatchingProposalVote(77, "77")).toBe(true);
    expect(isMatchingProposalVote(77, "sn:space/77")).toBe(true);
    expect(isMatchingProposalVote("sn:space/88", 88)).toBe(true);
  });

  it("does not match when ids differ or are invalid", () => {
    expect(isMatchingProposalVote(77, "78")).toBe(false);
    expect(isMatchingProposalVote("sn:space/not-a-number", "78")).toBe(false);
  });
});

describe("formatSnapshotProposalReference", () => {
  it("formats a route id into snapshot proposal reference", () => {
    expect(formatSnapshotProposalReference("sn:space", "123")).toBe("sn:space/123");
  });

  it("normalizes full references and plain ids", () => {
    expect(formatSnapshotProposalReference("sn:space", "sn:space/123")).toBe("sn:space/123");
    expect(formatSnapshotProposalReference("sn:space", "  00123 ")).toBe("sn:space/123");
  });
});
