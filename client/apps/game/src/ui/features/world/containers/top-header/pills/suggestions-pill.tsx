import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_BODY_MUTED, HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_ACTIVE, OVERLAY_SURFACE_HOVER } from "@/ui/design-system/atoms/overlay-surface";
import { TOP_PILL, TOP_PILL_TEXT } from "@/ui/features/world/containers/top-header/top-pill";
import { SuggestionChip } from "@/ui/features/world/containers/left-facets/suggestion-chip";
import { useEmpireSuggestions } from "@/ui/features/world/containers/left-facets/use-empire-suggestions";
import { useSuggestionActions } from "@/ui/features/world/containers/left-facets/use-suggestion-actions";
import Lightbulb from "lucide-react/dist/esm/icons/lightbulb";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DEFAULT_VISIBLE_SUGGESTIONS = 6;
const POPOVER_WIDTH = 360;

/**
 * SuggestionsPill — top-header surface that exposes the empire's Suggested
 * Actions as a single pill + popover. Replaces the in-rail EmpireSuggestions
 * block so the left cockpit reclaims vertical space.
 */
export const SuggestionsPill = memo(() => {
  const suggestions = useEmpireSuggestions();
  const { handleSuggestionClick, pendingRealmId } = useSuggestionActions();

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const count = suggestions.length;
  const hasPrimary = useMemo(() => suggestions.some((s) => s.emphasis === "primary"), [suggestions]);

  const visible = useMemo(
    () => (showAll ? suggestions : suggestions.slice(0, DEFAULT_VISIBLE_SUGGESTIONS)),
    [showAll, suggestions],
  );
  const hiddenCount = Math.max(suggestions.length - DEFAULT_VISIBLE_SUGGESTIONS, 0);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const measure = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      const desiredLeft = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;
      const clampedLeft = Math.max(8, Math.min(desiredLeft, window.innerWidth - POPOVER_WIDTH - 8));
      setPosition({ top: rect.bottom + 8, left: clampedLeft });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (wrapperRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  const onSelectSuggestion = useCallback(
    (suggestion: Parameters<typeof handleSuggestionClick>[0]) => {
      handleSuggestionClick(suggestion);
      setIsOpen(false);
    },
    [handleSuggestionClick],
  );

  if (count === 0) return null;

  return (
    <div ref={wrapperRef} className="relative pointer-events-auto">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={`Suggested actions (${count})`}
        aria-label="Suggested actions"
        className={cn(
          TOP_PILL,
          OVERLAY_SURFACE_HOVER,
          TOP_PILL_TEXT,
          isOpen && OVERLAY_SURFACE_ACTIVE,
          hasPrimary && !isOpen && "ring-1 ring-gold/40 shadow-[0_0_12px_rgba(223,170,84,0.25)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/45",
        )}
      >
        <Lightbulb className={cn("h-4 w-4", hasPrimary ? "text-gold" : "text-gold/70")} />
        <span>{count}</span>
      </button>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed pointer-events-auto"
            style={{ top: position.top, left: position.left, width: POPOVER_WIDTH, zIndex: 60 }}
          >
            <div
              className={cn(
                "rounded-xl p-3",
                "border border-gold/30 bg-gradient-to-b from-[#1a1410]/95 to-[#231a10]/95 shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(223,170,84,0.18)] backdrop-blur-sm",
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-gold/15 pb-2">
                <span className={cn("flex items-center gap-2", HUD_LABEL)}>
                  <Lightbulb className="h-3.5 w-3.5 text-gold" />
                  Suggested actions
                </span>
                <span className="rounded-full border border-gold/25 bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-gold/75 tabular-nums">
                  {count}
                </span>
              </div>

              <div className="flex max-h-[clamp(200px,50vh,480px)] flex-col gap-1.5 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
                {visible.map((suggestion) => (
                  <SuggestionChip
                    key={suggestion.id}
                    suggestion={suggestion}
                    onClick={onSelectSuggestion}
                    isPending={pendingRealmId === suggestion.realmId}
                  />
                ))}
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAll((prev) => !prev)}
                    className={cn(
                      "mt-1 self-center rounded border border-gold/20 bg-black/30 px-2 py-1 transition hover:border-gold/40 hover:text-gold",
                      HUD_LABEL,
                    )}
                  >
                    {showAll ? "Show fewer" : `Show ${hiddenCount} more`}
                  </button>
                )}
              </div>

              {count === 0 && <p className={HUD_BODY_MUTED}>No suggestions right now — empire looks healthy.</p>}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
});

SuggestionsPill.displayName = "SuggestionsPill";
