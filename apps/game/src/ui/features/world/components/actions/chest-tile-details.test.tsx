// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRow: () => undefined }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  configManager: { getActiveGameId: () => 1, getVictoryPointGrants: () => ({ openRelicCrate: 250 }) },
}));

import { ChestTileDetails } from "./chest-tile-details";

const openButton = (onOpen?: () => void) => {
  const markup = renderToStaticMarkup(
    <ChestTileDetails
      crateEntityId={9}
      opening={null}
      onOpen={onOpen}
      openBlockedReason="Move one of your armies next to the crate."
    />,
  );
  return [...new DOMParser().parseFromString(markup, "text/html").querySelectorAll("button")].at(-1)!;
};

it("says what opening the crate needs instead of a greyed Open, and opens it once an army stands beside it", () => {
  const blocked = openButton();
  expect(blocked.textContent).toBe("Move next to it");
  expect(blocked.disabled).toBe(true);
  expect(blocked.getAttribute("data-tip")).toBe("Move one of your armies next to the crate.");

  const ready = openButton(() => undefined);
  expect(ready.textContent).toBe("Open");
  expect(ready.disabled).toBe(false);
});
