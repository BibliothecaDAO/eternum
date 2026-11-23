import "./not-found.css";

import { APP_STATE_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { Icon } from "@/ui/design-system/icon";
import { AppButton, AppPanel } from "@/ui/design-system/kit/app-elements";

import { PageFrame } from "./frame/page-frame";

export const NothingHere = () => (
  <div className="state-card-stage" data-state-card="not-found">
    <AppPanel className="w-full max-w-dialog">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-16 place-items-center rounded-full border border-app-line-strong bg-app-well">
          <Icon name="warning" size={40} />
        </span>
        <h1 className="text-app-title text-app-gold">{APP_STATE_WORDS.nothingHere}</h1>
        <p className="text-app-body text-app-muted">This trail leads into the mist. Return to Play to continue.</p>
        <AppButton kind="primary" size="lg" icon="play" to="/" step className="mt-1 w-full">
          {WORDS.play}
        </AppButton>
      </div>
    </AppPanel>
  </div>
);

export const NotFoundPage = () => (
  <PageFrame painting="stormy" stage>
    <NothingHere />
  </PageFrame>
);
