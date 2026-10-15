import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TileOccupier } from "@bibliothecadao/types";
import { HexMinimapView } from "@/ui/features/world/components/bottom-right-panel/hex-minimap";
import { StructureStatusRowView } from "@/ui/features/world/components/structure-status-row/structure-status-row";
import { currentStructure, makeStructures } from "./fixtures";

describe("shipped HUD views on lab facts", () => {
  it("keeps hex placement independent of the contract map center and resolves owned markers", () => {
    const paint = (center: number) =>
      renderToStaticMarkup(
        <HexMinimapView
          tiles={[
            {
              col: center,
              row: center,
              biome: 11,
              occupier_id: "3",
              occupier_type: TileOccupier.RealmRegularLevel2,
              occupier_is_structure: true,
            },
          ]}
          selectedHex={{ col: center, row: center }}
          cameraTargetHex={{ col: center, row: center }}
          navigationTarget={null}
          cameraDistance={20}
          mapCenter={center}
          ownedStructureIds={new Set(["3"])}
          ownedExplorerIds={new Set()}
        />,
      );
    expect(paint(0)).toBe(paint(2147483647));
    expect(paint(0)).toContain("<polygon");
    expect(paint(0)).toContain('data-marker="map-realm"');
    expect(paint(0)).toContain('data-owner="you"');
  });
  it("selects the shipped row and keeps the realm action separate from selection", async () => {
    const select = vi.fn(),
      upgrade = vi.fn();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <StructureStatusRowView
          structure={currentStructure(makeStructures(3)[2])}
          isActive
          onSelect={select}
          realmActions={<button onClick={upgrade}>Level up to City</button>}
        />,
      ),
    );
    await act(async () => container.querySelector<HTMLElement>('[title="Stolsli"]')!.click());
    expect(select).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledWith(3);
    select.mockClear();
    await act(async () =>
      [...container.querySelectorAll("button")].find((button) => button.textContent === "Level up to City")!.click(),
    );
    expect(upgrade).toHaveBeenCalledOnce();
    expect(select).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    container.remove();
  });
});

import { TroopChip } from "@/ui/features/military/components/troop-chip";
import { ResourceToken } from "@/ui/features/world/containers/left-facets/resource-token";
import { StructureActionsPanelView } from "@/ui/features/world/containers/left-facets/structure-actions-panel";
import { PaintedMinimapView } from "@/ui/features/world/components/bottom-right-panel/painted-minimap";
import { TroopTier, TroopType } from "@bibliothecadao/types";
import { StructureListColumnView } from "@/ui/features/world/containers/left-facets/structure-list-column";

describe("production HUD views", () => {
  it("uses all nine portraits in actual troop rows and named production tokens", () => {
    const html = renderToStaticMarkup(
      <>
        {[TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin].flatMap((type) =>
          [TroopTier.T1, TroopTier.T2, TroopTier.T3].map((tier) => (
            <div key={`${type}-${tier}`}>
              <TroopChip troops={{ category: type, tier, count: 120n }} />
              <ResourceToken
                label={tier === TroopTier.T1 ? type : `${type}${tier}`}
                amount="120"
                detail="120 held"
                producing={false}
                seconds={0}
              />
            </div>
          )),
        )}
      </>,
    );
    for (const type of ["knight", "crossbowman", "paladin"])
      for (const tier of [1, 2, 3]) expect(html.match(new RegExp(`${type}-t${tier}\\.webp`, "g"))).toHaveLength(2);
    expect(html).not.toContain("/image-icons/kit/");
  });
  it("renders village and mine badges inside native hexes and carries ownership and value facts", () => {
    const html = renderToStaticMarkup(
      <PaintedMinimapView
        tiles={[
          {
            col: 0,
            row: 0,
            biome: 11,
            occupier_id: "1",
            occupier_type: TileOccupier.Village,
            occupier_is_structure: true,
          },
          {
            col: 3,
            row: 0,
            biome: 11,
            occupier_id: "2",
            occupier_type: TileOccupier.Mine,
            occupier_is_structure: true,
          },
          {
            col: 6,
            row: 0,
            biome: 11,
            occupier_id: "3",
            occupier_type: TileOccupier.ExplorerKnightT3,
            ownerCue: "ally",
            strength: 7000,
          },
        ]}
        mapCenter={0}
        cameraDistance={20}
        cameraTargetHex={null}
        selectedHex={null}
        navigationTarget={null}
        ownedStructureIds={new Set(["1"])}
        ownedExplorerIds={new Set()}
      />,
    );
    expect(html).toContain("map-village.webp");
    expect(html).toContain("map-mine.webp");
    expect(html.match(/data-marker=/g)).toHaveLength(3);
    expect(html).toContain('data-owner="ally"');
    expect(html).toContain("•••");
    expect(html).not.toContain('class="map-marker');
  });
  it("keeps all ten category filters and realm upgrade information without guard counters", () => {
    const html = renderToStaticMarkup(
      <StructureListColumnView
        structures={makeStructures(220).map(currentStructure)}
        selectedId={3}
        filterValue="all"
        onFilterChange={() => {}}
        onSelect={() => {}}
        renderActions={() => <button>Level up</button>}
      />,
    );
    for (const name of [
      "Realms",
      "Villages",
      "Camps",
      "Mines",
      "Hyperstructures",
      "Banks",
      "Bitcoin mines",
      "Rifts",
      "Ruins",
      "Stragglers",
    ])
      expect(html).toContain(`aria-label="${name}"`);
    expect(html).toContain("Lv ");
    expect(html).toContain("Level up");
    expect(html).not.toContain("guards");
    expect(html).not.toContain("Needs attention");
  });
  it("dispatches the real command callback and depicts Transfer as a donkey", async () => {
    const click = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <StructureActionsPanelView
          actions={[{ id: "transfer", label: "Transfer", active: false, refusal: null, onClick: click }]}
        />,
      ),
    );
    expect(host.querySelector("img")?.getAttribute("src")).toMatch(/donkey\.webp$/);
    await act(async () => host.querySelector("button")!.click());
    expect(click).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
    host.remove();
  });
});
