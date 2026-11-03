import type { DayAsk } from "@/shell/profile/alerts-ask";
import { HudActions, HudButton, HudNotice, HudWindowFoot } from "@/ui/design-system/kit/hud-elements";
import { ADD_TO_HOME_SCREEN, ALERTS_ASK, REMIND_ME, TURNING_ALERTS_ON } from "@/ui/design-system/kit/words";

/**
 * The game day's ask to turn alerts on (useDayAsk): one line of what the push brings (an iPhone's browser is told to
 * install first), then the tap. After the claim it is the sheet's verb, in the sheet's foot so it stays in view while
 * the body scrolls, with its own Not now; on the day's summary it stays secondary to Continue, which passes it by.
 */
export const AlertsAskCard = ({
  dayAsk,
  says,
  verb,
}: {
  dayAsk: DayAsk;
  /** Its line, for this device and for an iPhone's browser. */
  says: { remind: string; install: string };
  verb: "turn-on" | "remind";
}) => {
  const { ask, notNow } = dayAsk;
  const install = ask.kind === "install";
  // The way out first and the verb last, as every row of buttons stands.
  const buttons = (
    <>
      {verb === "turn-on" && (
        <HudButton kind="secondary" onClick={notNow}>
          {ALERTS_ASK.notNow}
        </HudButton>
      )}
      <HudButton
        kind={verb === "turn-on" ? "primary" : "secondary"}
        icon={install ? "download" : "notifications"}
        busy={ask.busy ? TURNING_ALERTS_ON : undefined}
        onClick={ask.act}
      >
        {install ? ADD_TO_HOME_SCREEN : verb === "turn-on" ? ALERTS_ASK.turnOn : REMIND_ME}
      </HudButton>
    </>
  );
  return (
    <>
      <HudNotice icon="notifications" line={install ? says.install : says.remind} />
      {verb === "turn-on" ? <HudWindowFoot>{buttons}</HudWindowFoot> : <HudActions>{buttons}</HudActions>}
    </>
  );
};
