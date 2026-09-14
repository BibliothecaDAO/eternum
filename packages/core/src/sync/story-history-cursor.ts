import type { HeraldHistoryEvent } from "./herald-http-types";

export interface StoryHistoryCursor {
  block: number;
  transaction: number;
  event: number;
}
export interface HeraldStoryHistoryPage {
  chain: string;
  world_address: string;
  complete_through_block: number;
  next_cursor: StoryHistoryCursor;
  items: HeraldHistoryEvent[];
}

export function parseStoryHistoryCursor(value: unknown): StoryHistoryCursor {
  if (typeof value === "string") {
    if (!/^\d{1,16}:\d{1,10}:\d{1,10}$/.test(value)) throw new Error("Invalid story cursor");
    const [block, transaction, event] = value.split(":").map(Number);
    return parseStoryHistoryCursor({ block, transaction, event });
  }
  if (!value || typeof value !== "object") throw new Error("Invalid story cursor");
  const cursor = value as StoryHistoryCursor;
  if (
    ![cursor.block, cursor.transaction, cursor.event].every((n) => Number.isSafeInteger(n) && n >= 0) ||
    cursor.transaction > 2147483647 ||
    cursor.event > 2147483647
  )
    throw new Error("Invalid story cursor");
  return { block: cursor.block, transaction: cursor.transaction, event: cursor.event };
}
export function encodeStoryHistoryCursor(cursor: StoryHistoryCursor): string {
  const value = parseStoryHistoryCursor(cursor);
  return `${value.block}:${value.transaction}:${value.event}`;
}
export function compareStoryHistoryCursors(a: StoryHistoryCursor, b: StoryHistoryCursor): number {
  return a.block - b.block || a.transaction - b.transaction || a.event - b.event;
}
export function endOfStoryBlock(block: number): StoryHistoryCursor {
  return parseStoryHistoryCursor({ block, transaction: 2147483647, event: 2147483647 });
}
