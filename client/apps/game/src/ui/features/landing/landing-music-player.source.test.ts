// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Landing music player wiring", () => {
  it("mounts the compact music player inside the landing layout shell", () => {
    const layoutSource = readSource("src/ui/features/landing/landing-layout.tsx");

    expect(layoutSource).toContain('import { LandingMusicPlayer } from "./components/landing-music-player"');
    expect(layoutSource).toContain("<LandingMusicPlayer />");
  });

  it("offers playlist toggles and audio startup controls from the landing player", () => {
    const playerSource = readSource("src/ui/features/landing/components/landing-music-player.tsx");

    expect(playerSource).toContain("requestStart");
    expect(playerSource).toContain("setCustomTrack");
    expect(playerSource).toContain("playlist.map");
    expect(playerSource).toContain("Music ready");
  });
});
