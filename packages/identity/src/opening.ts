import * as Schema from "effect/Schema";

/**
 * The moments Frontier's interface opens at, in the order a player meets them (the frozen design, "The interface opens
 * as you play"). Each shows its parts of the screen and its one line; the account keeps the moments it reached, so a
 * part earned on an earlier day stays shown after the army that earned it is gone.
 */
export const OPENING_MOMENTS = [
  "launch",
  "barracks",
  "guard",
  "fight",
  "essence",
  "well-lore",
  "shrine-lore",
  "deep",
  "bane",
] as const;
export type OpeningMoment = (typeof OPENING_MOMENTS)[number];

/** What an account keeps of the opening interface: the moments it reached, and whether it shows everything. */
export interface OpeningRecord {
  owner: string;
  reached: OpeningMoment[];
  showAll: boolean;
}

/** A save: moments to add to those kept, and Show everything only when the player changed it. */
export interface OpeningChange {
  owner: string;
  reach: OpeningMoment[];
  showAll?: boolean;
}

const momentSchema = Schema.Literals(OPENING_MOMENTS);
const momentsSchema = Schema.Array(momentSchema).check(Schema.isMaxLength(OPENING_MOMENTS.length));
const recordSchema = Schema.Struct({
  owner: Schema.String.check(Schema.isMinLength(1)),
  reached: momentsSchema,
  showAll: Schema.Boolean,
});
const changeSchema = Schema.Struct({
  owner: Schema.String.check(Schema.isMinLength(1)),
  reach: momentsSchema,
  showAll: Schema.optional(Schema.Boolean),
});

export function parseOpeningRecord(value: unknown): OpeningRecord {
  const record = Schema.decodeUnknownSync(recordSchema)(value);
  return { owner: record.owner, reached: [...record.reached], showAll: record.showAll };
}

export function parseOpeningChange(value: unknown): OpeningChange {
  const change = Schema.decodeUnknownSync(changeSchema)(value);
  return {
    owner: change.owner,
    reach: [...change.reach],
    ...(change.showAll === undefined ? {} : { showAll: change.showAll }),
  };
}
