import "./aspect-picker.css";

import { aspectName, aspects, catalogAspectId, orders, ordersOfAspect, type AspectId } from "@bibliothecadao/types";
import type { JoinedShare } from "@realms-world/identity";

import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { ASPECT_STEP_WORDS, PRESEASON_WORDS } from "@/ui/design-system/kit/words";

/** How many members each Aspect has, as the game counts them; null while the count is being read. */
export type AspectMembers = Readonly<Record<AspectId, number>> | null;

/** The Aspect a friend's link invited the account to, and who sent it (null when the sender has no name yet). */
export type AspectOffer = { aspect: AspectId; sender: string | null };

/**
 * The offer the account's joined link makes at this game's founding: an Aspect invite made for this very chain and game,
 * else none. The link's Aspect is read through the catalog, so one outside it is a fault, not a blank card.
 */
export const aspectOffer = (joined: JoinedShare, game: { chainId: string; gameId: number }): AspectOffer | null => {
  if (joined === null || joined.kind !== "aspect") return null;
  if (joined.chainId !== game.chainId || joined.gameId !== game.gameId) return null;
  return { aspect: catalogAspectId(joined.moment), sender: joined.name };
};

export function AspectPicker({
  members,
  realmOrder,
  chosen,
  joining,
  waiting = false,
  offered,
  onChoose,
  onFound,
}: {
  members: AspectMembers;
  realmOrder: number | null;
  chosen: AspectId | null;
  joining: number | null;
  waiting?: boolean;
  offered: AspectOffer | null;
  onChoose: (aspect: AspectId) => void;
  onFound: (order: number) => void;
}) {
  const realm = realmOrder === null ? null : orderOf(realmOrder);
  const fixed = realm === null ? null : aspectOfOrder(realm.orderId);
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
            : ASPECT_STEP_WORDS.line}
        </p>
      </header>
      <ul className="aspect-picker__cards">
        {invitedFirst(invite).map(({ id, name }) => (
          <li key={id}>
            <AspectCard
              aspect={id}
              name={name}
              invited={invite?.aspect === id}
              members={members?.[id] ?? null}
              chosen={(fixed ?? chosen) === id}
              joining={foundingAspect === id}
              disabled={waiting || fixed !== null || joining !== null}
              onJoin={() => onChoose(id)}
            />
          </li>
        ))}
      </ul>
      {fixed === null && chosen !== null && (
        <OrderChoices aspect={chosen} joining={joining} disabled={waiting || joining !== null} onFound={onFound} />
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
const invitedFirst = (invite: AspectOffer | null) =>
  invite === null
    ? aspects
    : [...aspects.filter(({ id }) => id === invite.aspect), ...aspects.filter(({ id }) => id !== invite.aspect)];

const AspectCard = ({
  aspect,
  name,
  invited,
  members,
  chosen,
  joining,
  disabled,
  onJoin,
}: {
  aspect: AspectId;
  name: string;
  invited: boolean;
  members: number | null;
  chosen: boolean;
  joining: boolean;
  disabled: boolean;
  onJoin: () => void;
}) => (
  <button
    type="button"
    className="aspect-picker__card"
    data-chosen={chosen || undefined}
    aria-busy={joining || undefined}
    aria-label={joining ? ASPECT_STEP_WORDS.joining(name) : ASPECT_STEP_WORDS.join(name)}
    disabled={disabled}
    onClick={onJoin}
  >
    {invited && <span className="aspect-picker__invite">{ASPECT_STEP_WORDS.invited}</span>}
    <span className="aspect-picker__crests">
      {ordersOfAspect(aspect).map(({ orderId }) => (
        <OrderEmblem key={orderId} order={orderId} size={40} />
      ))}
    </span>
    <span className="aspect-picker__name">{name}</span>
    {members !== null && <span className="aspect-picker__members">{ASPECT_STEP_WORDS.members(members)}</span>}
    {joining && <span className="ui-spinner" aria-hidden="true" />}
  </button>
);

const orderOf = (orderId: number) => {
  const order = orders.find((entry) => entry.orderId === orderId);
  if (!order) throw new Error(`Unknown Order ${orderId}`);
  return order;
};

/** A held Realm's Aspect is its Order's; an Order in no Aspect (the Order of Gods) throws. */
export const aspectOfOrder = (orderId: number): AspectId => {
  const aspect = orderOf(orderId).aspect;
  if (aspect === null) throw new Error(`Order ${orderId} belongs to no Aspect`);
  return aspect;
};
