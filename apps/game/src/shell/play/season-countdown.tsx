import { aspects, formatLongDate, ordersOfAspect } from "@bibliothecadao/types";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { AGE_LOCKUP, orderMeaning } from "@/ui/design-system/icon-meaning";
import { AppButton } from "@/ui/design-system/kit/app-elements";
import { AppCountdownChip } from "@/ui/design-system/kit/clock-chip";
import { COUNTDOWN_WORDS } from "@/ui/design-system/kit/words";

import { StageFrame } from "../frame/stage-frame";
import { ageOf } from "./ages";
import type { SeasonOpening } from "../season";
import { useRequestSignIn } from "../sign-in/connect";

export const SeasonCountdown = ({ opening, now }: { opening: SeasonOpening; now: number }) => (
  <StageFrame wide verb={<CreateAccount />}>
    <div data-season-countdown className="flex flex-col items-center gap-5 text-center">
      <img src={AGE_LOCKUP.frontier} alt={ageOf("frontier").name} className="h-28 w-auto" />
      <h1 className="text-app-display text-app-ink">{COUNTDOWN_WORDS.opens(formatLongDate(opening.startsAt, now))}</h1>
      <AppCountdownChip prefix="starts" at={opening.startsAt} now={now} />
      <p className="text-app-body text-app-muted">{COUNTDOWN_WORDS.line(aspects.length, opening.seasonDays)}</p>
      <AspectCrests />
    </div>
  </StageFrame>
);

const AspectCrests = () => (
  <ul className="app-countdown-aspects">
    {aspects.map(({ id, name }) => (
      <li key={id} data-aspect={name} data-aspect-id={id} className="app-countdown-aspect">
        <AspectMark aspect={id} size={72} decorative />
        <span className="app-countdown-aspect__name">{name}</span>
        <span className="flex items-center justify-center gap-1.5">
          {ordersOfAspect(id).map(({ orderId }) => (
            <Icon key={orderId} name={orderMeaning(orderId)} size={22} />
          ))}
        </span>
      </li>
    ))}
  </ul>
);

export const CreateAccount = () => {
  const requestSignIn = useRequestSignIn();
  return (
    <div className="flex flex-col items-center gap-2">
      <AppButton kind="primary" size="lg" icon="play" step onClick={() => requestSignIn()}>
        {COUNTDOWN_WORDS.create}
      </AppButton>
      <span className="text-app-label text-app-muted">{COUNTDOWN_WORDS.free}</span>
    </div>
  );
};
