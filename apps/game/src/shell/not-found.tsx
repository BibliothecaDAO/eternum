import { PageFrame } from "./frame/page-frame";
import { paintingSources } from "./paintings";
import { GoButton } from "./play/go-button";
import { APP_STATE_WORDS, WORDS } from "./words";

/** A page that does not exist, also drawn inside a page whose subject does not exist (a post, a player). */
export const NothingHere = () => (
  <section className="flex flex-col gap-3 plate p-3.5">
    <img
      {...paintingSources("stormy")}
      sizes="(min-width: 1024px) 34rem, 100vw"
      alt=""
      className="h-44 w-full rounded-xl object-cover"
    />
    <p className="font-ui text-[19px] font-bold text-kit-cream">{APP_STATE_WORDS.nothingHere}</p>
    <GoButton role="primary" word={WORDS.play} icon="Pl" to="/" />
  </section>
);

export const NotFoundPage = () => (
  <PageFrame>
    <NothingHere />
  </PageFrame>
);
