import { Buffer } from "node:buffer";

export interface StoryHistoryQuery {
  afterBlock?: number;
  cursor?: string;
  limit: number;
}

interface HistoryCursorScope {
  chain: string;
  world: string;
}

export type HistoryPosition = [block: number] | [block: number, transaction: number, event: number];

interface HistoryCursor extends HistoryCursorScope {
  v: 1;
  after: HistoryPosition;
  through?: number;
}

export class HistoryCursorError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 409 | 503 = 400,
  ) {
    super(message);
  }
}

export function parseStoryHistoryQuery(url: URL): StoryHistoryQuery {
  const allowed = new Set(["cursor", "after_block", "limit"]);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1)
      throw new HistoryCursorError("invalid_history_query");
  }
  const limit = readInteger(url.searchParams.get("limit") ?? "100", 1, 500);
  const cursor = url.searchParams.get("cursor");
  const after = url.searchParams.get("after_block");
  if ((cursor === null) === (after === null)) throw new HistoryCursorError("provide_cursor_or_after_block");
  return cursor !== null ? { cursor, limit } : { afterBlock: readInteger(after!, -1), limit };
}

export function resolveHistoryWindow(query: StoryHistoryQuery, scope: HistoryCursorScope, complete: number | null) {
  if (complete === null) throw new HistoryCursorError("history_not_ready", 503);
  if (!Number.isSafeInteger(complete) || complete < 0) throw new Error("Invalid stored history completion boundary");
  if (!Number.isSafeInteger(query.limit) || query.limit < 1 || query.limit > 500)
    throw new HistoryCursorError("invalid_history_limit");
  if ((query.cursor === undefined) === (query.afterBlock === undefined))
    throw new HistoryCursorError("provide_cursor_or_after_block");
  const cursor =
    query.cursor !== undefined
      ? decodeHistoryCursor(query.cursor, scope)
      : { ...scope, v: 1 as const, after: [query.afterBlock!] as HistoryPosition };
  if (!validPosition(cursor.after)) throw new HistoryCursorError("invalid_history_position");
  const through = cursor.through ?? complete;
  if (through > complete || cursor.after[0] > through)
    throw new HistoryCursorError("history_boundary_unavailable", 409);
  return { after: cursor.after, through, complete };
}

export function encodeHistoryCursor(scope: HistoryCursorScope, after: HistoryPosition, through?: number): string {
  const cursor: HistoryCursor = { ...scope, v: 1, after, ...(through === undefined ? {} : { through }) };
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeHistoryCursor(token: string, scope: HistoryCursorScope): HistoryCursor {
  let cursor: HistoryCursor;
  try {
    if (token.length > 2048 || !/^[\w-]+$/.test(token)) throw new Error();
    cursor = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
    if (
      !cursor ||
      cursor.v !== 1 ||
      typeof cursor.chain !== "string" ||
      typeof cursor.world !== "string" ||
      !validPosition(cursor.after)
    )
      throw new Error();
    if (Object.keys(cursor).some((key) => !["v", "chain", "world", "after", "through"].includes(key)))
      throw new Error();
    if (
      cursor.through !== undefined &&
      (!Number.isSafeInteger(cursor.through) || cursor.through < cursor.after[0] || cursor.through < 0)
    )
      throw new Error();
    if (cursor.after.length === 3 && cursor.through === undefined) throw new Error();
  } catch {
    throw new HistoryCursorError("invalid_history_cursor");
  }
  if (cursor.chain !== scope.chain || cursor.world !== scope.world)
    throw new HistoryCursorError("history_cursor_out_of_scope", 409);
  return cursor;
}

function validPosition(value: unknown): value is HistoryPosition {
  if (!Array.isArray(value) || (value.length !== 1 && value.length !== 3)) return false;
  if (!Number.isSafeInteger(value[0]) || value[0] < (value.length === 1 ? -1 : 0)) return false;
  return value.slice(1).every((index) => Number.isInteger(index) && index >= 0 && index <= 2147483647);
}

function readInteger(value: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value);
  if (!/^(?:-1|0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new HistoryCursorError("invalid_history_query");
  return parsed;
}
