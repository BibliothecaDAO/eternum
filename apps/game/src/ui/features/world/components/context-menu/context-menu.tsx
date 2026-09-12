import { useUIStore } from "@/hooks/store/use-ui-store";
import type { ContextMenuAction } from "@/types/context-menu";
import { HUD_BODY, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";
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
      ref={panel}
      role="menu"
      aria-label={menu.title ?? "Actions"}
      onContextMenu={(event) => event.preventDefault()}
      className={cn("pointer-events-auto fixed z-[140] rounded-xl p-1 text-gold", OVERLAY_SURFACE_BASE)}
      style={{ left, top, width: MENU_WIDTH_PX }}
    >
      {(menu.title || stack.length > 0) && (
        <div className="flex items-center gap-2 border-b border-gold/15 px-2 py-1.5">
          {stack.length > 0 && (
            <button type="button" aria-label="Back" onClick={pop} className="text-gold/70 hover:text-gold">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
          <span className={cn("min-w-0 flex-1 truncate", HUD_LABEL)}>{menu.title}</span>
          {menu.subtitle && <span className="shrink-0 text-[10px] text-gold/50">{menu.subtitle}</span>}
        </div>
      )}
      <div className="flex flex-col py-1">
        {menu.actions.map((action) => (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            disabled={action.disabled}
            title={action.hint}
            onClick={() => select(action)}
            className={cn(
              "flex h-8 items-center gap-2 rounded-md px-2 text-left font-sans normal-case tracking-normal",
              HUD_BODY,
              action.disabled ? "opacity-45" : "hover:bg-gold/10",
            )}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              {action.iconComponent ??
                (action.icon ? <img src={action.icon} alt="" className="h-4 w-4 object-contain" /> : null)}
            </span>
            <span className="min-w-0 flex-1 truncate">{action.label}</span>
            {action.children?.length ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gold/50" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
};
