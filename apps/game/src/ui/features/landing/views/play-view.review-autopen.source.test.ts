// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("PlayView review auto-open", () => {
  it("does not auto-open game reviews from the landing play page", () => {
    const source = readSource("src/ui/features/landing/views/play-view.tsx");

    expect(source).not.toContain("shouldAutoOpenGameReview");
    expect(source).not.toContain("resolveGameReviewCandidate");
    expect(source).not.toContain("onEndedGamesResolved");
    expect(source).not.toContain("endedGames");
    expect(source).not.toContain("isGameReviewDismissed");
  });

  it("keeps landing review actions manual", () => {
    const source = readSource("src/ui/features/landing/views/play-view.tsx");

    expect(source).toContain("const handleSeeScore = useCallback");
    expect(source).toContain("setReviewWorld(selection);");
    expect(source).toContain("<GameReviewModal");
  });

  it("keeps the in-game finished surface a pill that points at the dashboard, never a modal", () => {
    const source = readSource("src/ui/features/world/containers/top-header/game-end-timer.tsx");

    expect(source).toContain("const GameFinishedPill");
    expect(source).toContain("<GameFinishedPill />");
    expect(source).toContain("resetBootstrap();");
    expect(source).toContain('navigate("/");');
    expect(source).not.toContain("GameIsOverModal");
    expect(source).not.toContain("GameReviewModal");
  });
});
