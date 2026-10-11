import { cn } from "@/ui/design-system/atoms/lib/utils";
import { type IconCode, KitIcon } from "@/ui/design-system/kit/kit-icon";
import { DOORWAY_WORDS } from "@/shell/words";

import type { DoorwayStep, DoorwayView } from "./doorway-view";

const STEP_ICON: Record<DoorwayStep, IconCode> = { account: "Pf", realm: "Cs", map: "Mp", play: "Pl" };

/**
 * The doorway's steps (spec 07): each a pictogram and its word, ticked when done, lit while it runs; they continue by
 * themselves.
 */
export const StepTrack = ({ steps }: { steps: DoorwayView["steps"] }) => (
  <ol aria-label={DOORWAY_WORDS.entering} className="flex w-full justify-center gap-3">
    {steps.map(({ step, state }) => (
      <li
        key={step}
        aria-current={state === "running" ? "step" : undefined}
        className={cn(
          "flex w-16 flex-col items-center gap-1.5 font-ui text-[12px] font-semibold",
          state === "waiting" ? "text-kit-muted opacity-60" : "text-kit-cream",
        )}
      >
        <span
          className={cn(
            "relative flex size-14 items-center justify-center rounded-full border-[3px] bg-kit-plate",
            state === "done" && "border-kit-sage",
            state === "running" && "animate-pulse border-kit-peach",
            state === "waiting" && "border-kit-line",
          )}
        >
          <KitIcon code={STEP_ICON[step]} size={28} />
          {state === "done" && (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-kit-sage">
              <KitIcon code="Ok" size={14} />
            </span>
          )}
        </span>
        {DOORWAY_WORDS[step]}
      </li>
    ))}
  </ol>
);
