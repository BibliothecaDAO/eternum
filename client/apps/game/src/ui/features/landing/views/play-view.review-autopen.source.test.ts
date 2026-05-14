// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("PlayView review auto-open", () => {
  it("only auto-opens game review for connected players registered in the ended game", () => {
    const source = readSource("src/ui/features/landing/views/play-view.tsx");

    expect(source).toContain("const hasConnectedAccountAddress");
    expect(source).toContain(
      'return game.gameStatus === "ended" && Boolean(game.worldAddress) && game.isRegistered === true;',
    );
    expect(source).toContain("if (!hasConnectedAccountAddress(account?.address)) return;");
    expect(source).toContain("const candidate = resolveGameReviewCandidate(endedGames);");
  });
});
