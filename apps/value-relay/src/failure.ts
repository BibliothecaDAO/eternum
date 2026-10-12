import { Data } from "effect";

export class RelayFailure extends Data.TaggedError("RelayFailure")<{ operation: string }> {}
