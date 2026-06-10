// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Landing music player wiring", () => {
  it("mounts the compact music player in the landing header controls", () => {
    const layoutSource = readSource("src/ui/features/landing/landing-layout.tsx");

    expect(layoutSource).toContain('import { LandingMusicPlayer } from "./components/landing-music-player"');
    expect(layoutSource).toContain('<LandingMusicPlayer className="hidden lg:flex" presentation="header" />');
  });

  it("supports a smaller header presentation while preserving playback controls", () => {
    const playerSource = readSource("src/ui/features/landing/components/landing-music-player.tsx");

    expect(playerSource).toContain("requestStart");
    expect(playerSource).toContain("handleToggleMute");
    expect(playerSource).toContain("handleSkip");
    expect(playerSource).toContain('presentation = "floating"');
    expect(playerSource).toContain('presentation === "header"');
    expect(playerSource).toContain('aria-label="Music volume"');
    expect(playerSource).toContain("currentTrackLabel");
  });
});
