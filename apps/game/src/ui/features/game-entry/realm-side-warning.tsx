import { canonicalRealm } from "@bibliothecadao/eternum";
import { aspectName, type AspectId } from "@bibliothecadao/types";

import { Icon } from "@/ui/design-system/icon";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { REALM_SIDE_WORDS } from "@/ui/design-system/kit/words";

import { aspectOfOrder, type AspectOffer } from "./aspect-picker";

export type SeasonSide = { kind: "kept"; order: number } | { kind: "invited"; offer: AspectOffer };

export const sideAspect = (side: SeasonSide): AspectId =>
  side.kind === "kept" ? aspectOfOrder(side.order) : side.offer.aspect;

export const seasonSide = (keptOrder: number | null, offered: AspectOffer | null): SeasonSide | null => {
  if (keptOrder !== null) return { kind: "kept", order: keptOrder };
  return offered === null ? null : { kind: "invited", offer: offered };
};

export const isRealmElsewhere = (side: SeasonSide | null, realmOrder: number | null): side is SeasonSide =>
  side !== null && realmOrder !== null && sideAspect(side) !== aspectOfOrder(realmOrder);

export const RealmSideWarning = ({
  side,
  realmId,
  onPlayRealm,
  onJoinFree,
}: {
  side: SeasonSide;
  realmId: number;
  onPlayRealm: () => void;
  onJoinFree: () => void;
}) => {
  const realm = canonicalRealm(realmId);
  const aspect = aspectName(sideAspect(side));
  const realms = aspectName(aspectOfOrder(realm.order));
  return (
    <section data-realm-side-warning className="flex w-full flex-col items-center gap-4 text-center">
      <Icon name="warning" size={64} />
      <h2 className="frontier-title">
        {side.kind === "kept"
          ? REALM_SIDE_WORDS.kept(aspect, realms)
          : REALM_SIDE_WORDS.invited(side.offer.sender, aspect, realms)}
      </h2>
      <div className="frontier-card flex w-full items-center gap-3 p-3 text-left">
        <OrderEmblem order={realm.order} size={48} />
        <span className="flex flex-col">
          <span className="frontier-title">{realm.name}</span>
          <span>{REALM_SIDE_WORDS.bonus}</span>
        </span>
      </div>
      <button type="button" className="frontier-primary w-full" onClick={onPlayRealm}>
        {REALM_SIDE_WORDS.playRealm}
      </button>
      <p>
        {side.kind === "kept"
          ? REALM_SIDE_WORDS.keeps
          : `${REALM_SIDE_WORDS.keeps} ${REALM_SIDE_WORDS.apart(side.offer.sender)}`}
      </p>
      <HudButton kind="secondary" onClick={onJoinFree}>
        {REALM_SIDE_WORDS.joinFree(aspect)}
      </HudButton>
      <p>{REALM_SIDE_WORDS.loses}</p>
    </section>
  );
};
