import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";

type View<Id extends string> = { id: Id; word: string; icon?: IconMeaning };

/**
 * A switch between views of one list, set directly above the list it switches; the lit view is the one shown. Joined,
 * one bar of segments (a list's filter, Season's boards); split, a button per view (Play's modes), each of which can
 * carry the peach dot for a view the player holds something in. A switch that changes what a page is about takes tab
 * semantics; one that filters a list, radio.
 */
export const ViewSwitch = <Id extends string>({
  label,
  views,
  lit,
  onChange,
  variant = "joined",
  semantics = "radio",
  marked = [],
  markWord,
}: {
  label: string;
  views: View<Id>[];
  /** The view shown; none is lit while the value is unknown or is none of the views. */
  lit: Id | undefined;
  onChange: (id: Id) => void;
  variant?: "joined" | "split";
  semantics?: "radio" | "tab";
  /** The views that hold something of the player's, dotted while unlit (split only). */
  marked?: readonly Id[];
  /** The dot's name for a screen reader. */
  markWord?: string;
}) => {
  const tab = semantics === "tab";
  return (
    <div
      role={tab ? "tablist" : "radiogroup"}
      aria-label={label}
      className={
        variant === "joined"
          ? "flex h-12 shrink-0 overflow-hidden rounded-control border border-kit-line bg-kit-ground"
          : "flex gap-2"
      }
    >
      {views.map((view) => {
        const on = view.id === lit;
        return (
          <button
            key={view.id}
            type="button"
            role={tab ? "tab" : "radio"}
            aria-checked={tab ? undefined : on}
            aria-selected={tab ? on : undefined}
            // A tab reports every press: pressing the shown tab pins it, so Play keeps the mode the player chose when
            // the board's default mode moves.
            onClick={() => (tab || !on) && onChange(view.id)}
            className={
              variant === "joined"
                ? cn(
                    "flex min-w-0 flex-1 items-center justify-center gap-1.5 font-ui text-base font-semibold transition-colors",
                    on ? "bg-kit-line2 text-kit-gold2" : "text-kit-muted hover:text-kit-cream",
                  )
                : cn(
                    "relative min-h-12 flex-1 rounded-control border px-3 font-ui text-base font-bold text-kit-cream",
                    on ? "border-kit-gold bg-kit-plate2" : "border-kit-line2 bg-kit-plate hover:border-kit-gold",
                  )
            }
          >
            {view.icon && <SemanticIcon name={view.icon} size={20} />}
            {variant === "joined" ? <span className="truncate">{view.word}</span> : view.word}
            {variant === "split" && !on && marked.includes(view.id) && (
              <span aria-label={markWord} className="absolute right-2.5 top-2 size-2.5 rounded-full bg-kit-peach" />
            )}
          </button>
        );
      })}
    </div>
  );
};
