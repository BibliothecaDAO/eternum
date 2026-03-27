import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Direction } from "@bibliothecadao/types";

import { SettlementPlannerMap } from "./settlement-planner-map";
import type { SettlementPlannerData, SettlementPlannerTarget } from "./settlement-planner-utils";

const waitForAsyncWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const plannerData: SettlementPlannerData = {
  terrainTiles: [
    {
      id: "terrain:0:0",
      coordX: 0,
      coordY: 0,
      biome: 1,
      pixelX: 0,
      pixelY: 0,
    },
  ],
  realmSlots: [
    {
      id: "realm-slot:1",
      side: 0,
      layer: 1,
      point: 0,
      coordX: 10,
      coordY: 10,
      pixelX: 120,
      pixelY: 80,
      occupied: false,
    },
  ],
  realms: [
    {
      id: "realm:7",
      entityId: 7,
      realmId: 7,
      ownerAddress: "0x7",
      ownerName: "Ayla",
      coordX: 10,
      coordY: 10,
      villagesCount: 0,
      freeDirectionCount: 6,
      optimistic: false,
      pixelX: 120,
      pixelY: 80,
    },
  ],
  villageSlots: [
    {
      id: "village-slot:7:12:10:EAST",
      realmEntityId: 7,
      realmId: 7,
      ownerAddress: "0x7",
      ownerName: "Ayla",
      coordX: 12,
      coordY: 10,
      direction: Direction.EAST,
      villageEntityId: null,
      occupied: false,
      pending: false,
      pixelX: 140,
      pixelY: 80,
    },
  ],
};

const selectedVillageSlot: SettlementPlannerTarget = {
  type: "village_slot",
  slot: plannerData.villageSlots[0]!,
};

describe("SettlementPlannerMap", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await waitForAsyncWork();
    });

    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("keeps the current camera when selection changes", async () => {
    const onSelectTarget = vi.fn();

    await act(async () => {
      root.render(
        <SettlementPlannerMap plannerData={plannerData} selectedTarget={null} onSelectTarget={onSelectTarget} />,
      );
      await waitForAsyncWork();
    });

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    const initialViewBox = svg?.getAttribute("viewBox");

    await act(async () => {
      root.render(
        <SettlementPlannerMap
          plannerData={plannerData}
          selectedTarget={selectedVillageSlot}
          onSelectTarget={onSelectTarget}
        />,
      );
      await waitForAsyncWork();
    });

    expect(svg?.getAttribute("viewBox")).toBe(initialViewBox);
  });
});
