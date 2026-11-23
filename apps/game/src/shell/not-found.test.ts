import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

import { APP_STATE_WORDS, WORDS } from "@/ui/design-system/kit/words";

const NOT_FOUND_HTML = fileURLToPath(new URL("../../public/404.html", import.meta.url));

it("keeps public/404.html in step with APP_STATE_WORDS and WORDS", () => {
  const html = readFileSync(NOT_FOUND_HTML, "utf8");
  expect(html).toContain(`<h1>${APP_STATE_WORDS.nothingHere}</h1>`);
  expect(html).toContain(`<p>${APP_STATE_WORDS.nothingHereLine}</p>`);
  expect(html).toContain(`<a href="/">${WORDS.play}</a>`);
});
