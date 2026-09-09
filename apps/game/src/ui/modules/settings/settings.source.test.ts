import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
it("keeps Settings to profile, video, audio, shortcuts and session, with no Cinzel and no cut controls", () => {
  const source = readFileSync("src/ui/modules/settings/settings.tsx", "utf8");
  for (const removed of ["Zoom", "atmosphere", 'title="Dojo"', "LatestFeatures", "What's New", "Return Home", "Cinzel"])
    expect(source).not.toContain(removed);
  for (const title of ["Video & Graphics", "Audio", "Shortcuts"]) expect(source).toContain(`title="${title}"`);
  expect(source).toContain("<ProfileHeader />");
  expect(source).toContain("<RendererDebugControl");
  expect(source).toContain("getShortcutManager().getShortcuts()");
  expect(source).toContain("CHAT_SHORTCUT");
  expect(source).toContain("bg-gold text-dark-brown");
  expect(source).toContain("Copy address");
  expect(source).toContain("Sign out");
  expect(source).toContain("Leave game");
  expect(source.match(/font-sans/g)?.length ?? 0).toBeGreaterThan(1);
});
