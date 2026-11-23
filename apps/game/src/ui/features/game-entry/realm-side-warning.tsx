import "./home-source-picker.css";

import { canonicalRealm } from "@bibliothecadao/eternum";
import { aspectName, type AspectId } from "@bibliothecadao/types";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { AppButton } from "@/ui/design-system/kit/app-elements";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { REALM_SIDE_WORDS } from "@/ui/design-system/kit/words";

import { aspectOfOrder, type AspectOffer } from "./aspect-picker";

type SeasonSide = { kind: "kept"; order: number } | { kind: "invited"; offer: AspectOffer };

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
  const chosenAspect = sideAspect(side);
  const realmAspect = aspectOfOrder(realm.order);
  const aspect = aspectName(chosenAspect);
  const realms = aspectName(realmAspect);
  return (
    <section data-realm-side-warning className="realm-side">
      <div className="flex items-center gap-3">
        <AspectMark aspect={chosenAspect} size={44} decorative />
        <Icon name="warning" size={28} />
        <AspectMark aspect={realmAspect} size={44} decorative />
      </div>
      <h2 className="realm-side__title">
        {side.kind === "kept"
          ? REALM_SIDE_WORDS.kept(aspect, realms)
          : REALM_SIDE_WORDS.invited(side.offer.sender, aspect, realms)}
      </h2>
      <div className="realm-side__card">
        <OrderEmblem order={realm.order} size={44} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="realm-side__name">
            {realm.name} <span className="home-picker__id">{`#${realmId}`}</span>
          </span>
          <span className="realm-side__note">{REALM_SIDE_WORDS.bonus}</span>
        </span>
        <AspectMark aspect={realmAspect} size={32} decorative />
      </div>
      <AppButton kind="primary" size="lg" icon="realm" step className="w-full" onClick={onPlayRealm}>
        {REALM_SIDE_WORDS.playRealm}
      </AppButton>
      <p className="realm-side__note">
        {side.kind === "kept"
          ? REALM_SIDE_WORDS.keeps
          : `${REALM_SIDE_WORDS.keeps} ${REALM_SIDE_WORDS.apart(side.offer.sender)}`}
      </p>
      <AppButton kind="secondary" size="lg" className="w-full" onClick={onJoinFree}>
        {REALM_SIDE_WORDS.joinFree(aspect)}
      </AppButton>
      <p className="realm-side__note">{REALM_SIDE_WORDS.loses}</p>
    </section>
  );
};
