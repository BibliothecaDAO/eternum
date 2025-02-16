import type { Range } from "postgres-range";
import { customType } from "drizzle-orm/pg-core";
import {
  parse as rangeParse,
  serialize as rangeSerialize,
} from "postgres-range";

type Comparable = string | number;

type RangeBound<T extends Comparable> =
  | T
  | {
      value: T;
      inclusive: boolean;
    };

export class Int8Range {
  constructor(public readonly range: Range<number>) {}

  get start(): RangeBound<number> | null {
    return this.range.lower != null
      ? {
          value: this.range.lower,
          inclusive: this.range.isLowerBoundClosed(),
        }
      : null;
  }

  get end(): RangeBound<number> | null {
    return this.range.upper != null
      ? {
          value: this.range.upper,
          inclusive: this.range.isUpperBoundClosed(),
        }
      : null;
  }

  /*static fromInput(input: TimeRangeInput): Int8Range {
    const range = new Range<number>(input.startMs, input.endMs, RANGE_LB_INC);

    return new Int8Range(range);
  }*/
}

export const int8range = customType<{
  data: Int8Range;
}>({
  dataType: () => "int8range",
  fromDriver: (value: unknown): Int8Range => {
    if (typeof value !== "string") {
      throw new Error("Expected string");
    }

    const parsed = rangeParse(value, (val) => parseInt(val, 10));
    return new Int8Range(parsed);
  },
  toDriver: (value: Int8Range): string => rangeSerialize(value.range),
});
