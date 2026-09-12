import { HUD_PILL_BUTTON } from "@/ui/design-system/atoms/overlay-surface";
import { cn } from "@/ui/design-system/atoms/lib/utils";

interface HudTab<Key extends string> {
  key: Key;
  label: string;
}

/** Pill tabs for desk sub-views; the selected pill is the only gold-filled one. */
export const HudTabStrip = <Key extends string>({
  tabs,
  selected,
  onSelect,
  className,
}: {
  tabs: readonly HudTab<Key>[];
  selected: Key;
  onSelect: (key: Key) => void;
  className?: string;
}) => (
  <div role="tablist" className={cn("flex items-center gap-1", className)}>
    {tabs.map((tab) => {
      const isSelected = tab.key === selected;
      return (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={isSelected}
          onClick={() => onSelect(tab.key)}
          className={cn(HUD_PILL_BUTTON, isSelected ? "border-gold/60 bg-gold/15 text-gold" : "text-gold/65")}
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);
