import { useUIStore } from "@/hooks/store/use-ui-store";
import type { ContextMenuAction } from "@/types/context-menu";
import { HudMenu } from "@/ui/design-system/kit/hud-elements";

import { useEffect, useRef, useState } from "react";

const MENU_WIDTH_PX = 240;
const MENU_GAP_PX = 4;
const VIEWPORT_MARGIN_PX = 8;
const ROW_HEIGHT_PX = 32;

/** One open list: its title and place at its head (none for a first list without a title), and its actions. */
type MenuLevel = { title?: string; subtitle?: string; actions: readonly ContextMenuAction[] };

/** A submenu open beside the list before it, with the row of that list it opened from. */
type OpenedLevel = { level: MenuLevel; row: number };

/** Where a list stands on screen: its left edge and top. */
type MenuSpot = { left: number; top: number };

/**
 * The one renderer of the UI store's context menu: a list at the pointer, and each submenu opened beside the list it
 * came from, its row lit, as a desktop's menus open, so nothing leads back (the owner's pick A, 2 November 2026).
 * Closed by Escape, an outside pointer-down, or a selection. Scenes only ever write the store.
 */
export const ContextMenu = () => {
  const menu = useUIStore((state) => state.contextMenu);
  const close = useUIStore((state) => state.closeContextMenu);
  // The submenus open beside this menu, kept with the menu they belong to, so another menu opens with none.
  const [held, setHeld] = useState<{ menu: typeof menu; opened: OpenedLevel[] }>({ menu, opened: [] });
  const opened = held.menu === menu ? held.opened : [];
  const menus = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menus.current && event.target instanceof Node && menus.current.contains(event.target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, menu]);

  if (!menu) return null;
  const levels: MenuLevel[] = [menu, ...opened.map(({ level }) => level)];
  const spots = menuSpots(menu.position, levels, opened);

  const select = (depth: number, row: number, action: ContextMenuAction) => {
    if (action.disabled) return;
    if (action.children?.length) {
      const level = {
        title: action.childTitle ?? action.label,
        subtitle: action.childSubtitle,
        actions: action.children,
      };
      setHeld({ menu, opened: [...opened.slice(0, depth), { level, row }] });
      return;
    }
    close();
    action.onSelect();
  };

  return (
    <div ref={menus} onContextMenu={(event) => event.preventDefault()}>
      {levels.map((level, depth) => (
        <div
          key={depth}
          className="pointer-events-auto fixed z-hud-menu"
          style={{ ...spots[depth], width: MENU_WIDTH_PX }}
        >
          <HudMenu
            aria-label={level.title ?? "Actions"}
            head={level.title ? { title: level.title, place: level.subtitle } : undefined}
            items={level.actions.map((action, row) => ({
              label: action.label,
              hint: action.hint,
              disabled: action.disabled,
              state: opened[depth]?.row === row ? "hover" : undefined,
              lead:
                action.iconComponent ??
                (action.icon ? <img src={action.icon} alt="" width={16} height={16} /> : undefined),
              onSelect: () => select(depth, row, action),
            }))}
          />
        </div>
      ))}
    </div>
  );
};

/**
 * Each list's spot: the first at the pointer, each submenu beside the list it opened from, level with the row that
 * opened it, at the right where the screen has room and else at the left; every one kept inside the screen.
 */
const menuSpots = (pointer: { x: number; y: number }, levels: MenuLevel[], opened: OpenedLevel[]): MenuSpot[] => {
  const heightOf = (level: MenuLevel) => (level.actions.length + (level.title ? 1 : 0)) * ROW_HEIGHT_PX;
  const inside = (left: number, top: number, level: MenuLevel): MenuSpot => ({
    left: Math.max(VIEWPORT_MARGIN_PX, Math.min(left, window.innerWidth - MENU_WIDTH_PX - VIEWPORT_MARGIN_PX)),
    top: Math.max(VIEWPORT_MARGIN_PX, Math.min(top, window.innerHeight - heightOf(level) - VIEWPORT_MARGIN_PX)),
  });
  const spots = [inside(pointer.x, pointer.y, levels[0]!)];
  opened.forEach(({ level, row }, index) => {
    const from = spots[index]!;
    const right = from.left + MENU_WIDTH_PX + MENU_GAP_PX;
    const fits = right + MENU_WIDTH_PX + VIEWPORT_MARGIN_PX <= window.innerWidth;
    const rowTop = from.top + ((levels[index]!.title ? 1 : 0) + row) * ROW_HEIGHT_PX;
    spots.push(inside(fits ? right : from.left - MENU_WIDTH_PX - MENU_GAP_PX, rowTop, level));
  });
  return spots;
};
