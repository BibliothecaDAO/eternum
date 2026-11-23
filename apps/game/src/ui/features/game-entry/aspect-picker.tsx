import "./aspect-picker.css";

import {
  aspectName,
  aspects,
  catalogAspectId,
  catalogOrder,
  orderAspect,
  ordersOfAspect,
  type AspectId,
} from "@bibliothecadao/types";
import type { JoinedShare } from "@realms-world/identity";

import { AppAspectCard, AppAspectGrid } from "@/ui/design-system/kit/aspect-card";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { ASPECT_STEP_WORDS, PRESEASON_WORDS } from "@/ui/design-system/kit/words";

/** How many members each Aspect has, as the game counts them; null while the count is being read. */
export type AspectMembers = Readonly<Record<AspectId, number>> | null;

/** The Aspect a friend's link invited the account to, and who sent it (null when the sender has no name yet). */
export type AspectOffer = { aspect: AspectId; sender: string | null };

export const aspectOffer = (
  joined: JoinedShare,
  game: { chainId: string; gameId: number } | null,
): AspectOffer | null => {
  if (joined === null || joined.kind !== "aspect") return null;
  if (joined.chainId !== null && (joined.chainId !== game?.chainId || joined.gameId !== game.gameId)) return null;
  return { aspect: catalogAspectId(joined.moment), sender: joined.name };
};

export function AspectPicker({
  members,
  realmOrder,
  keptOrder,
  chosen,
  joining,
  waiting = false,
  offered,
  onChoose,
  onFound,
}: {
  members: AspectMembers;
  realmOrder: number | null;
  keptOrder: number | null;
  chosen: AspectId | null;
  joining: number | null;
  waiting?: boolean;
  offered: AspectOffer | null;
  onChoose: (aspect: AspectId) => void;
  onFound: (order: number) => void;
}) {
  const realm = realmOrder === null ? null : catalogOrder(realmOrder);
  const kept = realm === null && keptOrder !== null ? catalogOrder(keptOrder) : null;
  const fixedOrder = realm ?? kept;
  const fixed = fixedOrder === null ? null : aspectOfOrder(fixedOrder.orderId);
  const ordersOf = kept === null ? (fixed === null ? chosen : null) : fixed;
  const invite = fixed === null ? offered : null;
  const title = fixed === null ? ASPECT_STEP_WORDS.title : ASPECT_STEP_WORDS.yours;
  const foundingAspect = joining === null ? null : aspectOfOrder(joining);
  return (
    <section className="aspect-picker" aria-label={title}>
      <header className="aspect-picker__head">
        <h2>{title}</h2>
        {invite && (
          <p className="aspect-picker__invited">
            {ASPECT_STEP_WORDS.invitedTo(invite.sender, aspectName(invite.aspect))}
          </p>
        )}
        <p>
          {realm && fixed !== null
            ? ASPECT_STEP_WORDS.realmsAspect(realm.fullOrderName, aspectName(fixed))
            : kept && fixed !== null
              ? ASPECT_STEP_WORDS.keptAspect(aspectName(fixed))
              : ASPECT_STEP_WORDS.line}
        </p>
      </header>
      <AppAspectGrid>
        {invitedFirst(invite).map(({ id, name }) => {
          const isJoining = foundingAspect === id;
          const memberCount = members?.[id] ?? null;
          return (
            <li key={id}>
              <AppAspectCard
                aspect={id}
                name={name}
                invited={invite?.aspect === id ? ASPECT_STEP_WORDS.invited : undefined}
                chosen={(fixed ?? chosen) === id}
                busy={isJoining}
                disabled={waiting || fixed !== null || joining !== null}
                label={isJoining ? ASPECT_STEP_WORDS.joining(name) : ASPECT_STEP_WORDS.join(name)}
                onClick={() => onChoose(id)}
              >
                {memberCount !== null && (
                  <span className="aspect-picker__members">{ASPECT_STEP_WORDS.members(memberCount)}</span>
                )}
              </AppAspectCard>
            </li>
          );
        })}
      </AppAspectGrid>
      {ordersOf !== null && (
        <OrderChoices aspect={ordersOf} joining={joining} disabled={waiting || joining !== null} onFound={onFound} />
      )}
    </section>
  );
}

const OrderChoices = ({
  aspect,
  joining,
  disabled,
  onFound,
}: {
  aspect: AspectId;
  joining: number | null;
  disabled: boolean;
  onFound: (order: number) => void;
}) => (
  <section className="aspect-picker__orders" aria-label={PRESEASON_WORDS.orderTitle}>
    <header className="aspect-picker__head">
      <h2>{PRESEASON_WORDS.orderTitle}</h2>
      <p>{PRESEASON_WORDS.orderLine(aspectName(aspect))}</p>
    </header>
    <ul className="aspect-picker__cards">
      {ordersOfAspect(aspect).map(({ orderId, fullOrderName }) => (
        <li key={orderId}>
          <button
            type="button"
            className="aspect-picker__order"
            data-order={orderId}
            data-chosen={joining === orderId || undefined}
            aria-busy={joining === orderId || undefined}
            aria-label={
              joining === orderId ? ASPECT_STEP_WORDS.foundingAs(fullOrderName) : PRESEASON_WORDS.playAs(fullOrderName)
            }
            disabled={disabled}
            onClick={() => onFound(orderId)}
          >
            <OrderEmblem order={orderId} size={48} />
            <span className="aspect-picker__members">{fullOrderName}</span>
            {joining === orderId && <span className="ui-spinner" aria-hidden="true" />}
          </button>
        </li>
      ))}
    </ul>
  </section>
);

/** The catalog's Aspects, the invited one first; the catalog's order otherwise. */
export const invitedFirst = (invite: AspectOffer | null) =>
  invite === null
    ? aspects
    : [...aspects.filter(({ id }) => id === invite.aspect), ...aspects.filter(({ id }) => id !== invite.aspect)];

export const aspectOfOrder = (orderId: number): AspectId => {
  const aspect = orderAspect(orderId);
  if (aspect === null) throw new Error(`Order ${orderId} belongs to no Aspect`);
  return aspect;
};
