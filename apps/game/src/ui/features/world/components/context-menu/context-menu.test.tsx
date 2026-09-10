import { useUIStore } from "@/hooks/store/use-ui-store";
import { SceneName } from "@/three/types";
import type { ContextMenuAction } from "@/types/context-menu";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ContextMenu } from "./context-menu";

const openMenu = (actions: ContextMenuAction[]) =>
  useUIStore.getState().openContextMenu({
    id: "structure-1",
    title: "Stolsli",
    subtitle: "(2, 3)",
    position: { x: 100, y: 120 },
    scene: SceneName.WorldMap,
    actions,
  });

it("renders the store's menu at the pointer, drills into children, and closes on select or Escape", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const attack = vi.fn();
  const items = () => [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
  try {
    await act(async () => root.render(<ContextMenu />));
    expect(container.querySelector('[role="menu"]')).toBeNull();

    await act(async () =>
      openMenu([
        { id: "attack", label: "Create Attack Army", onSelect: attack },
        {
          id: "build",
          label: "Build",
          onSelect: () => {},
          childTitle: "Buildings",
          children: [{ id: "farm", label: "Farm", onSelect: () => {} }],
        },
      ]),
    );
    const menu = container.querySelector<HTMLElement>('[role="menu"]')!;
    expect(menu.style.left).toBe("100px");
    expect(menu.textContent).toContain("Stolsli");
    expect(items().map((item) => item.textContent)).toEqual(["Create Attack Army", "Build"]);

    await act(async () => items()[1].click());
    expect(items().map((item) => item.textContent)).toEqual(["Farm"]);
    expect(container.textContent).toContain("Buildings");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Back"]')!.click());
    expect(items()).toHaveLength(2);

    await act(async () => items()[0].click());
    expect(attack).toHaveBeenCalledOnce();
    expect(useUIStore.getState().contextMenu).toBeNull();

    await act(async () => openMenu([{ id: "x", label: "X", onSelect: () => {} }]));
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(useUIStore.getState().contextMenu).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
