export type AwsRuntimeFailureClassification =
  | "missing-foundation-config"
  | "aws-command-failed"
  | "image-not-found"
  | "rollout-failed"
  | "stabilization-timeout"
  | "runtime-state-indeterminate"
  | "runtime-validation"
  | "unknown";

export class AwsRuntimeOperationalError extends Error {
  override name = "AwsRuntimeOperationalError";

  constructor(
    readonly classification: AwsRuntimeFailureClassification,
    message: string,
  ) {
    super(message);
  }
}
