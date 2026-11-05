import "./alerts-popup.css";

import { kindsAtLevel } from "@bibliothecadao/notifications";
import { ASKED_LEVEL, type AlertsPopupAsk, useAlertsPopup } from "@/shell/profile/alerts-ask";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudModalLayer } from "@/ui/design-system/kit/hud-elements";
import { paintingSources } from "@/ui/design-system/kit/paintings";
import { ADD_TO_HOME_SCREEN, ALERTS_POPUP } from "@/ui/design-system/kit/words";

/** The popup that asks for alerts, over the player's own map once `clear` (useAlertsPopup says when it opens). */
export const AlertsPopup = ({ clear }: { clear: boolean }) => {
  const ask = useAlertsPopup(clear);
  return ask && <AlertsPopupCard ask={ask} />;
};

/**
 * The popup's card over the dimmed map: a painting with the bell, what this device would get (the kinds the asked level
 * pushes, from the kinds table), then Not now and the one verb. An iPhone's browser is told to install first. It opens
 * in the HUD's modal layer (HudModalLayer), which holds the keyboard in the card and the screen inert behind it; a
 * press beside it, Escape and the system back are its Not now.
 */
export const AlertsPopupCard = ({ ask }: { ask: AlertsPopupAsk }) => {
  const install = ask.kind === "install";
  return (
    <HudModalLayer onClose={ask.notNow}>
      <section className="ui-confirm alerts-popup" role="dialog" aria-modal="true" aria-label={ALERTS_POPUP.title}>
        <div className="alerts-popup__art">
          <img {...paintingSources("frontier-mist")} sizes="26rem" alt="" />
          <span className="alerts-popup__medal">
            <Icon name="notifications" size={52} />
          </span>
        </div>
        <div className="ui-confirm__body alerts-popup__body">
          <span className="ui-confirm__question">{ALERTS_POPUP.title}</span>
          <span>{ALERTS_POPUP.brings(kindsAtLevel(ASKED_LEVEL))}</span>
          {install && <span className="alerts-popup__install">{ALERTS_POPUP.install}</span>}
        </div>
        <footer className="ui-window__foot ui-actions">
          <HudButton kind="secondary" onClick={ask.notNow}>
            {ALERTS_POPUP.notNow}
          </HudButton>
          <HudButton kind="primary" icon={install ? "download" : "notifications"} onClick={ask.act}>
            {install ? ADD_TO_HOME_SCREEN : ALERTS_POPUP.turnOn}
          </HudButton>
        </footer>
      </section>
    </HudModalLayer>
  );
};
