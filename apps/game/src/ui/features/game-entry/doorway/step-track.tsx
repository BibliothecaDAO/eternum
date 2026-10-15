import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { DOORWAY_WORDS } from "@/shell/words";

import type { DoorwayStep, DoorwayView } from "./doorway-view";

const STEP_ICON: Record<DoorwayStep, IconMeaning> = { account: "person", realm: "realm", map: "map", play: "play" };

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
          "flex w-16 flex-col items-center gap-1.5 font-body text-sm font-semibold",
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
          <SemanticIcon name={STEP_ICON[step]} size={28} />
          {state === "done" && (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-kit-sage">
              <SemanticIcon name="check" size={14} />
            </span>
          )}
        </span>
        {DOORWAY_WORDS[step]}
      </li>
    ))}
  </ol>
);
