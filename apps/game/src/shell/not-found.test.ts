import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";
import { APP_STATE_WORDS, WORDS } from "@/ui/design-system/kit/words";

it("keeps public/404.html and index.html in step with APP_STATE_WORDS, WORDS, and AGE_LOCKUP", () => {
  const notFound = readFileSync("public/404.html", "utf8");
  expect(notFound).toContain(`<img src="${AGE_LOCKUP.frontier}"`);
  expect(notFound).toContain(`<h1>${APP_STATE_WORDS.nothingHere}</h1>`);
  expect(notFound).toContain(`<p>${APP_STATE_WORDS.nothingHereLine}</p>`);
  expect(notFound).toContain(`<a href="/">${WORDS.play}</a>`);
  expect(readFileSync("index.html", "utf8")).toContain(`<img src="${AGE_LOCKUP.frontier}"`);
});
