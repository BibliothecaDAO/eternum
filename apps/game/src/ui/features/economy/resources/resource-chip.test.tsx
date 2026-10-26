import { configManager, type ResourceManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0, useNativeRow: () => undefined }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 0 }));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({ ResourceIcon: () => null }));
vi.mock("@/ui/features/economy/transfers/transfer-window", () => ({ openTransfer: vi.fn() }));
vi.mock("@/ui/features/settlement/production/production-modal", () => ({ ProductionModal: () => null }));

import { ResourceChip } from "./resource-chip";

/** A holding with 5 of the resource on hand, producing nothing. */
const holding = { balance: 5_000_000_000, hasReachedMaxCapacity: false, amountProduced: 0n };
const resourceManager = {
  entityId: 1,
  balanceWithProduction: () => holding,
  current: () => undefined,
  timeUntilValueReached: () => 0,
  balance: () => 0,
} as unknown as ResourceManager;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const renderChip = (resourceId: ResourcesIds) => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root?.render(<ResourceChip resourceId={resourceId} resourceManager={resourceManager} activeRelicEffects={[]} />),
  );
  return [...container.querySelectorAll("button")].map((button) => button.getAttribute("aria-label"));
};

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.restoreAllMocks();
});

describe("a resource chip's actions", () => {
  it("name the resource they act on: Transfer, and no Burn", () => {
    expect(renderChip(ResourcesIds.Wood)).toEqual(["Transfer Wood"]);
  });

  it("name the relic they activate", () => {
    vi.spyOn(configManager, "getRelicActivation").mockReturnValue({ durationSeconds: 3_600, essenceCost: 100 });
    expect(renderChip(ResourcesIds.StaminaRelic1)).toEqual(["Transfer Stamina Relic I", "Activate Stamina Relic I"]);
  });
});
