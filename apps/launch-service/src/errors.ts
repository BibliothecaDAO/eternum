import { Data } from "effect";

export class BoundaryDecodeError extends Data.TaggedError("BoundaryDecodeError")<{
  readonly boundary: string;
  readonly cause: unknown;
}> {}

export class IdentityUnavailable extends Data.TaggedError("IdentityUnavailable")<{
  readonly cause: unknown;
}> {}

export class DatabaseFailure extends Data.TaggedError("DatabaseFailure")<{
  readonly operation: string;
  readonly cause: unknown;
}> {}

export class LaunchExecutionFailure extends Data.TaggedError("LaunchExecutionFailure")<{
  readonly runId: string;
  readonly cause: unknown;
}> {}
