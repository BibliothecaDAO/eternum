import "./play-page.css";

import { aspects, formatLongDate, ordersOfAspect } from "@bibliothecadao/types";
import type { CSSProperties } from "react";

import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { AGE_LOCKUP, orderMeaning } from "@/ui/design-system/icon-meaning";
import { AppButton } from "@/ui/design-system/kit/app-elements";
import { AppCountdownChip } from "@/ui/design-system/kit/clock-chip";
import { COUNTDOWN_WORDS } from "@/ui/design-system/kit/words";

import { StageFrame } from "../frame/stage-frame";
import type { SeasonOpening } from "../season";
import { useRequestSignIn } from "../sign-in/connect";
import { ageOf } from "./ages";

export const formatCountdownClock = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  const days = Math.floor(safe / 86_400);
  const hours = Math.floor((safe % 86_400) / 3_600);
  const minutes = Math.floor((safe % 3_600) / 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(days)}D : ${pad(hours)}H : ${pad(minutes)}M`;
};

export const SeasonCountdown = ({ opening, now }: { opening: SeasonOpening; now: number }) => (
  <StageFrame wide verb={<CreateAccount />}>
    <div data-season-countdown className="countdown-stage">
      <div className="countdown-stage__head">
        <div className="countdown-stage__hero">
          <img src={AGE_LOCKUP.frontier} alt={ageOf("frontier").name} className="countdown-stage__lockup" />
          <p className="countdown-stage__clock" aria-hidden="true">
            {formatCountdownClock(opening.startsAt - now)}
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
        <AspectMark aspect={id} size={84} decorative />
        <span className="countdown-aspect__name">{name}</span>
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
