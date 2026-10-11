import { cn } from "@/ui/design-system/atoms/lib/utils";

/** An on-off setting at a row's end. */
export const Switch = ({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={onToggle}
    className={cn(
      "relative h-8 w-14 shrink-0 rounded-full border-2 transition-colors",
      on ? "border-kit-gold bg-kit-gold" : "border-kit-line2 bg-kit-plate2",
    )}
  >
    <span
      className={cn(
        "absolute top-0.5 size-6 rounded-full bg-kit-cream transition-[left]",
        on ? "left-[26px]" : "left-0.5",
      )}
    />
  </button>
);
