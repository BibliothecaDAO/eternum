import "./play-page.css";

import { aspects, formatDuration, formatLongDate, ordersOfAspect } from "@bibliothecadao/types";
import type { CSSProperties } from "react";

import { aspectVariables } from "@/tokens";
import { aspectCardUrl } from "@/ui/design-system/domain-icon-meaning";
import { Icon } from "@/ui/design-system/icon";
import { AGE_LOCKUP, orderMeaning } from "@/ui/design-system/icon-meaning";
import { AppButton } from "@/ui/design-system/kit/app-elements";
import { AppCountdownChip } from "@/ui/design-system/kit/clock-chip";
import { COUNTDOWN_WORDS } from "@/ui/design-system/kit/words";

import { StageFrame } from "../frame/stage-frame";
import type { SeasonOpening } from "../season";
import { useRequestSignIn } from "../sign-in/connect";
import { ageOf } from "./ages";

export const SeasonCountdown = ({ opening, now }: { opening: SeasonOpening; now: number }) => (
  <StageFrame wide verb={<CreateAccount />}>
    <div data-season-countdown className="countdown-stage">
      <div className="countdown-stage__head">
        <div className="countdown-stage__hero">
          <img src={AGE_LOCKUP.frontier} alt={ageOf("frontier").name} className="countdown-stage__lockup" />
          <p className="countdown-stage__clock" aria-hidden="true">
            {formatDuration(Math.max(0, opening.startsAt - now))}
          </p>
        </div>
        <div className="countdown-stage__meta">
          <h1 className="countdown-stage__title">{COUNTDOWN_WORDS.opens(formatLongDate(opening.startsAt, now))}</h1>
          <AppCountdownChip prefix="starts" at={opening.startsAt} now={now} />
          <p className="text-app-body text-app-muted">{COUNTDOWN_WORDS.line(aspects.length, opening.seasonDays)}</p>
        </div>
      </div>
      <AspectCrests />
    </div>
  </StageFrame>
);

const AspectCrests = () => (
  <ul className="countdown-aspects">
    {aspects.map(({ id, name }) => (
      <li
        key={id}
        data-aspect={name}
        data-aspect-id={id}
        style={aspectVariables(id) as CSSProperties}
        className="countdown-aspect"
      >
        <img src={aspectCardUrl(id)} alt="" aria-hidden className="countdown-aspect__art" />
        <div className="countdown-aspect__foot">
          <span className="countdown-aspect__name">{name}</span>
          <span className="flex items-center justify-center gap-1.5">
            {ordersOfAspect(id).map(({ orderId }) => (
              <Icon key={orderId} name={orderMeaning(orderId)} size={22} />
            ))}
          </span>
        </div>
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
