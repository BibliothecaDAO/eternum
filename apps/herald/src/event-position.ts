import type { RawWorldEvent } from "./types";

export const compareWorldEvents = (left: RawWorldEvent, right: RawWorldEvent): number =>
  (left.block_number ?? Number.MAX_SAFE_INTEGER) - (right.block_number ?? Number.MAX_SAFE_INTEGER) ||
  left.transaction_index - right.transaction_index ||
  left.event_index - right.event_index;
