import { cn } from "@/ui/design-system/atoms/lib/utils";

import { type IconCode, KitIcon } from "./kit-icon";

type View<Id extends string> = { id: Id; word: string; icon?: IconCode };

/** A switch between views of one list, set directly above the list it switches; the lit view is the one shown. */
export const ViewSwitch = <Id extends string>({
  label,
  views,
  lit,
  onChange,
}: {
  label: string;
  views: View<Id>[];
  lit: Id;
  onChange: (id: Id) => void;
}) => (
  <div
    role="radiogroup"
    aria-label={label}
    className="flex h-12 shrink-0 overflow-hidden rounded-xl border border-[color:var(--frontier-line)] bg-[color:var(--frontier-void)]"
  >
    {views.map((view) => (
      <button
        key={view.id}
        type="button"
        role="radio"
        aria-checked={view.id === lit}
        onClick={() => view.id !== lit && onChange(view.id)}
        className={cn(
          "flex min-w-0 flex-1 items-center justify-center gap-1.5 text-[15px] font-semibold transition-colors",
          view.id === lit
            ? "bg-[color:var(--frontier-line2)] text-[color:var(--frontier-gold2)]"
            : "text-[color:var(--frontier-muted)] hover:text-[color:var(--frontier-parchment)]",
        )}
      >
        {view.icon && <KitIcon code={view.icon} size={20} />}
        <span className="truncate">{view.word}</span>
      </button>
    ))}
  </div>
);
