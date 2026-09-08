/** Structural checks shared by the browser evaluator and the Node capture command. */
export function evaluateAnimationCoverage(report) {
  const failures = [];
  const plan = report?.plan;
  const frames = report?.frames;
  if (!plan || !Array.isArray(plan.sampleFrames) || !Array.isArray(plan.views)) {
    return { complete: false, temporalCoverage: false, failures: ["missing-capture-plan"] };
  }
  if (!Array.isArray(frames) || frames.length === 0) {
    return { complete: false, temporalCoverage: false, failures: ["missing-capture-frames"] };
  }
  if (plan.truncated !== false) failures.push("truncated-or-unverified-capture");
  if (!Number.isInteger(plan.totalFrames) || plan.totalFrames < 2) failures.push("invalid-frame-count");
  if (!Number.isFinite(plan.fixedStepSeconds) || plan.fixedStepSeconds <= 0) failures.push("invalid-fixed-step");
  const expectedFrames = plan.sampleFrames;
  if (
    expectedFrames.length === 0 ||
    expectedFrames.some(
      (index, position) =>
        !Number.isInteger(index) ||
        index < 0 ||
        index >= plan.totalFrames ||
        (position > 0 && index <= expectedFrames[position - 1]),
    ) ||
    frames.length !== expectedFrames.length ||
    frames.some((frame, position) => frame?.frameIndex !== expectedFrames[position])
  )
    failures.push("frame-coverage-mismatch");
  const expectedViews = plan.views.map((view) => view?.id);
  if (
    expectedViews.length === 0 ||
    expectedViews.some((id) => typeof id !== "string") ||
    new Set(expectedViews).size !== expectedViews.length
  )
    failures.push("invalid-view-plan");
  for (const frame of frames) {
    const ids = Array.isArray(frame?.views) ? frame.views.map((view) => view?.id) : [];
    if (
      ids.length !== expectedViews.length ||
      new Set(ids).size !== ids.length ||
      expectedViews.some((id) => !ids.includes(id))
    )
      failures.push(`view-coverage-mismatch:F${frame?.frameIndex}`);
    if (
      !Number.isFinite(frame?.elapsedSeconds) ||
      Math.abs(frame.elapsedSeconds - frame.frameIndex * plan.fixedStepSeconds) > 1e-6
    )
      failures.push(`frame-time-mismatch:F${frame?.frameIndex}`);
  }
  const contiguous = frames.length === plan.totalFrames && frames.every((frame, index) => frame.frameIndex === index);
  if (plan.sampling === "all-frames" && !contiguous) failures.push("incomplete-temporal-capture");
  return {
    complete: failures.length === 0,
    temporalCoverage: failures.length === 0 && plan.sampling === "all-frames",
    failures,
  };
}

/** A successful export requires the shared evaluator and every planned image. */
export function evaluateAnimationReport(report) {
  const coverage = evaluateAnimationCoverage(report);
  const reasons = [...coverage.failures];
  if (report?.evaluation?.automatedHardGatePassed !== true) reasons.push("shared-objective-gate-failed-or-missing");
  for (const frame of Array.isArray(report?.frames) ? report.frames : []) {
    if (!Array.isArray(frame?.issues)) reasons.push(`missing-pose-issues:F${frame?.frameIndex}`);
    else reasons.push(...frame.issues.map((issue) => `F${frame.frameIndex}:${issue}`));
    for (const view of Array.isArray(frame?.views) ? frame.views : []) {
      if (view?.imageNonBlank !== true) reasons.push(`blank-view:F${frame.frameIndex}:${view?.id}`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}
