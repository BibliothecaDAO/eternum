import { Type, type TSchema } from "typebox";

/** A closed set of string values as a plain JSON-schema enum: what every tool-calling provider accepts at any depth. */
export const StringEnum = <T extends string>(values: readonly T[], description: string) =>
  Type.Unsafe<T>({ type: "string", enum: [...values], description }) satisfies TSchema;
