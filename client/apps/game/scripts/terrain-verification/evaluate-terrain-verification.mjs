import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const TERRAIN_VERIFICATION_CONTRACT_VERSION = 1;

export const TERRAIN_AESTHETIC_CATEGORIES = Object.freeze([
  "continuity",
  "biomeLegibility",
  "macroComposition",
  "propDistribution",
  "coastAndWater",
  "gameplayReadability",
  "materialAndLighting",
  "fogIntegrity",
]);

const CRITICAL_AESTHETIC_CATEGORIES = new Set(["continuity", "gameplayReadability", "fogIntegrity"]);
const REQUIRED_CHECK_GROUPS = Object.freeze(["structural", "performance", "backendParity", "images"]);
const CHECK_STATUSES = new Set(["pass", "fail", "inconclusive"]);
const FINDING_SEVERITIES = new Set(["blocking", "medium", "polish"]);

export function evaluateTerrainVerification(evidence) {
  const contract = evaluateEvidenceContract(evidence);
  const checks = evaluateCheckGroups(evidence?.checks);
  const aesthetics = evaluateTerrainAestheticReview({
    requiredCaptureIds: evidence?.requiredCaptureIds,
    review: evidence?.aestheticReview,
  });
  const reviewReasons = collectReviewReasons(evidence, aesthetics);
  const status = resolveVerificationStatus({ aesthetics, checks, contract, reviewReasons });

  return {
    contractVersion: TERRAIN_VERIFICATION_CONTRACT_VERSION,
    status,
    suite: typeof evidence?.suite === "string" ? evidence.suite : null,
    verificationPolicyChanged: evidence?.verificationPolicyChanged === true,
    contract,
    checks,
    aesthetics,
    reviewReasons,
  };
}

export function evaluateTerrainAestheticReview({ requiredCaptureIds, review }) {
  const requiredCaptures = normalizeUniqueStrings(requiredCaptureIds);
  if (!review) {
    return {
      status: "review_required",
      meanScore: null,
      minimumScore: null,
      failures: [],
      reviewReasons: ["aesthetic review is missing"],
    };
  }

  const invalidReasons = [];
  const reviewReasons = [];
  const failures = [];
  const reviewedCaptures = new Set(normalizeUniqueStrings(review.reviewedCaptureIds));

  for (const captureId of requiredCaptures) {
    if (!reviewedCaptures.has(captureId)) {
      reviewReasons.push(`required capture was not reviewed: ${captureId}`);
    }
  }

  const scores = [];
  for (const category of TERRAIN_AESTHETIC_CATEGORIES) {
    const categoryReview = review.categories?.[category];
    if (!categoryReview) {
      reviewReasons.push(`aesthetic category is missing: ${category}`);
      continue;
    }

    const score = categoryReview.score;
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      invalidReasons.push(`${category} score must be an integer from 1 to 5`);
      continue;
    }

    const evidenceEntries = normalizeUniqueStrings(categoryReview.evidence);
    if (evidenceEntries.length === 0) {
      reviewReasons.push(`${category} has no capture-specific evidence`);
    } else if (!evidenceEntries.some((entry) => containsReviewedCaptureId(entry, reviewedCaptures))) {
      reviewReasons.push(`${category} evidence does not name a reviewed capture`);
    }

    scores.push({ category, score });
  }

  const findings = Array.isArray(review.findings) ? review.findings : [];
  for (const [index, finding] of findings.entries()) {
    if (!FINDING_SEVERITIES.has(finding?.severity)) {
      invalidReasons.push(`aesthetic finding ${index + 1} has an invalid severity`);
      continue;
    }

    if (finding.severity === "blocking") {
      failures.push(
        finding.id ? `${finding.id}: blocking aesthetic finding remains` : "blocking aesthetic finding remains",
      );
    }
  }

  if (invalidReasons.length > 0) {
    return {
      status: "inconclusive",
      meanScore: null,
      minimumScore: null,
      failures: [],
      reviewReasons: invalidReasons,
    };
  }

  const meanScore = summarizeMeanScore(scores);
  const minimumScore = summarizeMinimumScore(scores);
  if (minimumScore < 3) {
    failures.push(`minimum aesthetic score was ${minimumScore}, expected at least 3`);
  }
  if (meanScore < 4) {
    failures.push(`mean aesthetic score was ${meanScore}, expected at least 4`);
  }

  for (const { category, score } of scores) {
    if (CRITICAL_AESTHETIC_CATEGORIES.has(category) && score < 4) {
      failures.push(`${category} score was ${score}, expected at least 4`);
    }
  }

  if (failures.length > 0) {
    return {
      status: "fail",
      meanScore,
      minimumScore,
      failures,
      reviewReasons,
    };
  }

  if (reviewReasons.length > 0) {
    return {
      status: "review_required",
      meanScore,
      minimumScore,
      failures: [],
      reviewReasons,
    };
  }

  return {
    status: "pass",
    meanScore,
    minimumScore,
    failures,
    reviewReasons: [],
  };
}

function evaluateEvidenceContract(evidence) {
  const inconclusiveReasons = [];

  if (!evidence || typeof evidence !== "object") {
    inconclusiveReasons.push("verification evidence is missing");
  }
  if (evidence?.contractVersion !== TERRAIN_VERIFICATION_CONTRACT_VERSION) {
    inconclusiveReasons.push(
      `contract version was ${String(evidence?.contractVersion)}, expected ${TERRAIN_VERIFICATION_CONTRACT_VERSION}`,
    );
  }
  if (typeof evidence?.suite !== "string" || evidence.suite.length === 0) {
    inconclusiveReasons.push("verification suite is missing");
  }
  if (normalizeUniqueStrings(evidence?.requiredCaptureIds).length === 0) {
    inconclusiveReasons.push("required capture manifest is empty");
  }

  return {
    status: inconclusiveReasons.length > 0 ? "inconclusive" : "pass",
    failures: [],
    inconclusiveReasons,
  };
}

function evaluateCheckGroups(checkGroups) {
  return Object.fromEntries(
    REQUIRED_CHECK_GROUPS.map((group) => [group, evaluateCheckGroup(group, checkGroups?.[group])]),
  );
}

function evaluateCheckGroup(group, checks) {
  if (!Array.isArray(checks) || checks.length === 0) {
    return {
      status: "inconclusive",
      failures: [],
      inconclusiveReasons: [`${group} emitted no checks`],
    };
  }

  const failures = [];
  const inconclusiveReasons = [];

  for (const [index, check] of checks.entries()) {
    const checkId = typeof check?.id === "string" && check.id.length > 0 ? check.id : `${group}[${index}]`;
    if (!CHECK_STATUSES.has(check?.status)) {
      inconclusiveReasons.push(`${checkId}: invalid or missing status`);
      continue;
    }

    if (check.status === "fail") {
      failures.push(`${checkId}: ${normalizeReason(check.reason, "check failed")}`);
    }
    if (check.status === "inconclusive") {
      inconclusiveReasons.push(`${checkId}: ${normalizeReason(check.reason, "measurement unavailable")}`);
    }
  }

  return {
    status: failures.length > 0 ? "fail" : inconclusiveReasons.length > 0 ? "inconclusive" : "pass",
    failures,
    inconclusiveReasons,
  };
}

function collectReviewReasons(evidence, aesthetics) {
  const reasons = [];
  if (evidence?.verificationPolicyChanged === true) {
    reasons.push("verification policy changed and requires explicit review");
  }

  const changedCaptures = normalizeUniqueStrings(evidence?.images?.changedCaptures);
  if (changedCaptures.length > 0 && aesthetics.status !== "pass") {
    reasons.push(`${changedCaptures.length} changed capture(s) require a complete aesthetic review`);
  }

  reasons.push(...aesthetics.reviewReasons);
  return normalizeUniqueStrings(reasons);
}

function resolveVerificationStatus({ aesthetics, checks, contract, reviewReasons }) {
  const checkResults = Object.values(checks);
  if (
    contract.status === "fail" ||
    aesthetics.status === "fail" ||
    checkResults.some((check) => check.status === "fail")
  ) {
    return "fail";
  }
  if (
    contract.status === "inconclusive" ||
    aesthetics.status === "inconclusive" ||
    checkResults.some((check) => check.status === "inconclusive")
  ) {
    return "inconclusive";
  }
  if (aesthetics.status === "review_required" || reviewReasons.length > 0) {
    return "review_required";
  }
  return "pass";
}

function summarizeMeanScore(scores) {
  if (scores.length === 0) return null;
  const mean = scores.reduce((total, entry) => total + entry.score, 0) / scores.length;
  return Number(mean.toFixed(2));
}

function summarizeMinimumScore(scores) {
  if (scores.length === 0) return null;
  return Math.min(...scores.map((entry) => entry.score));
}

function normalizeUniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((entry) => typeof entry === "string" && entry.trim().length > 0)));
}

function normalizeReason(reason, fallback) {
  return typeof reason === "string" && reason.trim().length > 0 ? reason : fallback;
}

function containsReviewedCaptureId(evidence, reviewedCaptures) {
  return Array.from(reviewedCaptures).some((captureId) => evidence.includes(captureId));
}

function readOption(args, name, fallback = "") {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
}

function writeVerdict(outputPath, verdict) {
  if (!outputPath) return;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(verdict, null, 2)}\n`);
}

function resolveExitCode(status, allowReviewRequired) {
  if (status === "pass") return 0;
  if (status === "review_required" && allowReviewRequired) return 0;
  if (status === "fail") return 1;
  if (status === "review_required") return 2;
  return 3;
}

function main(args) {
  const inputPath = readOption(args, "--input");
  const outputPath = readOption(args, "--output");
  const allowReviewRequired = args.includes("--allow-review-required");
  if (!inputPath) {
    throw new Error("--input is required");
  }

  const evidence = JSON.parse(readFileSync(inputPath, "utf8"));
  const verdict = evaluateTerrainVerification(evidence);
  writeVerdict(outputPath, verdict);
  console.log(JSON.stringify(verdict, null, 2));
  process.exitCode = resolveExitCode(verdict.status, allowReviewRequired);
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main(process.argv.slice(2));
}
