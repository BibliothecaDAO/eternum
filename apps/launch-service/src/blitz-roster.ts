import { Data } from "effect";
export class RegistrationOpen extends Data.TaggedError("RegistrationOpen")<{ secondsUntilClose: number }> {}
