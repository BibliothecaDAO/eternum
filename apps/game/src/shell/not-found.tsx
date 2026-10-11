import { useLayout } from "./frame/layout";
import { PageFrame } from "./frame/page-frame";
import { StepVerb } from "./frame/step-verb";
import { paintingSources } from "./paintings";
import { GoButton } from "./play/go-button";
import { APP_STATE_WORDS, WORDS } from "./words";

/**
 * A page that does not exist, also drawn inside a page whose subject does not exist (a post, a player): on a phone the
 * storm above the line, on desktop one plate with Play on Enter.
 */
export const NothingHere = () =>
  useLayout() === "phone" ? (
    <section className="flex flex-col gap-3 plate p-3.5">
      <img {...paintingSources("stormy")} sizes="100vw" alt="" className="h-44 w-full rounded-xl object-cover" />
      <p className="font-ui text-[19px] font-bold text-kit-cream">{APP_STATE_WORDS.nothingHere}</p>
      <GoButton role="primary" word={WORDS.play} icon="Pl" to="/" />
    </section>
  ) : (
    <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
      <section className="plate flex w-[30rem] flex-col items-stretch gap-5 p-6">
        <p className="text-center font-display text-[34px] leading-none text-kit-cream">
          {APP_STATE_WORDS.nothingHere}
        </p>
        <StepVerb>
          <GoButton role="primary" word={WORDS.play} icon="Pl" to="/" />
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
