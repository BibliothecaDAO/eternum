import { Data } from "effect";
export class RosterFailure extends Data.TaggedError("RosterFailure")<{ operation: string }> {}
export class RegistrationOpen extends Data.TaggedError("RegistrationOpen")<{ secondsUntilClose: number }> {}
