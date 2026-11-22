import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ASPECT_REWARD,
  aspectName,
  formatDate,
  formatExact,
  formatShort,
  orders,
  ordersOfAspect,
  type AspectId,
} from "@bibliothecadao/types";
import { IdentityRequestError, type OrderIntent } from "@realms-world/identity";

import { identityClient } from "@/hooks/context/identity-session";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { aspectArtUrl } from "@/ui/design-system/icon-meaning";
import { AppButton, AppNotice } from "@/ui/design-system/kit/app-elements";
import { AppCountdownChip } from "@/ui/design-system/kit/clock-chip";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { ASPECT_STEP_WORDS, PRESEASON_WORDS, TRY_AGAIN } from "@/ui/design-system/kit/words";
import { aspectOffer, invitedFirst, type AspectOffer } from "@/ui/features/game-entry/aspect-picker";

import { StageFrame } from "../frame/stage-frame";
import { Loading } from "../loading";
import { SealCodeCard } from "./seal-code-card";
import { CopySeasonInvite, SeasonInviteCard, useSeasonInvite } from "./season-invite";
import type { SeasonOpening } from "../season";
import { orderIntentKey, useOrderIntent } from "./order-intent";
import { useJoinedShare } from "../share/own-shares";

export const PreseasonPlay = ({ opening, now }: { opening: SeasonOpening; now: number }) => {
  const { owner, intent } = useOrderIntent();
  const joined = useJoinedShare();
  if (intent.isError)
    return (
      <StageFrame>
        <ServiceFailure service="season" error={intent.error} retry={() => void intent.refetch()} />
      </StageFrame>
    );
  if (!intent.data || joined.status === "loading")
    return (
      <StageFrame>
        <Loading />
      </StageFrame>
    );
  if (intent.data.order !== null)
    return <SeasonWaiting owner={owner} order={intent.data.order} opening={opening} now={now} />;
  return (
    <OrderPick
      owner={owner}
      members={intent.data.members}
      aspectLords={opening.aspectLords}
      offered={joined.status === "ready" ? aspectOffer(joined.joined, null) : null}
      retryInvite={joined.status === "failed" ? joined.retry : null}
    />
  );
};

const OrderPick = ({
  owner,
  members,
  aspectLords,
  offered,
  retryInvite,
}: {
  owner: string | null;
  members: OrderIntent["members"];
  aspectLords: number | null;
  offered: AspectOffer | null;
  retryInvite: (() => void) | null;
}) => {
  const [aspect, setAspect] = useState<AspectId | null>(offered?.aspect ?? null);
  const [order, setOrder] = useState<number | null>(null);
  const client = useQueryClient();
  const choose = useMutation({
    mutationFn: (chosen: number) => identityClient.chooseOrder(chosen),
    onSuccess: (saved) => client.setQueryData(orderIntentKey(owner), saved),
    onError: (error) => {
      if (isAspectAlreadyChosen(error)) void client.invalidateQueries({ queryKey: orderIntentKey(owner) });
    },
  });
  const chosen = orders.find((each) => each.orderId === order && each.aspect === aspect);
  const pickAspect = (picked: AspectId) => {
    setAspect(picked);
    setOrder(null);
  };
  return (
    <StageFrame
      wide
      notice={
        choose.isError && chosen ? (
          <ServiceFailure service="season" error={choose.error} retry={() => choose.mutate(chosen.orderId)} />
        ) : retryInvite ? (
          <AppNotice
            tone="warn"
            line={ASPECT_STEP_WORDS.inviteUnread}
            actions={
              <AppButton kind="secondary" onClick={retryInvite}>
                {TRY_AGAIN}
              </AppButton>
            }
          />
        ) : undefined
      }
      verb={
        <AppButton
          kind="primary"
          size="lg"
          step
          disabled={chosen === undefined || choose.isPending}
          onClick={() => chosen && choose.mutate(chosen.orderId)}
        >
          {chosen ? PRESEASON_WORDS.playAs(chosen.orderName) : PRESEASON_WORDS.pick}
        </AppButton>
      }
    >
      <div data-preseason-step="pick" className="flex w-full flex-col gap-3">
        <h1 className="text-app-title text-app-ink">{ASPECT_STEP_WORDS.title}</h1>
        <p className="text-app-body text-app-muted">{ASPECT_STEP_WORDS.line}</p>
        <AspectCards
          chosen={aspect}
          members={members}
          aspectLords={aspectLords}
          offered={offered}
          onPick={pickAspect}
        />
        {aspectLords !== null && (
          <p className="app-well p-3 text-left text-app-label text-app-muted">
            <span className="flex items-start gap-2">
              <Icon name="crown" size={24} />
              <span data-aspect-shared>
                {PRESEASON_WORDS.shared(formatExact(aspectLords), formatExact(ASPECT_REWARD.finishBonus))}
              </span>
            </span>
          </p>
        )}
        {aspect !== null && <OrderRows aspect={aspect} chosen={order} members={members} onPick={setOrder} />}
      </div>
    </StageFrame>
  );
};

const isAspectAlreadyChosen = (error: unknown) =>
  error instanceof IdentityRequestError && error.status === 409 && error.code === "aspect_chosen";

const aspectMembers = (members: OrderIntent["members"], aspect: AspectId) =>
  ordersOfAspect(aspect).reduce((sum, { orderId }) => sum + (members[orderId] ?? 0), 0);

const AspectCards = ({
  chosen,
  members,
  aspectLords,
  offered,
  onPick,
}: {
  chosen: AspectId | null;
  members: OrderIntent["members"];
  aspectLords: number | null;
  offered: AspectOffer | null;
  onPick: (aspect: AspectId) => void;
}) => (
  <ul className="app-aspect-grid">
    {invitedFirst(offered).map(({ id, name }) => {
      const count = aspectMembers(members, id);
      return (
        <li key={id}>
          <button
            type="button"
            data-aspect={name}
            data-aspect-id={id}
            aria-pressed={chosen === id}
            onClick={() => onPick(id)}
            className="app-aspect-card"
          >
            <img src={aspectArtUrl(id, "card")} alt="" aria-hidden className="app-aspect-card__art" />
            {offered?.aspect === id && (
              <span data-aspect-invited className="app-choice__tag">
                {ASPECT_STEP_WORDS.invitedBy(offered.sender)}
              </span>
            )}
            <span className="app-aspect-card__body">
              <span className="app-aspect-card__name">{name}</span>
              <span className="app-aspect-card__orders">
                {ordersOfAspect(id).map(({ orderId }) => (
                  <OrderEmblem key={orderId} order={orderId} size={28} />
                ))}
              </span>
              <span className="app-aspect-card__meta">
                <span className="text-app-label text-app-muted">{ASPECT_STEP_WORDS.members(count)}</span>
                {aspectLords !== null && (
                  <span className="flex flex-col">
                    <span className="text-app-strong text-app-gold">
                      {PRESEASON_WORDS.average(formatShort(aspectLords / (count + 1)))}
                    </span>
                    <span className="text-app-label text-app-muted">
                      {PRESEASON_WORDS.ofTotal(formatShort(aspectLords))}
                    </span>
                  </span>
                )}
              </span>
            </span>
          </button>
        </li>
      );
    })}
  </ul>
);

const OrderRows = ({
  aspect,
  chosen,
  members,
  onPick,
}: {
  aspect: AspectId;
  chosen: number | null;
  members: OrderIntent["members"];
  onPick: (order: number) => void;
}) => (
  <section className="flex flex-col gap-2" aria-label={PRESEASON_WORDS.orderTitle}>
    <h2 className="text-app-heading text-app-ink">{PRESEASON_WORDS.orderTitle}</h2>
    <p className="text-app-label text-app-muted">{PRESEASON_WORDS.orderLine(aspectName(aspect))}</p>
    <ul className="app-aspect-orders">
      {ordersOfAspect(aspect).map(({ orderId, fullOrderName }) => (
        <li key={orderId}>
          <button
            type="button"
            data-order={fullOrderName}
            aria-pressed={chosen === orderId}
            onClick={() => onPick(orderId)}
            className="app-choice w-full"
          >
            <span className="flex w-full flex-col items-center gap-2 text-center">
              <OrderEmblem order={orderId} size={48} />
              <span className="flex flex-col">
                <span className="text-app-heading text-app-ink">{fullOrderName}</span>
                <span className="text-app-label text-app-muted">
                  {ASPECT_STEP_WORDS.members(members[orderId] ?? 0)}
                </span>
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  </section>
);

const SeasonWaiting = ({
  owner,
  order,
  opening,
  now,
}: {
  owner: string | null;
  order: number;
  opening: SeasonOpening;
  now: number;
}) => {
  const chosen = aspectOrder(order);
  const invite = useSeasonInvite(chosen.aspect);
  return (
    <StageFrame verb={<CopySeasonInvite invite={invite} />}>
      <div data-preseason-step="waiting" className="flex w-full flex-col items-center gap-4">
        <AspectMark aspect={chosen.aspect} size={88} decorative />
        <h1 className="text-app-title text-app-ink">{PRESEASON_WORDS.youreIn(aspectName(chosen.aspect))}</h1>
        <p className="text-app-body text-app-muted">
          {PRESEASON_WORDS.waiting(chosen.fullOrderName, formatDate(opening.startsAt, now))}
        </p>
        <AppCountdownChip prefix="starts" at={opening.startsAt} now={now} />
        <SealCodeCard owner={owner} />
        <SeasonInviteCard invite={invite} />
      </div>
    </StageFrame>
  );
};

const aspectOrder = (order: number) => {
  const chosen = orders.find(({ orderId }) => orderId === order);
  if (!chosen?.aspect) throw new Error(`No Aspect's Order ${order}`);
  return { ...chosen, aspect: chosen.aspect };
};
