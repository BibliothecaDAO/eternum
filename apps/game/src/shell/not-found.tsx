import { APP_STATE_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { AppButton, AppPanel } from "@/ui/design-system/kit/app-elements";
import { Button } from "@/ui/design-system/kit/button";
import { StateCard } from "@/ui/design-system/kit/state-card";

import { useLayout } from "./frame/layout";
import { PageFrame } from "./frame/page-frame";

/**
 * A page that does not exist, also drawn inside a page whose subject does not exist (a post, a player): on a phone the
 * storm above the line, on desktop the app sheet's panel on the storm, with Play on Enter.
 */
export const NothingHere = () =>
  useLayout() === "phone" ? (
    <StateCard painting="stormy" image="lg" sizes="100vw">
      <p className="font-body text-lg font-bold text-kit-cream">{APP_STATE_WORDS.nothingHere}</p>
      <Button role="primary" word={WORDS.play} icon="play" to="/" />
    </StateCard>
  ) : (
    <div className="flex justify-center">
      <AppPanel className="w-dialog">
        <div className="flex flex-col items-stretch gap-5 text-center">
          <p className="text-app-title text-app-ink">{APP_STATE_WORDS.nothingHere}</p>
          <AppButton kind="primary" size="lg" icon="play" to="/" step>
            {WORDS.play}
          </AppButton>
        </div>
      </AppPanel>
    </div>
  );

/** The app's own 404: the storm across the desktop window behind the plate. */
export const NotFoundPage = () => (
  <PageFrame painting="stormy" stage>
    <NothingHere />
  </PageFrame>
);
