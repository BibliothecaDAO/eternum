import { configManager } from "@bibliothecadao/eternum";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => [{ entityId: 5 }, { entityId: 6 }] }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentBlockTimestamp: () => 100 }));
vi.mock("./entity-resource-table-old", () => ({
  EntityResourceTableOld: ({ disableButtons }: { disableButtons?: boolean }) => (
    <output>{disableButtons ? "disabled" : "enabled"}</output>
  ),
}));

import { useUIStore } from "@/hooks/store/use-ui-store";
import { EntityResourceTable } from "./index";

afterEach(() => vi.restoreAllMocks());

/** The Balances table for a holding, once its lazily loaded table is drawn: whether its actions are enabled. */
const actionsFor = async (entityId: number) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(configManager, "getSeasonConfig").mockReturnValue({ startMainAt: 0 } as never);
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<EntityResourceTable entityId={entityId} />));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  const shown = host.querySelector("output")?.textContent;
  act(() => root.unmount());
  return shown;
};

it("enables a holding's actions by whether the player owns the holding shown, not the HUD's selection", async () => {
  // The HUD has someone else's structure selected while Balances shows the player's own holding 5.
  useUIStore.setState({ structureEntityId: 900 });
  expect(await actionsFor(5)).toBe("enabled");
  // And the other way round: the HUD on the player's realm, Balances on a holding that is not theirs.
  useUIStore.setState({ structureEntityId: 6 });
  expect(await actionsFor(901)).toBe("disabled");
});
