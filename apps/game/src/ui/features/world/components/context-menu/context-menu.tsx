import { useUIStore } from "@/hooks/store/use-ui-store";
import type { ContextMenuAction } from "@/types/context-menu";
import { HudMenu } from "@/ui/design-system/kit/hud-elements";

import { useEffect, useRef } from "react";

const MENU_WIDTH_PX = 240;
const VIEWPORT_MARGIN_PX = 8;
const ROW_HEIGHT_PX = 32;

/**
 * The one renderer of the UI store's context menu: a list at the pointer, submenus through the store's stack,
 * closed by Escape, an outside pointer-down, or a selection. Scenes only ever write the store.
 */
export const ContextMenu = () => {
  const menu = useUIStore((state) => state.contextMenu);
  const stack = useUIStore((state) => state.contextMenuStack);
  const close = useUIStore((state) => state.closeContextMenu);
  const push = useUIStore((state) => state.pushContextMenu);
  const pop = useUIStore((state) => state.popContextMenu);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (panel.current && event.target instanceof Node && panel.current.contains(event.target)) return;
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
  const height = (menu.actions.length + 1) * ROW_HEIGHT_PX;
  const left = Math.max(
    VIEWPORT_MARGIN_PX,
    Math.min(menu.position.x, window.innerWidth - MENU_WIDTH_PX - VIEWPORT_MARGIN_PX),
  );
  const top = Math.max(VIEWPORT_MARGIN_PX, Math.min(menu.position.y, window.innerHeight - height - VIEWPORT_MARGIN_PX));

  const select = (action: ContextMenuAction) => {
    if (action.disabled) return;
    if (action.children?.length) {
      push({
        ...menu,
        id: action.id,
        title: action.childTitle ?? action.label,
        subtitle: action.childSubtitle,
        actions: action.children,
      });
      return;
    }
    close();
    action.onSelect();
  };

  return (
    <div
      onContextMenu={(event) => event.preventDefault()}
      className="pointer-events-auto fixed z-hud-menu"
      style={{ left, top, width: MENU_WIDTH_PX }}
    >
      <HudMenu
        ref={panel}
        aria-label={menu.title ?? "Actions"}
        head={
          menu.title || stack.length > 0
            ? { title: menu.title ?? "", place: menu.subtitle, onBack: stack.length > 0 ? pop : undefined }
            : undefined
        }
        items={menu.actions.map((action) => ({
          label: action.label,
          hint: action.hint,
          disabled: action.disabled,
          opens: Boolean(action.children?.length),
          lead:
            action.iconComponent ?? (action.icon ? <img src={action.icon} alt="" width={16} height={16} /> : undefined),
          onSelect: () => select(action),
        }))}
      />
    </div>
  );
};
