import { expect, it } from "vitest";

import { insertMention, mentionChoices, mentions, messageParts, typedMention } from "./mentions";

const NAMES = ["Ada", "Ser Ada", "Aldric", "Corwin", "Maelis"];

it("finds the mention the caret is typing, and none inside a word or past a line", () => {
  expect(typedMention("hi @al", 6)).toEqual({ at: 3, query: "al" });
  expect(typedMention("@", 1)).toEqual({ at: 0, query: "" });
  expect(typedMention("hi @Ser A", 9)).toEqual({ at: 3, query: "Ser A" });
  expect(typedMention("mail ada@realms.test", 20)).toBeNull();
  expect(typedMention("hi there", 8)).toBeNull();
  // The caret before the "@": nothing is being typed after it.
  expect(typedMention("hi @al", 2)).toBeNull();
});

it("offers the names a typed mention starts, ignoring case, in name order, six at most", () => {
  expect(mentionChoices(NAMES, "a")).toEqual(["Ada", "Aldric"]);
  expect(mentionChoices(NAMES, "SER")).toEqual(["Ser Ada"]);
  expect(mentionChoices(NAMES, "x")).toEqual([]);
  expect(mentionChoices(NAMES, "")).toEqual(["Ada", "Aldric", "Corwin", "Maelis", "Ser Ada"]);
  const many = ["G", "F", "E", "D", "C", "B", "A"];
  expect(mentionChoices(many, "")).toEqual(["A", "B", "C", "D", "E", "F"]);
});

it("writes the picked name over what was typed, with a space after it, and the caret after that", () => {
  expect(insertMention("hi @al", 3, 6, "Aldric")).toEqual({ text: "hi @Aldric ", caret: 11 });
  expect(insertMention("@al hold", 0, 3, "Aldric")).toEqual({ text: "@Aldric hold", caret: 8 });
});

it("reads mentions of known names, the longest that fits, and leaves numbers as words", () => {
  expect(messageParts("@ser ada and @Ada, 1,200 knights at 12, -4", NAMES)).toEqual([
    { type: "mention", text: "@ser ada", name: "Ser Ada" },
    { type: "text", text: " and " },
    { type: "mention", text: "@Ada", name: "Ada" },
    { type: "text", text: ", 1,200 knights at 12, -4" },
  ]);
  // Not a mention: an address, a name that runs on into a longer word, a name nobody has.
  for (const content of ["ada@realms.test", "@Adams", "@Nobody"]) {
    expect(messageParts(content, NAMES)).toEqual([{ type: "text", text: content }]);
  }
});

it("reads links whole, the sentence's closing punctuation left outside them", () => {
  const parts = messageParts("read https://docs.realms.party/frontier/expedition. then (https://youtu.be/x?t=1)!", []);
  expect(
    parts.map((part) => (part.type === "link" ? `<${part.url.href}>` : part.type === "text" ? part.text : "")),
  ).toEqual(["read ", "<https://docs.realms.party/frontier/expedition>", ". then (", "<https://youtu.be/x?t=1>", ")!"]);
  expect(messageParts("no link in realms.party or http:/ here", [])).toEqual([
    { type: "text", text: "no link in realms.party or http:/ here" },
  ]);
});

it("tells a message that mentions the player from one that mentions someone else", () => {
  expect(mentions(messageParts("@maelis your army", NAMES), "Maelis")).toBe(true);
  expect(mentions(messageParts("@Aldric hold, Maelis", NAMES), "Maelis")).toBe(false);
  expect(mentions(messageParts("@Maelis", NAMES), null)).toBe(false);
});
