// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  TERRAIN_AESTHETIC_CATEGORIES,
  evaluateTerrainAestheticReview,
  evaluateTerrainVerification,
} from "./terrain-verification/evaluate-terrain-verification.mjs";

const REQUIRED_CAPTURES = ["coastline:close:webgpu-auto:beauty", "forest-gradient:medium:webgpu-auto:beauty"];

const buildPassingReview = () => ({
  reviewedCaptureIds: [...REQUIRED_CAPTURES],
  categories: Object.fromEntries(
    TERRAIN_AESTHETIC_CATEGORIES.map((category) => [
      category,
      {
        score: 4,
        evidence: [`${REQUIRED_CAPTURES[0]}: ${category} has capture-specific evidence`],
      },
    ]),
  ),
  findings: [],
});

const buildPassingEvidence = () => ({
  contractVersion: 1,
  suite: "quick",
  verificationPolicyChanged: false,
  requiredCaptureIds: [...REQUIRED_CAPTURES],
  checks: {
    structural: [{ id: "fixture-fingerprint", status: "pass" }],
    performance: [{ id: "prepare-p95", status: "pass" }],
    backendParity: [{ id: "geometry-parity", status: "pass" }],
    images: [{ id: "capture-completeness", status: "pass" }],
  },
  images: { changedCaptures: [] },
  aestheticReview: buildPassingReview(),
});

describe("evaluateTerrainVerification", () => {
  it("passes only when every check group and the complete aesthetic rubric pass", () => {
    expect(evaluateTerrainVerification(buildPassingEvidence())).toMatchObject({
      status: "pass",
      aesthetics: {
        status: "pass",
        meanScore: 4,
        minimumScore: 4,
      },
      checks: {
        structural: { status: "pass" },
        performance: { status: "pass" },
        backendParity: { status: "pass" },
        images: { status: "pass" },
      },
    });
  });

  it("fails on deterministic check failures even when aesthetics pass", () => {
    const evidence = buildPassingEvidence();
    evidence.checks.performance = [{ id: "prepare-p95", status: "fail", reason: "12ms exceeded 8ms" }];

    const verdict = evaluateTerrainVerification(evidence);

    expect(verdict.status).toBe("fail");
    expect(verdict.checks.performance.failures).toEqual(["prepare-p95: 12ms exceeded 8ms"]);
  });

  it("requires review when captures changed but the aesthetic review is missing", () => {
    const evidence = buildPassingEvidence();
    evidence.images.changedCaptures = [REQUIRED_CAPTURES[0]];
    evidence.aestheticReview = undefined;

    const verdict = evaluateTerrainVerification(evidence);

    expect(verdict.status).toBe("review_required");
    expect(verdict.reviewReasons).toContain("aesthetic review is missing");
    expect(verdict.reviewReasons).toContain("1 changed capture(s) require a complete aesthetic review");
  });

  it("reports inconclusive when a required measurement group is absent", () => {
    const evidence = buildPassingEvidence();
    evidence.checks.performance = [];

    const verdict = evaluateTerrainVerification(evidence);

    expect(verdict.status).toBe("inconclusive");
    expect(verdict.checks.performance.inconclusiveReasons).toEqual(["performance emitted no checks"]);
  });

  it("requires explicit review when verification policy changes", () => {
    const evidence = buildPassingEvidence();
    evidence.verificationPolicyChanged = true;

    const verdict = evaluateTerrainVerification(evidence);

    expect(verdict.status).toBe("review_required");
    expect(verdict.reviewReasons).toEqual(["verification policy changed and requires explicit review"]);
  });
});

describe("evaluateTerrainAestheticReview", () => {
  it("fails low mean, low critical categories, and blocking findings with specific reasons", () => {
    const review = buildPassingReview();
    review.categories.continuity.score = 2;
    review.categories.biomeLegibility.score = 3;
    review.findings.push({ id: "AESTHETIC-001", severity: "blocking" });

    const result = evaluateTerrainAestheticReview({
      requiredCaptureIds: REQUIRED_CAPTURES,
      review,
    });

    expect(result.status).toBe("fail");
    expect(result.failures).toContain("AESTHETIC-001: blocking aesthetic finding remains");
    expect(result.failures).toContain("minimum aesthetic score was 2, expected at least 3");
    expect(result.failures).toContain("mean aesthetic score was 3.63, expected at least 4");
    expect(result.failures).toContain("continuity score was 2, expected at least 4");
  });

  it("does not accept category scores without capture-specific evidence", () => {
    const review = buildPassingReview();
    review.categories.coastAndWater.evidence = [];

    const result = evaluateTerrainAestheticReview({
      requiredCaptureIds: REQUIRED_CAPTURES,
      review,
    });

    expect(result.status).toBe("review_required");
    expect(result.reviewReasons).toContain("coastAndWater has no capture-specific evidence");
  });

  it("requires evidence to name a capture the reviewer actually viewed", () => {
    const review = buildPassingReview();
    review.categories.macroComposition.evidence = ["unreviewed:far:webgpu-auto:beauty: composition is balanced"];

    const result = evaluateTerrainAestheticReview({
      requiredCaptureIds: REQUIRED_CAPTURES,
      review,
    });

    expect(result.status).toBe("review_required");
    expect(result.reviewReasons).toContain("macroComposition evidence does not name a reviewed capture");
  });
});
