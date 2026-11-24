import { HudNotice } from "@/ui/design-system/kit/hud-elements";
import { DAY_END } from "@/ui/design-system/kit/words";

export const DayEndBlock = () => (
  <section aria-label={DAY_END.goes} className="flex flex-col gap-1">
    <HudNotice tone="warn" icon="hourglass" line={DAY_END.goes} />
  </section>
);
