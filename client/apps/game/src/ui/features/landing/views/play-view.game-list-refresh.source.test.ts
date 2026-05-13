import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readPlayViewSource = () =>
  readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");
const readFactoryHookSource = () =>
  readFileSync(resolve(process.cwd(), "src/ui/features/factory-v2/hooks/use-factory-v2.ts"), "utf8");

describe("PlayView game list refresh wiring", () => {
  it("refreshes the shared world list queries from the visible Play refresh button", () => {
    const source = readPlayViewSource();
    const refreshStart = source.indexOf("const handleRefresh = useCallback");
    const reviewStart = source.indexOf("const dismissReviewForWorld");
    const refreshBlock = source.slice(refreshStart, reviewStart);

    expect(refreshStart).toBeGreaterThan(-1);
    expect(reviewStart).toBeGreaterThan(refreshStart);
    expect(refreshBlock).toContain("await invalidateWorldListQueries(queryClient)");
    expect(refreshBlock).not.toContain('queryKey: ["worldAvailability"]');
  });

  it("refreshes Play lists when Factory V2 observes a completed run", () => {
    const playViewSource = readPlayViewSource();
    const factoryHookSource = readFactoryHookSource();

    expect(playViewSource).toContain("FACTORY_GAME_LIST_REFRESH_EVENT");
    expect(playViewSource).toContain("window.addEventListener(FACTORY_GAME_LIST_REFRESH_EVENT, refreshGameLists)");
    expect(factoryHookSource).toContain("requestGameListRefreshForCompletedRun(nextRun)");
  });
});
