// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Landing settings isolation", () => {
  it("keeps the dashboard settings panel free of Dojo-bound react package hooks", () => {
    const source = readSource("src/ui/features/landing/components/landing-settings.tsx");

    expect(source).not.toContain("@bibliothecadao/react");
    expect(source).toContain("isDocumentFullScreen");
    expect(source).toContain("fullscreenchange");
  });

  it("uses a presentation-only track label instead of a Dojo-bound music display helper", () => {
    const landingSettingsSource = readSource("src/ui/features/landing/components/landing-settings.tsx");
    const musicPlayerSource = readSource("src/audio/components/MusicPlayer.tsx");

    expect(landingSettingsSource).toContain("<ScrollingTrackName trackName={trackName} />");
    expect(musicPlayerSource).not.toContain("useGameModeConfig");
    expect(musicPlayerSource).toContain("trackArtist?: string");
  });
});
