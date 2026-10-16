import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";

const ENTITY_ID_MAX_LENGTH = 191;
const PLAYER_ID_MAX_LENGTH = 191;
const ZONE_ID_MAX_LENGTH = 128;
const DISPLAY_NAME_MAX_LENGTH = 64;
const MESSAGE_MAX_LENGTH = 2000;
const METADATA_MAX_KEYS = 20;
const METADATA_MAX_BYTES = 4096;
const METADATA_MAX_DEPTH = 3;

export const entityIdSchema = Schema.String.check(
  Schema.isMinLength(1, { message: "Entity id is required." }),
  Schema.isMaxLength(ENTITY_ID_MAX_LENGTH, { message: "Entity id is too long." }),
);

export const playerIdSchema = Schema.String.check(
  Schema.isMinLength(1, { message: "Player id is required." }),
  Schema.isMaxLength(PLAYER_ID_MAX_LENGTH, { message: "Player id is too long." }),
  Schema.makeFilter((value) => !value.includes("|"), { message: "Player id contains a reserved delimiter." }),
);

export const zoneIdSchema = Schema.String.check(
  Schema.isMinLength(1, { message: "Zone id is required." }),
  Schema.isMaxLength(ZONE_ID_MAX_LENGTH, { message: "Zone id is too long." }),
);

export const displayNameSchema = Schema.Trim.check(
  Schema.isMinLength(1, { message: "Display name is required." }),
  Schema.isMaxLength(DISPLAY_NAME_MAX_LENGTH, { message: "Display name is too long." }),
);

const isChatTimestamp = (value: string): boolean => {
  const match =
    /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(
      value,
    );
  if (!match) return false;
  const [, year, month, day] = match;
  const monthEnd = new Date(0);
  monthEnd.setUTCFullYear(Number(year), Number(month), 0);
  return Number(day) <= monthEnd.getUTCDate();
};

export const timestampSchema = Schema.Union([
  Schema.Date,
  Schema.String.check(Schema.makeFilter(isChatTimestamp, { message: "Invalid timestamp format." })),
]);

export const mapLocationSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.optional(Schema.Finite),
});

export const messageContentSchema = Schema.Trim.check(
  Schema.isMinLength(1, { message: "Message content is required." }),
  Schema.isMaxLength(MESSAGE_MAX_LENGTH, { message: "Message content is too long." }),
);

const metadataDepth = (value: unknown, depth = 0): number => {
  if (value === null || typeof value !== "object") return depth;
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.reduce((maximum, child) => Math.max(maximum, metadataDepth(child, depth + 1)), depth);
};

export const chatRecordSchema = Schema.declare((value): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const constructor = value.constructor;
  return (
    typeof constructor !== "function" ||
    (constructor.prototype !== null &&
      typeof constructor.prototype === "object" &&
      Object.hasOwn(constructor.prototype, "isPrototypeOf"))
  );
})
  .check(
    Schema.makeFilter((value) => Object.getOwnPropertySymbols(value).length === 0, { message: "Invalid record key" }),
  )
  .pipe(
    Schema.decodeTo(Schema.Record(Schema.String, Schema.Unknown), {
      decode: SchemaGetter.transform((value) =>
        Object.fromEntries(
          Object.getOwnPropertyNames(value)
            .filter((key) => key !== "__proto__")
            .map((key) => [key, value[key]]),
        ),
      ),
      encode: SchemaGetter.transform((value) => value),
    }),
  );

export const metadataSchema = chatRecordSchema.check(
  Schema.makeFilter((value) => Object.keys(value).length <= METADATA_MAX_KEYS, {
    message: `Metadata cannot contain more than ${METADATA_MAX_KEYS} keys.`,
  }),
  Schema.makeFilter((value) => new TextEncoder().encode(JSON.stringify(value)).byteLength <= METADATA_MAX_BYTES, {
    message: `Metadata cannot exceed ${METADATA_MAX_BYTES} bytes.`,
  }),
  Schema.makeFilter((value) => metadataDepth(value) <= METADATA_MAX_DEPTH, {
    message: `Metadata cannot exceed depth ${METADATA_MAX_DEPTH}.`,
  }),
);
