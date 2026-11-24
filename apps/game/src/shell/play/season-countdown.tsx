import "./play-page.css";

import { aspectName, aspects, formatAmount, orders, ordersOfAspect, type AspectId } from "@bibliothecadao/types";
import { IdentityRequestError, type OrderIntent } from "@realms-world/identity";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState, type CSSProperties, type ReactNode } from "react";

import { identityClient } from "@/hooks/context/identity-session";
import { aspectVariables } from "@/tokens";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { AGE_LOCKUP, orderMeaning } from "@/ui/design-system/icon-meaning";
import { AppButton, AppChip, AppNotice, AppPanel } from "@/ui/design-system/kit/app-elements";
import { AppClockChip, countdownLine } from "@/ui/design-system/kit/clock-chip";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import {
  ASPECT_STEP_WORDS,
  COUNTDOWN_WORDS,
  PRESEASON_WORDS,
  PROFILE_WORDS,
  SEASON_INVITE_WORDS,
  TRY_AGAIN,
  WORDS,
  countdownParts,
  formatUtcOpening,
  type CountdownParts,
} from "@/ui/design-system/kit/words";
import { aspectOffer, invitedFirst, type AspectOffer } from "@/ui/features/game-entry/aspect-picker";

import { ShellWindow } from "../frame/shell-window";
import { StageFrame } from "../frame/stage-frame";
import { Loading } from "../loading";
import { seasonTitle, type SeasonOpening } from "../season";
import { useJoinedShare } from "../share/own-shares";
import { useRequestSignIn } from "../sign-in/connect";
import { ageOf } from "./ages";
import { orderIntentKey, useOrderIntent } from "./order-intent";
import type { PlayItem } from "./play-board";
import { ItemVerbButton, RehearsalCard } from "./play-item";
import { SealCodeCard } from "./seal-code-card";
import { CopySeasonInvite, SeasonInviteAlerts, useSeasonInvite } from "./season-invite";

type ChosenOrder = { orderId: number; orderName: string; fullOrderName: string; aspect: AspectId };

const COUNTDOWN_UNITS: readonly { key: keyof CountdownParts; label: string }[] = [
  { key: "days", label: COUNTDOWN_WORDS.units.days },
  { key: "hours", label: COUNTDOWN_WORDS.units.hours },
  { key: "minutes", label: COUNTDOWN_WORDS.units.minutes },
  { key: "seconds", label: COUNTDOWN_WORDS.units.seconds },
];

export const SeasonCountdown = ({
  opening,
  rehearsals,
  signedIn,
  now,
}: {
  opening: SeasonOpening;
  rehearsals: readonly PlayItem[];
  signedIn: boolean;
  now: number;
}) => {
  const requestSignIn = useRequestSignIn();
  const { owner, intent } = useOrderIntent();
  const joined = useJoinedShare();
  const [pickingAspect, setPickingAspect] = useState<AspectId | null>(null);

  const featuredRehearsal = rehearsals.find((item) => item.game.status === "Live") ?? rehearsals[0] ?? null;
  const otherRehearsals = featuredRehearsal ? rehearsals.filter((item) => item.key !== featuredRehearsal.key) : [];
  const members = signedIn && intent.data ? intent.data.members : null;
  const chosenOrder = signedIn && intent.data?.order != null ? aspectOrderOf(intent.data.order) : null;
  const offered = signedIn && joined.status === "ready" ? aspectOffer(joined.joined, null) : null;
  const retryInvite = signedIn && joined.status === "failed" ? joined.retry : null;

  const handlePickAspect = (aspect: AspectId) => {
    if (!signedIn) {
      requestSignIn();
      return;
    }
    if (members === null) return;
    setPickingAspect(aspect);
  };

  return (
    <StageFrame wide>
      <div data-season-countdown className="preseason-grid">
        <CountdownHero opening={opening} rehearsal={featuredRehearsal} signedIn={signedIn} now={now} />
        <div className="preseason-side">
          <AspectAndInviteCard
            signedIn={signedIn}
            intentLoading={signedIn && !intent.data && !intent.isError}
            members={members}
            chosenOrder={chosenOrder}
            offered={offered}
            intentError={signedIn && intent.isError ? intent.error : null}
            retryIntent={() => void intent.refetch()}
            retryInvite={retryInvite}
            onPickAspect={handlePickAspect}
          />
          {signedIn && (
            <AppPanel>
              <SealCodeCard owner={owner} compact />
            </AppPanel>
          )}
          {otherRehearsals.map((item) => (
            <RehearsalCard key={item.key} item={item} now={now} signedIn={signedIn} />
          ))}
        </div>
      </div>
      {signedIn && pickingAspect !== null && members !== null && (
        <OrderPickWindow
          key={pickingAspect}
          owner={owner}
          aspect={pickingAspect}
          currentOrder={chosenOrder?.aspect === pickingAspect ? chosenOrder.orderId : null}
          members={members}
          onClose={() => setPickingAspect(null)}
        />
      )}
    </StageFrame>
  );
};

const CountdownHero = ({
  opening,
  rehearsal,
  signedIn,
  now,
}: {
  opening: SeasonOpening;
  rehearsal: PlayItem | null;
  signedIn: boolean;
  now: number;
}) => (
  <section className="preseason-hero">
    <div className="preseason-hero__brand">
      <img src={AGE_LOCKUP.frontier} alt={ageOf("frontier").name} className="preseason-hero__lockup" />
      <AppChip icon="calendar" tone="gold">
        {COUNTDOWN_WORDS.opens(formatUtcOpening(opening.startsAt, now))}
      </AppChip>
      <h1 className="preseason-hero__title">{COUNTDOWN_WORDS.title}</h1>
    </div>
    <CountdownClock startsAt={opening.startsAt} now={now} />
    <p className="preseason-hero__line text-app-body text-app-muted">
      {COUNTDOWN_WORDS.line(aspects.length, opening.seasonDays)}
    </p>
    {rehearsal !== null ? (
      <RehearsalCallout item={rehearsal} signedIn={signedIn} now={now} />
    ) : (
      !signedIn && <CreateAccount />
    )}
  </section>
);

const CountdownClock = ({ startsAt, now }: { startsAt: number; now: number }) => {
  const parts = countdownParts(startsAt - now);
  return (
    <div className="countdown-clock" role="timer" aria-label={countdownLine("starts", startsAt, now)}>
      {COUNTDOWN_UNITS.map(({ key, label }, index) => (
        <Fragment key={key}>
          {index > 0 && (
            <span className="countdown-clock__sep" aria-hidden="true">
              :
            </span>
          )}
          <div className="countdown-clock__box" data-countdown-unit={key}>
            <span className="countdown-clock__value">{parts[key]}</span>
            <span className="countdown-clock__unit">{label}</span>
          </div>
        </Fragment>
      ))}
    </div>
  );
};

const RehearsalCallout = ({ item, signedIn, now }: { item: PlayItem; signedIn: boolean; now: number }) => {
  const name = seasonTitle(item.game);
  const isLive = item.game.status === "Live";
  return (
    <div data-preseason-testnet data-play-item={item.key} className="preseason-testnet">
      <div className="preseason-testnet__head">
        {isLive ? (
          <AppChip tone="good" live>
            {COUNTDOWN_WORDS.rehearsalLive(name)}
          </AppChip>
        ) : (
          <AppClockChip prefix="starts" at={item.game.clock.start_main_at} now={now} />
        )}
        <p className="text-app-body text-app-ink">
          {isLive ? COUNTDOWN_WORDS.rehearsalLine(name) : COUNTDOWN_WORDS.rehearsalOpeningLine(name)}
        </p>
      </div>
      <div className="preseason-testnet__actions">
        <ItemVerbButton item={item} signedIn={signedIn} lead rehearsal />
        {!signedIn && !item.game.error && <span className="text-app-label text-app-muted">{COUNTDOWN_WORDS.free}</span>}
      </div>
    </div>
  );
};

const AspectAndInviteCard = ({
  signedIn,
  intentLoading,
  members,
  chosenOrder,
  offered,
  intentError,
  retryIntent,
  retryInvite,
  onPickAspect,
}: {
  signedIn: boolean;
  intentLoading: boolean;
  members: OrderIntent["members"] | null;
  chosenOrder: ChosenOrder | null;
  offered: AspectOffer | null;
  intentError: unknown;
  retryIntent: () => void;
  retryInvite: (() => void) | null;
  onPickAspect: (aspect: AspectId) => void;
}) => (
  <AppPanel title={PRESEASON_WORDS.aspectTitle} icon="crown">
    <div className="preseason-card-body">
      <p className="text-app-label text-app-muted">{PRESEASON_WORDS.optionalLine}</p>
      {intentError !== null ? (
        <ServiceFailure service="season" error={intentError} retry={retryIntent} />
      ) : intentLoading ? (
        <Loading />
      ) : (
        <>
          {retryInvite !== null && (
            <AppNotice
              tone="warn"
              line={ASPECT_STEP_WORDS.inviteUnread}
              actions={
                <AppButton kind="secondary" onClick={retryInvite}>
                  {TRY_AGAIN}
                </AppButton>
              }
            />
          )}
          <ul className="preseason-aspects">
            {invitedFirst(offered).map(({ id, name }) => {
              const isJoined = chosenOrder?.aspect === id;
              return (
                <li key={id} style={aspectVariables(id) as CSSProperties}>
                  <button
                    type="button"
                    data-aspect={name}
                    data-aspect-id={id}
                    aria-pressed={isJoined}
                    className="app-choice preseason-aspect-tile"
                    onClick={() => onPickAspect(id)}
                  >
                    <span className="preseason-aspect-tile__head">
                      <AspectMark aspect={id} size={32} decorative />
                      <span className="preseason-aspect-tile__name">{name}</span>
                      {isJoined && (
                        <span data-aspect-joined className="preseason-aspect-tile__joined">
                          {PRESEASON_WORDS.joined}
                        </span>
                      )}
                    </span>
                    {offered?.aspect === id && (
                      <span data-aspect-invited className="preseason-aspect-tile__invited">
                        {ASPECT_STEP_WORDS.invitedBy(offered.sender)}
                      </span>
                    )}
                    <span className="preseason-aspect-tile__foot">
                      {isJoined ? (
                        <span data-chosen-order className="preseason-aspect-tile__order">
                          <OrderEmblem order={chosenOrder.orderId} size={18} />
                          <span>{chosenOrder.fullOrderName}</span>
                        </span>
                      ) : (
                        <span className="preseason-aspect-tile__orders">
                          {ordersOfAspect(id).map(({ orderId }) => (
                            <Icon key={orderId} name={orderMeaning(orderId)} size={18} />
                          ))}
                        </span>
                      )}
                      {members !== null && (
                        <span className="preseason-aspect-tile__members">
                          <Icon name="person" size={14} />
                          {formatAmount(aspectMembers(members, id))}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <PreseasonInviteStrip signedIn={signedIn} aspect={chosenOrder?.aspect ?? null} />
        </>
      )}
    </div>
  </AppPanel>
);

const InviteStripFrame = ({ rewardLine, children }: { rewardLine: string; children: ReactNode }) => (
  <div data-season-invite className="preseason-invite-strip">
    <div className="preseason-invite-strip__head">
      <span className="preseason-invite-strip__title">
        <Icon name="people" size={20} />
        <span className="text-app-strong text-app-ink">{SEASON_INVITE_WORDS.title}</span>
      </span>
      <span className="text-app-label text-app-gold">{rewardLine}</span>
    </div>
    {children}
  </div>
);

const PreseasonInviteStrip = ({ signedIn, aspect }: { signedIn: boolean; aspect: AspectId | null }) => {
  const requestSignIn = useRequestSignIn();
  const rewardLine = PROFILE_WORDS.friendReward;
  if (signedIn && aspect !== null) return <SignedInAspectInvite rewardLine={rewardLine} />;
  return (
    <InviteStripFrame rewardLine={rewardLine}>
      <div className="preseason-invite-strip__row">
        <p className="text-app-label text-app-muted">
          {signedIn ? PRESEASON_WORDS.invitePickPrompt : PRESEASON_WORDS.inviteSignedOut}
        </p>
        {!signedIn && (
          <AppButton kind="secondary" size="md" onClick={() => requestSignIn()}>
            {WORDS.signIn}
          </AppButton>
        )}
      </div>
    </InviteStripFrame>
  );
};

const SignedInAspectInvite = ({ rewardLine }: { rewardLine: string }) => {
  const invite = useSeasonInvite();
  if (invite.link.none) return null;
  return (
    <InviteStripFrame rewardLine={rewardLine}>
      <div className="preseason-invite-strip__row">
        {invite.aspect !== null && (
          <p className="text-app-label text-app-ink">{SEASON_INVITE_WORDS.line(aspectName(invite.aspect))}</p>
        )}
        <CopySeasonInvite invite={invite} size="md" />
      </div>
      <SeasonInviteAlerts invite={invite} />
    </InviteStripFrame>
  );
};

const OrderPickWindow = ({
  owner,
  aspect,
  currentOrder,
  members,
  onClose,
}: {
  owner: string | null;
  aspect: AspectId;
  currentOrder: number | null;
  members: OrderIntent["members"];
  onClose: () => void;
}) => {
  const [selectedOrder, setSelectedOrder] = useState<number | null>(currentOrder);
  const client = useQueryClient();
  const choose = useMutation({
    mutationFn: (orderId: number) => identityClient.chooseOrder(orderId),
    onSuccess: (saved) => {
      client.setQueryData(orderIntentKey(owner), saved);
      onClose();
    },
    onError: (error) => {
      if (isAspectAlreadyChosen(error)) {
        void client.invalidateQueries({ queryKey: orderIntentKey(owner) });
        onClose();
      }
    },
  });
  const chosen = orders.find((each) => each.orderId === selectedOrder && each.aspect === aspect);

  return (
    <ShellWindow
      title={PRESEASON_WORDS.orderTitle}
      onClose={() => {
        choose.reset();
        onClose();
      }}
    >
      <div className="flex flex-col gap-4">
        <OrderRows aspect={aspect} chosen={selectedOrder} members={members} onPick={setSelectedOrder} />
        {choose.isError && chosen && (
          <ServiceFailure service="season" error={choose.error} retry={() => choose.mutate(chosen.orderId)} />
        )}
        <AppButton
          kind="primary"
          size="lg"
          className="w-full"
          disabled={chosen === undefined || choose.isPending}
          onClick={() => chosen && choose.mutate(chosen.orderId)}
        >
          {chosen ? PRESEASON_WORDS.playAs(chosen.orderName) : PRESEASON_WORDS.pick}
        </AppButton>
      </div>
    </ShellWindow>
  );
};

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
  <section className="preseason-orders" aria-label={PRESEASON_WORDS.orderTitle}>
    <p className="text-app-label text-app-muted">{PRESEASON_WORDS.orderLine(aspectName(aspect))}</p>
    <ul className="grid grid-cols-2 gap-2.5">
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

const isAspectAlreadyChosen = (error: unknown) =>
  error instanceof IdentityRequestError && error.status === 409 && error.code === "aspect_chosen";

const aspectMembers = (members: OrderIntent["members"], aspect: AspectId) =>
  ordersOfAspect(aspect).reduce((sum, { orderId }) => sum + (members[orderId] ?? 0), 0);

const aspectOrderOf = (orderId: number): ChosenOrder | null => {
  const found = orders.find((each) => each.orderId === orderId);
  if (!found?.aspect) return null;
  return {
    orderId: found.orderId,
    orderName: found.orderName,
    fullOrderName: found.fullOrderName,
    aspect: found.aspect,
  };
};
