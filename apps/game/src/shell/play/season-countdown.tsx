import { aspects, formatDate, ordersOfAspect } from "@bibliothecadao/types";

import { AGE_LOCKUP } from "@/ui/design-system/icon-meaning";
import { AppButton } from "@/ui/design-system/kit/app-elements";
import { AppCountdownChip } from "@/ui/design-system/kit/clock-chip";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { COUNTDOWN_WORDS } from "@/ui/design-system/kit/words";

import { StageFrame } from "../frame/stage-frame";
import { ageOf } from "./ages";
import type { SeasonOpening } from "../season";
import { useRequestSignIn } from "../sign-in/connect";

export const SeasonCountdown = ({ opening, now }: { opening: SeasonOpening; now: number }) => (
  <StageFrame verb={<CreateAccount />}>
    <div data-season-countdown className="flex flex-col items-center gap-5">
      <img src={AGE_LOCKUP.frontier} alt={ageOf("frontier").name} className="h-28 w-auto" />
      <h1 className="text-app-title text-app-ink">{COUNTDOWN_WORDS.opens(formatDate(opening.startsAt, now))}</h1>
      <AppCountdownChip prefix="starts" at={opening.startsAt} now={now} />
      <p className="text-app-body text-app-muted">{COUNTDOWN_WORDS.line(aspects.length, opening.seasonDays)}</p>
      <AspectCrests />
    </div>
  </StageFrame>
);

const AspectCrests = () => (
  <ul className="grid w-full grid-cols-4 gap-2">
    {aspects.map(({ id, name }) => (
      <li key={id} data-aspect={name} className="flex flex-col items-center gap-1">
        <span className="grid grid-cols-2 gap-1">
          {ordersOfAspect(id).map(({ orderId }) => (
            <OrderEmblem key={orderId} order={orderId} size={32} />
          ))}
        </span>
        <span className="text-app-label text-app-ink">{name}</span>
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
