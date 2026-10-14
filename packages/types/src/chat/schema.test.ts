import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import { describe, expect, it } from "vitest";
import {
  directMessageCreateSchema,
  directMessageReadReceiptSchema,
  directMessageTypingSchema,
} from "./direct-messages";
import {
  displayNameSchema,
  entityIdSchema,
  mapLocationSchema,
  messageContentSchema,
  metadataSchema,
  playerIdSchema,
  timestampSchema,
  zoneIdSchema,
} from "./shared";
import { worldChatPublishSchema } from "./world-chat";

const publish = Schema.decodeUnknownSync(worldChatPublishSchema);
const direct = Schema.decodeUnknownSync(directMessageCreateSchema);

it("normalizes published content and strips unknown fields without inventing optional fields", () => {
  expect(publish({ zoneId: "world:global", content: "  hold the ford  ", extra: true })).toStrictEqual({
    zoneId: "world:global",
    content: "hold the ford",
  });
  expect(
    publish({
      zoneId: "world:global",
      content: "hello",
      location: { x: 1, y: -2, z: undefined, extra: 9 },
      metadata: undefined,
    }),
  ).toStrictEqual({
    zoneId: "world:global",
    content: "hello",
    location: { x: 1, y: -2, z: undefined },
    metadata: undefined,
  });
  expect(direct({ recipientId: "bob", content: "  meet  ", threadId: undefined, extra: true })).toStrictEqual({
    recipientId: "bob",
    content: "meet",
    threadId: undefined,
  });
});

describe.each([
  ["entity", entityIdSchema, 191],
  ["player", playerIdSchema, 191],
  ["zone", zoneIdSchema, 128],
  ["display name", displayNameSchema, 64],
  ["content", messageContentSchema, 2000],
] as const)("%s limits", (_name, schema, max) => {
  const decode = Schema.decodeUnknownSync(schema);
  it("accepts the exact UTF-16 limit and rejects empty/oversized/non-string input", () => {
    expect(decode("a".repeat(max))).toBe("a".repeat(max));
    for (const invalid of ["", "a".repeat(max + 1), null, undefined, 1]) expect(() => decode(invalid)).toThrow();
  });
});

it("trims presentation text but preserves identifiers and rejects the reserved player delimiter", () => {
  expect(Schema.decodeUnknownSync(displayNameSchema)(" Alice ")).toBe("Alice");
  expect(Schema.decodeUnknownSync(entityIdSchema)(" ")).toBe(" ");
  expect(() => Schema.decodeUnknownSync(playerIdSchema)("a|b")).toThrow("reserved delimiter");
  expect(() => Schema.decodeUnknownSync(messageContentSchema)(" \n ")).toThrow("required");
  expect(Schema.decodeUnknownSync(messageContentSchema)("😀".repeat(1000))).toBe("😀".repeat(1000));
  expect(() => Schema.decodeUnknownSync(messageContentSchema)("😀".repeat(1001))).toThrow();
});

it("accepts finite coordinates only", () => {
  expect(Schema.decodeUnknownSync(mapLocationSchema)({ x: 0, y: -2.5 })).toStrictEqual({ x: 0, y: -2.5 });
  for (const x of [NaN, Infinity, -Infinity, "1", undefined]) {
    expect(() => Schema.decodeUnknownSync(mapLocationSchema)({ x, y: 0 })).toThrow();
  }
});

it.each([
  "2024-02-29T23:59:59.123Z",
  "2024-02-29T23:59Z",
  "2024-02-29T23:59:59+23:59",
  "2000-02-29T00:00Z",
  "0000-02-29T00:00Z",
  "0099-01-01T00:00Z",
])("preserves timestamp %s without converting it to a Date", (value) => {
  expect(Schema.decodeUnknownSync(timestampSchema)(value)).toBe(value);
});

it.each([
  "2023-02-29T00:00Z",
  "1900-02-29T00:00Z",
  "2024-04-31T00:00Z",
  "2024-01-01T24:00Z",
  "2024-01-01T12:60Z",
  "2024-01-01T12:00:60Z",
  "2024-01-01T12:00+24:00",
  "2024-01-01T12:00+01:60",
  "2024-01-01T12:00+0100",
  "2024-01-01T12:00",
  "2024-01-01t12:00z",
  new Date(NaN),
  null,
])("rejects invalid timestamp %s", (value) => {
  expect(() => Schema.decodeUnknownSync(timestampSchema)(value)).toThrow();
});

it("preserves a valid Date input and validates typing/read-receipt payloads", () => {
  const date = new Date("2024-01-01T00:00:00Z");
  expect(Schema.decodeUnknownSync(timestampSchema)(date)).toEqual(date);
  expect(
    Schema.decodeUnknownSync(directMessageReadReceiptSchema)({
      threadId: "t",
      messageId: "m",
      readerId: "alice",
      readAt: date,
      extra: 1,
    }),
  ).toStrictEqual({
    threadId: "t",
    messageId: "m",
    readerId: "alice",
    readAt: date,
  });
  expect(
    Schema.decodeUnknownSync(directMessageTypingSchema)({ threadId: "t", playerId: "alice", isTyping: false }),
  ).toStrictEqual({
    threadId: "t",
    playerId: "alice",
    isTyping: false,
  });
  expect(() =>
    Schema.decodeUnknownSync(directMessageTypingSchema)({ threadId: "t", playerId: "alice", isTyping: "false" }),
  ).toThrow();
});

it("enforces metadata key, depth and UTF-8 byte limits at their exact boundaries", () => {
  const decode = Schema.decodeUnknownSync(metadataSchema);
  const keys = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i), 0]));
  expect(decode(keys)).toStrictEqual(keys);
  expect(() => decode({ ...keys, extra: 0 })).toThrow("20 keys");
  expect(decode({ a: { b: { c: 1 } } })).toStrictEqual({ a: { b: { c: 1 } } });
  expect(() => decode({ a: { b: { c: { d: 1 } } } })).toThrow("depth 3");
  expect(decode({ a: "a".repeat(4088) })).toStrictEqual({ a: "a".repeat(4088) });
  expect(() => decode({ a: "a".repeat(4089) })).toThrow("4096 bytes");
  expect(decode({ a: "😀".repeat(1022) })).toStrictEqual({ a: "😀".repeat(1022) });
  expect(() => decode({ a: "😀".repeat(1023) })).toThrow("4096 bytes");
  expect(decode({ a: undefined, b: null })).toStrictEqual({ a: undefined, b: null });
  for (const value of [[], new Date(), new Map(), new Set(), null, new (class Metadata {})()])
    expect(() => decode(value)).toThrow();
});

it("reports the invalid nested field instead of returning a successful empty payload", () => {
  const result = Schema.decodeUnknownResult(worldChatPublishSchema, { errors: "all" })({
    zoneId: "world:global",
    content: "hello",
    location: { x: Infinity, y: 0 },
    metadata: { a: { b: { c: { d: 1 } } } },
  });
  expect(Result.isFailure(result)).toBe(true);
  if (Result.isSuccess(result)) throw new Error("Invalid payload was accepted");
  const issues = SchemaIssue.makeFormatterStandardSchemaV1()(result.failure.issue).issues;
  expect(issues.map((issue) => issue.path)).toEqual([["location", "x"], ["metadata"]]);
});

it("omits prototype keys, rejects symbol keys and preserves ordinary own record values", () => {
  const decode = Schema.decodeUnknownSync(metadataSchema);
  expect(decode(JSON.parse('{"__proto__":{"polluted":true},"a":2}'))).toStrictEqual({ a: 2 });
  expect(decode(Object.assign(Object.create(null), { a: 1 }))).toStrictEqual({ a: 1 });
  expect(decode(Object.defineProperty({}, "a", { value: 1 }))).toStrictEqual({ a: 1 });
  expect(() => decode({ [Symbol("key")]: 1 })).toThrow("record key");
});
