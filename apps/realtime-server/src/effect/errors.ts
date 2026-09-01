import { Data } from "effect";

export class IdentityUnavailable extends Data.TaggedError("IdentityUnavailable")<{
  readonly cause: unknown;
}> {}

export class PlayerRegistryUnavailable extends Data.TaggedError("PlayerRegistryUnavailable")<{
  readonly cause: unknown;
}> {}

export class HeraldUnavailable extends Data.TaggedError("HeraldUnavailable")<{
  readonly cause: unknown;
}> {}

export class BoundaryDecodeError extends Data.TaggedError("BoundaryDecodeError")<{
  readonly boundary: string;
  readonly cause: unknown;
}> {}

export class DatabaseFailure extends Data.TaggedError("DatabaseFailure")<{
  readonly operation: string;
  readonly cause: unknown;
}> {}

export class DirectMessageRejected extends Data.TaggedError("DirectMessageRejected")<{
  readonly code: string;
  readonly message: string;
  readonly status: 400 | 403 | 404 | 500;
}> {}
