import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudSheet, HudSwitch } from "@/ui/design-system/kit/hud-elements";
import { GUIDE } from "@/ui/design-system/kit/words";

type GuideLine = { id: string; line: string };

/**
 * The phone Menu's Guide: its switch, then every line the Aspect has said so far (a desktop reads both in Settings).
 */
export const GuideLinesSheet = ({
  on,
  lines,
  onToggle,
  onClose,
}: {
  on: boolean;
  lines: readonly GuideLine[];
  onToggle: () => void;
  onClose: () => void;
}) => (
  <HudSheet label={GUIDE} onClose={onClose}>
    <span className="flex items-center gap-2">
      <SemanticIcon name="guide" size={22} />
      <span className="flex-1 text-hud-label">{GUIDE}</span>
      <HudSwitch on={on} label={GUIDE} onChange={onToggle} />
    </span>
    <GuideSaid lines={lines} />
  </HudSheet>
);

/**
 * Every line the Aspect has said so far, in the order of its script, to read again. A line is a sentence, as the guide
 * said it; nothing here is new.
 */
export const GuideSaid = ({ lines }: { lines: readonly GuideLine[] }) => (
  <ol className="flex flex-col">
    {lines.map(({ id, line }) => (
      <li key={id} className="border-t border-hud-divider px-1 py-2.5 text-hud-body">
        {line}
      </li>
    ))}
  </ol>
);
