import { cn } from "@/ui/design-system/atoms/lib/utils";

import { Button } from "./button";
import { type IconCode, KitIcon } from "./kit-icon";
import { LATER } from "./words";

/**
 * A notice: an icon, one line and its verb, with Later when it can be put off. The host places it directly above the
 * foot row. Ember is for what stops play (Offline); anything else is calm.
 */
export const Notice = ({
  icon,
  line,
  verb,
  onVerb,
  loading,
  onLater,
  ember = false,
}: {
  icon: IconCode;
  line: string;
  verb: string;
  onVerb: () => void;
  /** The verb's step word while it runs ("Updating…"). */
  loading?: string;
  onLater?: () => void;
  ember?: boolean;
}) => (
  <div
    role={ember ? "alert" : "status"}
    className={cn(
      "pointer-events-auto flex min-h-12 items-center gap-2 rounded-xl border-2 bg-kit-ground pl-2.5",
      ember ? "border-light-red" : "border-kit-line2",
    )}
  >
    <KitIcon code={icon} size={22} />
    <span className="min-w-0 flex-1 text-[15px] text-kit-cream">{line}</span>
    {onLater && <Button role="outline" word={LATER} onClick={onLater} className="!px-3" />}
    <Button role="outline" word={verb} loading={loading} onClick={onVerb} className="!px-3" />
  </div>
);
