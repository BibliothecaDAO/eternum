import "./aspect-picker.css";

import { aspects, orders, type AspectId } from "@bibliothecadao/types";

import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { ASPECT_STEP_WORDS } from "@/ui/design-system/kit/words";

/** How many members each Aspect has, as the game counts them; null while the count is being read. */
export type AspectMembers = Readonly<Record<AspectId, number>> | null;

/**
 * Frontier's Aspect step (U12, docs/plans/frontier-season-1.md): four cards, each an Aspect with its four Orders' crests
 * and its members, and one tap joins it. A campaign home picks freely; a held Realm's home plays for its Order's Aspect,
 * so the step shows that one card chosen and asks nothing (`realmOrder`). `joining` is the Aspect being founded into:
 * its card spins and every card waits; `waiting` holds every card while the step reads what the account holds. Aspects and their Orders are the Order catalog's (`aspects`, `orders`).
 */
export function AspectPicker({
  members,
  realmOrder,
  joining,
  waiting = false,
  onJoin,
}: {
  members: AspectMembers;
  realmOrder: number | null;
  joining: AspectId | null;
  waiting?: boolean;
  onJoin: (aspect: AspectId) => void;
}) {
  const realm = realmOrder === null ? null : orderOf(realmOrder);
  const fixed = realm === null ? null : aspectOfOrder(realm.orderId);
  const title = fixed === null ? ASPECT_STEP_WORDS.title : ASPECT_STEP_WORDS.yours;
  return (
    <section className="aspect-picker" aria-label={title}>
      <header className="aspect-picker__head">
        <h2>{title}</h2>
        <p>
          {realm && fixed !== null
            ? ASPECT_STEP_WORDS.realmsAspect(realm.fullOrderName, aspectName(fixed))
            : ASPECT_STEP_WORDS.line}
        </p>
      </header>
      <ul className="aspect-picker__cards">
        {aspects.map(({ id, name }) => (
          <li key={id}>
            <AspectCard
              aspect={id}
              name={name}
              members={members?.[id] ?? null}
              chosen={fixed === id || joining === id}
              joining={joining === id}
              disabled={waiting || fixed !== null || joining !== null}
              onJoin={() => onJoin(id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

const AspectCard = ({
  aspect,
  name,
  members,
  chosen,
  joining,
  disabled,
  onJoin,
}: {
  aspect: AspectId;
  name: string;
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
    <span className="aspect-picker__crests">
      {orders
        .filter((order) => order.aspect === aspect)
        .map(({ orderId }) => (
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

const aspectName = (aspect: AspectId): string => {
  const entry = aspects.find(({ id }) => id === aspect);
  if (!entry) throw new Error(`Unknown Aspect ${aspect}`);
  return entry.name;
};
