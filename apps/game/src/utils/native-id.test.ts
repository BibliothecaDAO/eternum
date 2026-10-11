import { expect, it } from "vitest";

import { storyPayloadId } from "./native-id";

it("reads a story's id exactly, and refuses one that Number() would have turned into another id", () => {
  expect(storyPayloadId("12")).toBe(12);
  expect(storyPayloadId("0xc")).toBe(12);
  expect(storyPayloadId(12n)).toBe(12);
  for (const malformed of ["1e1", " ", "", "7abc", null, undefined, {}])
    expect(() => storyPayloadId(malformed)).toThrow();
});
