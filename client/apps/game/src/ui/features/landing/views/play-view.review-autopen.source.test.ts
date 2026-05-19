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
    expect(source).toContain("const handleClaimRewards = useCallback");
    expect(source).toContain('setReviewInitialStep("claim-rewards");');
    expect(source).toContain("setReviewWorld(selection);");
    expect(source).toContain("<GameReviewModal");
  });

  it("keeps automatic review prompting owned by the in-game endgame flow", () => {
    const source = readSource("src/ui/shared/components/endgame-modal.tsx");

    expect(source).toContain("export const EndgameModal");
    expect(source).toContain("isGameReviewDismissed");
    expect(source).toContain("const handleOpenReview = useCallback");
    expect(source).toContain("<GameIsOverModal");
    expect(source).toContain("<GameReviewModal");
  });
});
