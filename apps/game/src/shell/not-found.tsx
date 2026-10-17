import { Button } from "@/ui/design-system/kit/button";
import { StateCard } from "@/ui/design-system/kit/state-card";

import { useLayout } from "./frame/layout";
import { PageFrame } from "./frame/page-frame";
import { StepVerb } from "./frame/step-verb";
import { APP_STATE_WORDS, WORDS } from "./words";

/**
 * A page that does not exist, also drawn inside a page whose subject does not exist (a post, a player): on a phone the
 * storm above the line, on desktop one plate with Play on Enter.
 */
export const NothingHere = () =>
  useLayout() === "phone" ? (
    <StateCard painting="stormy" image="lg" sizes="100vw">
      <p className="font-body text-lg font-bold text-kit-cream">{APP_STATE_WORDS.nothingHere}</p>
      <Button role="primary" word={WORDS.play} icon="play" to="/" />
    </StateCard>
  ) : (
    <div className="flex justify-center">
      <section className="plate flex w-dialog flex-col items-stretch gap-5 p-6">
        <p className="text-center font-display text-[34px] leading-none text-kit-cream">
          {APP_STATE_WORDS.nothingHere}
        </p>
        <StepVerb>
          <Button role="primary" word={WORDS.play} icon="play" to="/" />
        </StepVerb>
      </section>
    </div>
  );

/** The app's own 404: the storm across the desktop window behind the plate. */
export const NotFoundPage = () => (
  <PageFrame painting="stormy" stage>
    <NothingHere />
  </PageFrame>
);
