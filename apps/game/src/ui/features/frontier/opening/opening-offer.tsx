import { HudButton, HudNotice } from "@/ui/design-system/kit/hud-elements";

import type { SiteAlertOffer } from "./use-site-alert-offer";

/** The first Deep entry's offer of the site alert: Turn on, or Not now, and what stood in the way of turning it on. */
export const OpeningOffer = ({ offer }: { offer: SiteAlertOffer }) => (
  <div data-site-alert-offer className="flex flex-col gap-1">
    <HudNotice
      icon="notifications"
      line={offer.line}
      fix={offer.busy ? undefined : { label: offer.accept, onClick: offer.onAccept }}
    />
    {offer.problem && <HudNotice tone="warn" line={offer.problem} />}
    <HudButton kind="quiet" size="sm" disabled={offer.busy} onClick={offer.onDecline}>
      {offer.decline}
    </HudButton>
  </div>
);
