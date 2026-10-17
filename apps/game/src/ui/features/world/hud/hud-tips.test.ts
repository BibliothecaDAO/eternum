import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/**
 * A native title on an HTML element: the browser draws it late, in its own style, outside the app's one tooltip, and a
 * disabled control's reason given this way is never read as the HUD's hover. A component's `title` prop (a panel's
 * header) is not one.
 */
const nativeTitles = (source: string): string[] =>
  [...source.matchAll(/\btitle=/g)].flatMap((match) => {
    const opening = source.lastIndexOf("<", match.index);
    const tag = /^<([A-Za-z][\w.]*)/.exec(source.slice(opening))?.[1] ?? "";
    return /^[a-z]/.test(tag) ? [`<${tag} title=…>`] : [];
  });

it("names every HUD reading and control on the one tooltip (data-tip or an accessible name), never a native title", () => {
  const titled = readdirSync(__dirname)
    .filter((name) => /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name))
    .flatMap((name) => nativeTitles(readFileSync(join(__dirname, name), "utf8")).map((tag) => `${name}: ${tag}`));
  expect(titled).toEqual([]);
});
