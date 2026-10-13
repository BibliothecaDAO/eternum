import { Switch } from "@/shell/profile/switch";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { Sheet } from "@/ui/design-system/kit/sheet";
import { GUIDE } from "@/ui/design-system/kit/words";

/**
 * The Menu's Guide: its switch, then every line the Aspect has said so far, in the order of its script, to read again.
 * A line is a sentence, as the guide said it; nothing here is new.
 */
export const GuideLinesSheet = ({
  on,
  lines,
  onToggle,
  onClose,
}: {
  on: boolean;
  lines: readonly { id: string; line: string }[];
  onToggle: () => void;
  onClose: () => void;
}) => (
  <Sheet label={GUIDE} onClose={onClose}>
    <header className="flex h-12 shrink-0 items-center gap-2 lg:pr-10">
      <KitIcon code="Gd" size={22} />
      <h2 className="frontier-title flex-1 !text-[20px]">{GUIDE}</h2>
      <Switch on={on} label={GUIDE} onToggle={onToggle} />
    </header>
    <ol className="flex flex-col">
      {lines.map(({ id, line }) => (
        <li key={id} className="border-t border-kit-line px-1 py-2.5 text-[15px] leading-snug text-kit-cream">
          {line}
        </li>
      ))}
    </ol>
  </Sheet>
);
