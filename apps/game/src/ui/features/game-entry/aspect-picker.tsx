import "./aspect-picker.css";

import { Aspect, ASPECTS, aspectOfOrder, aspectOrders, orders } from "@bibliothecadao/types";

import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { ASPECT_STEP_WORDS } from "@/ui/design-system/kit/words";

/** How many members each Aspect has, as the game counts them; null while the count is being read. */
export type AspectMembers = Readonly<Record<Aspect, number>> | null;

/**
 * Frontier's Aspect step (U12, docs/plans/frontier-season-1.md): four cards, each an Aspect with its four Orders' crests
 * and its members, and one tap joins it. A campaign home picks freely; a held Realm's home plays for its Order's Aspect,
 * so the step shows that one card chosen and asks nothing (`realmOrder`). `joining` is the Aspect being founded into:
 * its card spins and every card waits.
 */
export function AspectPicker({
  members,
  realmOrder,
  joining,
  onJoin,
}: {
  members: AspectMembers;
  realmOrder: number | null;
  joining: Aspect | null;
  onJoin: (aspect: Aspect) => void;
}) {
  const fixed = realmOrder === null ? null : aspectOfOrder(realmOrder);
  const title = fixed ? ASPECT_STEP_WORDS.yours : ASPECT_STEP_WORDS.title;
  return (
    <section className="aspect-picker" aria-label={title}>
      <header className="aspect-picker__head">
        <h2>{title}</h2>
        <p>
          {fixed && realmOrder !== null
            ? ASPECT_STEP_WORDS.realmsAspect(orderName(realmOrder), fixed)
            : ASPECT_STEP_WORDS.line}
        </p>
      </header>
      <ul className="aspect-picker__cards">
        {ASPECTS.map((aspect) => (
          <li key={aspect}>
            <AspectCard
              aspect={aspect}
              members={members?.[aspect] ?? null}
              chosen={fixed === aspect || joining === aspect}
              joining={joining === aspect}
              disabled={fixed !== null || joining !== null}
              onJoin={() => onJoin(aspect)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

const AspectCard = ({
  aspect,
  members,
  chosen,
  joining,
  disabled,
  onJoin,
}: {
  aspect: Aspect;
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
    aria-label={joining ? ASPECT_STEP_WORDS.joining(aspect) : ASPECT_STEP_WORDS.join(aspect)}
    disabled={disabled}
    onClick={onJoin}
  >
    <span className="aspect-picker__crests">
      {aspectOrders(aspect).map((order) => (
        <OrderEmblem key={order} order={order} size={40} />
      ))}
    </span>
    <span className="aspect-picker__name">{aspect}</span>
    {members !== null && <span className="aspect-picker__members">{ASPECT_STEP_WORDS.members(members)}</span>}
    {joining && <span className="ui-spinner" aria-hidden="true" />}
  </button>
);

const orderName = (order: number): string => {
  const entry = orders.find((candidate) => candidate.orderId === order);
  if (!entry) throw new Error(`Unknown Order ${order}`);
  return entry.fullOrderName;
};
