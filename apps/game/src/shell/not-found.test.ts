import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";
import { paintingSources } from "@/ui/design-system/kit/paintings";
import { APP_STATE_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { appIdentity, appIdentityHtml } from "../../build/app-identity-html";

const scrimBackgroundOf = (css: string, selector: string) => {
  const block = css.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
  return block
    .replace(/\s+/g, " ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(
      /rgb\(var\(--app-aspect,\s*var\(--app-gold\)\)\s*\/\s*0\.(\d+)\)/g,
      "color-mix(in srgb, var(--gold) $1%, transparent)",
    )
    .replace(/var\(--app-ground\)/g, "var(--ground)")
    .trim();
};

it("keeps public/404.html and index.html in step with APP_STATE_WORDS, WORDS, paintingSources, AGE_LOCKUP, and LoadingStage", () => {
  const notFound = readFileSync("public/404.html", "utf8");
  const indexHtml = readFileSync("index.html", "utf8");
  const viteConfig = readFileSync("vite.config.ts", "utf8");
  const doorwayCss = readFileSync("src/ui/features/game-entry/doorway/doorway-screen.css", "utf8");
  expect(notFound).toContain(`<img src="${AGE_LOCKUP.frontier}"`);
  expect(notFound).toContain(`<h1>${APP_STATE_WORDS.nothingHere}</h1>`);
  expect(notFound).toContain(`<p>${APP_STATE_WORDS.nothingHereLine}</p>`);
  expect(notFound).toContain(`<a href="/">${WORDS.play}</a>`);
  expect(indexHtml).toContain(`<img src="${AGE_LOCKUP.frontier}"`);
  expect(indexHtml).toContain('src="%BOOT_MIST_SRC%"');
  expect(indexHtml).toContain('srcset="%BOOT_MIST_SRCSET%"');
  expect(viteConfig).toContain("appIdentityHtml(identity)");
  const plugin = appIdentityHtml(appIdentity(false));
  expect(plugin.transformIndexHtml.order).toBe("pre");
  const transformed = plugin.transformIndexHtml.handler(indexHtml);
  const mist = paintingSources("frontier-mist");
  expect(transformed).toContain(`src="${mist.src}"`);
  expect(transformed).toContain(`srcset="${mist.srcSet}"`);
  expect(transformed).not.toContain("%BOOT_MIST_");
  expect(scrimBackgroundOf(indexHtml, ".boot-shell__scrim")).toBe(
    scrimBackgroundOf(doorwayCss, ".doorway-stage__scrim"),
  );
});
