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
    expect(paint(0)).toContain("/images/labels/realm.png");
    expect(paint(0)).not.toContain("/images/labels/enemy_realm.png");
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
