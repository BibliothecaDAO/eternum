import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ASPECT_REWARD,
  aspectName,
  aspects,
  formatDate,
  formatExact,
  formatShort,
  orders,
  ordersOfAspect,
  type AspectId,
} from "@bibliothecadao/types";
import type { OrderIntent } from "@realms-world/identity";

import { identityClient, useIdentitySession } from "@/hooks/context/identity-session";
import { Icon } from "@/ui/design-system/icon";
import { AppButton } from "@/ui/design-system/kit/app-elements";
import { AppCountdownChip } from "@/ui/design-system/kit/clock-chip";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { ASPECT_STEP_WORDS, PRESEASON_WORDS } from "@/ui/design-system/kit/words";

import { StageFrame } from "../frame/stage-frame";
import { Loading } from "../loading";
import type { SeasonOpening } from "../season";

const orderIntentKey = (owner: string | null) => ["orderIntent", owner] as const;

export const PreseasonPlay = ({ opening, now }: { opening: SeasonOpening; now: number }) => {
  const owner = useIdentitySession().session?.user.realmsId ?? null;
  const intent = useQuery({ queryKey: orderIntentKey(owner), queryFn: () => identityClient.getOrderIntent() });
  if (intent.isError)
    return (
      <StageFrame>
        <ServiceFailure service="season" error={intent.error} retry={() => void intent.refetch()} />
      </StageFrame>
    );
  if (!intent.data)
    return (
      <StageFrame>
        <Loading />
      </StageFrame>
    );
  if (intent.data.order !== null) return <SeasonWaiting order={intent.data.order} opening={opening} now={now} />;
  return <OrderPick owner={owner} members={intent.data.members} aspectLords={opening.aspectLords} />;
};

const OrderPick = ({
  owner,
  members,
  aspectLords,
}: {
  owner: string | null;
  members: OrderIntent["members"];
  aspectLords: number | null;
}) => {
  const [aspect, setAspect] = useState<AspectId | null>(null);
  const [order, setOrder] = useState<number | null>(null);
  const client = useQueryClient();
  const choose = useMutation({
    mutationFn: (chosen: number) => identityClient.chooseOrder(chosen),
    onSuccess: (saved) => client.setQueryData(orderIntentKey(owner), saved),
  });
  const chosen = orders.find((each) => each.orderId === order && each.aspect === aspect);
  const pickAspect = (picked: AspectId) => {
    setAspect(picked);
    setOrder(null);
  };
  return (
    <StageFrame
      notice={
        choose.isError && chosen ? (
          <ServiceFailure service="season" error={choose.error} retry={() => choose.mutate(chosen.orderId)} />
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
      <div data-preseason-step="pick" className="flex w-full flex-col gap-4">
        <h1 className="text-app-title text-app-ink">{ASPECT_STEP_WORDS.title}</h1>
        <p className="text-app-body text-app-muted">{ASPECT_STEP_WORDS.line}</p>
        <AspectCards chosen={aspect} members={members} aspectLords={aspectLords} onPick={pickAspect} />
        {aspect !== null && <OrderRows aspect={aspect} chosen={order} members={members} onPick={setOrder} />}
        {aspectLords !== null && (
          <p className="app-well flex items-start gap-2 p-3 text-left text-app-label text-app-muted">
            <Icon name="lords" size={24} />
            {PRESEASON_WORDS.shared(formatExact(aspectLords), formatExact(ASPECT_REWARD.finishBonus))}
          </p>
        )}
      </div>
    </StageFrame>
  );
};

const aspectMembers = (members: OrderIntent["members"], aspect: AspectId) =>
  ordersOfAspect(aspect).reduce((sum, { orderId }) => sum + (members[orderId] ?? 0), 0);

const AspectCards = ({
  chosen,
  members,
  aspectLords,
  onPick,
}: {
  chosen: AspectId | null;
  members: OrderIntent["members"];
  aspectLords: number | null;
  onPick: (aspect: AspectId) => void;
}) => (
  <ul className="grid grid-cols-2 gap-3">
    {aspects.map(({ id, name }) => {
      const count = aspectMembers(members, id);
      return (
        <li key={id}>
          <button
            type="button"
            data-aspect={name}
            aria-pressed={chosen === id}
            onClick={() => onPick(id)}
            className="app-choice w-full"
          >
            <span className="grid grid-cols-2 gap-1">
              {ordersOfAspect(id).map(({ orderId }) => (
                <OrderEmblem key={orderId} order={orderId} size={32} />
              ))}
            </span>
            <span className="text-app-heading text-app-ink">{name}</span>
            <span className="text-app-label text-app-muted">{ASPECT_STEP_WORDS.members(count)}</span>
            {aspectLords !== null && (
              <>
                <span className="text-app-strong text-app-gold">
                  {PRESEASON_WORDS.average(formatShort(aspectLords / (count + 1)))}
                </span>
                <span className="text-app-label text-app-muted">
                  {PRESEASON_WORDS.ofTotal(formatShort(aspectLords))}
                </span>
              </>
            )}
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
    <ul className="flex flex-col gap-2">
      {ordersOfAspect(aspect).map(({ orderId, fullOrderName }) => (
        <li key={orderId}>
          <button
            type="button"
            data-order={fullOrderName}
            aria-pressed={chosen === orderId}
            onClick={() => onPick(orderId)}
            className="app-choice w-full"
          >
            <span className="flex w-full items-center gap-3 text-left">
              <OrderEmblem order={orderId} size={40} />
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

const SeasonWaiting = ({ order, opening, now }: { order: number; opening: SeasonOpening; now: number }) => {
  const chosen = orders.find(({ orderId }) => orderId === order);
  if (!chosen?.aspect) throw new Error(`No Aspect's Order ${order}`);
  return (
    <StageFrame>
      <div data-preseason-step="waiting" className="flex flex-col items-center gap-4">
        <span className="grid grid-cols-2 gap-2">
          {ordersOfAspect(chosen.aspect).map(({ orderId }) => (
            <OrderEmblem key={orderId} order={orderId} size={48} />
          ))}
        </span>
        <h1 className="text-app-title text-app-ink">{PRESEASON_WORDS.youreIn(aspectName(chosen.aspect))}</h1>
        <p className="text-app-body text-app-muted">
          {PRESEASON_WORDS.waiting(chosen.fullOrderName, formatDate(opening.startsAt, now))}
        </p>
        <AppCountdownChip prefix="starts" at={opening.startsAt} now={now} />
      </div>
    </StageFrame>
  );
};
