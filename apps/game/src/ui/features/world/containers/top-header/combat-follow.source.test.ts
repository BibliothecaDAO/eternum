import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("removes automatic combat following from the header, store and scene", () => {
  for (const path of [
    "src/ui/features/world/containers/top-header/top-header.tsx",
    "src/hooks/store/use-ui-store.ts",
    "src/three/scenes/worldmap.tsx",
  ]) {
    expect(readFileSync(path, "utf8")).not.toMatch(/followArmyCombats|setFollowArmyCombats/);
  }
  expect(readFileSync("src/ui/features/event-feed/story-feed-row.tsx", "utf8")).toContain(
    "position && navigate(position)",
  );
});
