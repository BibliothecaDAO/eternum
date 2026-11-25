import "./cosmetics-page.css";

import { RealmLevels, rankName } from "@bibliothecadao/types";
import { useState } from "react";
import { Navigate } from "react-router-dom";

import {
  REALM_RANKS,
  REALM_SKIN_DEFAULT_ORDER,
  REALM_SKINS,
  realmSkinIcon,
  realmSkinStanding,
  type RealmSkin,
  type RealmSkinFacts,
  type RealmSkinFamily,
  type RealmSkinStanding,
} from "@/three/cosmetics/realm-skins";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { AppButton, AppChip, AppPanel } from "@/ui/design-system/kit/app-elements";
import { COSMETICS_WORDS } from "@/ui/design-system/kit/words";

import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { PROFILE_PATH } from "../profile/settings-route";
import { FRAGMENTS_PATH } from "../shop/fragments-route";
import { useCosmeticStanding } from "./cosmetic-facts";
import { COSMETICS_HASH } from "./cosmetics-route";

const FAMILY_ROWS: readonly (readonly RealmSkinFamily[])[] = [["season-1"], ["devcon", "base", "wonder"]];

const skinsOf = (family: RealmSkinFamily) => REALM_SKINS.filter((skin) => skin.family === family);
const isRank = (level: number | null): level is RealmLevels => REALM_RANKS.some((rank) => rank === level);

const ownedCountOf = (facts: RealmSkinFacts) =>
  REALM_SKINS.filter((skin) => realmSkinStanding(skin, facts) === "owned").length;

const firstOwned = (facts: RealmSkinFacts) =>
  REALM_SKIN_DEFAULT_ORDER.flatMap(skinsOf).find((skin) => realmSkinStanding(skin, facts) === "owned") ??
  REALM_SKINS[0];

export const CosmeticsPage = () => {
  if (useLayout() !== "desktop") return <Navigate to={{ pathname: PROFILE_PATH, hash: COSMETICS_HASH }} replace />;
  return (
    <PageFrame title={COSMETICS_WORDS.title} aside={<AppChip tone="gold">{defaultOrderLine()}</AppChip>}>
      <CosmeticsWorkspace />
    </PageFrame>
  );
};

const defaultOrderLine = () =>
  COSMETICS_WORDS.defaultOrder(REALM_SKIN_DEFAULT_ORDER.map((family) => COSMETICS_WORDS.families[family]));

export const CosmeticsWorkspace = () => {
  const { facts, rank } = useCosmeticStanding();
  const [picked, pick] = useState<RealmSkin>(() => firstOwned(facts));
  const ownedCount = ownedCountOf(facts);
  return (
    <div className="cosmetics" data-cosmetics>
      <div className="cosmetics__categories">
        <AppChip tone="gold">{COSMETICS_WORDS.realms}</AppChip>
        <span className="cosmetics__soon">
          {COSMETICS_WORDS.armies}
          <AppChip>{COSMETICS_WORDS.soon}</AppChip>
        </span>
        <span className="cosmetics__owned">{COSMETICS_WORDS.ownedCount(ownedCount)}</span>
      </div>
      <div className="cosmetics__workspace">
        <SkinPreview skin={picked} facts={facts} rank={isRank(rank) ? rank : null} />
        <div className="cosmetics__families">
          {FAMILY_ROWS.map((row) => (
            <div key={row.join()} className="cosmetics__row" data-families={row.length}>
              {row.map((family) => (
                <FamilyPanel key={family} family={family} facts={facts} picked={picked} onPick={pick} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const FamilyPanel = ({
  family,
  facts,
  picked,
  onPick,
}: {
  family: RealmSkinFamily;
  facts: RealmSkinFacts;
  picked: RealmSkin;
  onPick: (skin: RealmSkin) => void;
}) => {
  const skins = skinsOf(family);
  return (
    <AppPanel title={COSMETICS_WORDS.families[family]} cue={familyCue(family, skins, facts)}>
      <ul className="cosmetics__cards" data-family={family}>
        {skins.map((skin) => (
          <li key={skin.id}>
            <SkinCard skin={skin} standing={realmSkinStanding(skin, facts)} picked={skin === picked} onPick={onPick} />
          </li>
        ))}
      </ul>
    </AppPanel>
  );
};

const familyCue = (family: RealmSkinFamily, skins: readonly RealmSkin[], facts: RealmSkinFacts) => {
  const owned = skins.filter((skin) => realmSkinStanding(skin, facts) === "owned").length;
  if (family === "base") return COSMETICS_WORDS.alwaysOwned;
  if (family === "wonder") return COSMETICS_WORDS.exclusive;
  return family === "season-1"
    ? COSMETICS_WORDS.ownedOfPass(owned, skins.length)
    : COSMETICS_WORDS.ownedOf(owned, skins.length);
};

const SkinCard = ({
  skin,
  standing,
  picked,
  onPick,
}: {
  skin: RealmSkin;
  standing: RealmSkinStanding;
  picked: boolean;
  onPick: (skin: RealmSkin) => void;
}) => (
  <button
    type="button"
    className="app-choice cosmetics__card"
    data-skin={skin.id}
    data-standing={standing}
    aria-pressed={picked}
    onClick={() => onPick(skin)}
  >
    <span className="cosmetics__art">
      <SkinArt skin={skin} rank={RealmLevels.Kingdom} size={112} />
      <StandingBadge standing={standing} />
    </span>
    <span className="cosmetics__name">
      {skin.aspect !== undefined && <AspectMark aspect={skin.aspect} size={18} decorative />}
      {skin.name}
    </span>
  </button>
);

const StandingBadge = ({ standing }: { standing: RealmSkinStanding }) => (
  <span className="cosmetics__badge" data-standing={standing}>
    {standing !== "owned" && standing !== "wonder" && <Icon name="lock" size={14} />}
    {COSMETICS_WORDS.standing[standing]}
  </span>
);

const SkinArt = ({ skin, rank, size }: { skin: RealmSkin; rank: RealmLevels; size: number }) => {
  const icon = realmSkinIcon(skin, rank);
  if (icon) return <Icon name={icon} size={size} />;
  return skin.aspect !== undefined ? <AspectMark aspect={skin.aspect} size={size} decorative /> : null;
};

const SkinPreview = ({ skin, facts, rank }: { skin: RealmSkin; facts: RealmSkinFacts; rank: RealmLevels | null }) => {
  const [shown, show] = useState<RealmLevels>(rank ?? RealmLevels.Kingdom);
  const standing = realmSkinStanding(skin, facts);
  const icon = realmSkinIcon(skin, shown);
  return (
    <AppPanel
      title={COSMETICS_WORDS.familySkin(COSMETICS_WORDS.families[skin.family], skin.name)}
      cue={<StandingBadge standing={standing} />}
      className="cosmetics__preview"
    >
      <div className="cosmetics__stage" data-preview={skin.id} data-rank={shown}>
        {rank !== null && <AppChip>{COSMETICS_WORDS.yourRank(rankName(rank))}</AppChip>}
        <SkinArt skin={skin} rank={shown} size={200} />
      </div>
      <div className="cosmetics__ranks">
        {REALM_RANKS.map((each) => (
          <button
            key={each}
            type="button"
            aria-pressed={each === shown}
            className="app-choice cosmetics__rank"
            onClick={() => show(each)}
          >
            <SkinArt skin={skin} rank={each} size={56} />
            <span>{rankName(each)}</span>
          </button>
        ))}
      </div>
      {icon && (
        <div className="cosmetics__matching">
          <span>
            <strong>{COSMETICS_WORDS.matchingIcon}</strong>
            <span>{COSMETICS_WORDS.matchingIconWhere}</span>
          </span>
          <Icon name={icon} size={38} />
          <Icon name={icon} size={22} />
        </div>
      )}
      <StandingAction standing={standing} />
    </AppPanel>
  );
};

const StandingAction = ({ standing }: { standing: RealmSkinStanding }) => {
  if (standing === "owned") return <p className="cosmetics__note">{defaultOrderLine()}</p>;
  if (standing === "pass")
    return (
      <AppButton kind="secondary" icon="fragment" to={FRAGMENTS_PATH}>
        {COSMETICS_WORDS.unlockInPass}
      </AppButton>
    );
  if (standing === "event")
    return (
      <>
        <AppButton kind="secondary" icon="lock" disabled>
          {COSMETICS_WORDS.eventExclusive}
        </AppButton>
        <p className="cosmetics__note">{COSMETICS_WORDS.eventGone}</p>
      </>
    );
  return (
    <AppButton kind="secondary" disabled>
      {COSMETICS_WORDS.wonderOnly}
    </AppButton>
  );
};

export const RealmCosmeticsShortcut = ({ onOpen }: { onOpen: () => void }) => {
  const { facts, rank } = useCosmeticStanding();
  return (
    <AppPanel>
      <div className="cosmetics-shortcut" data-cosmetics-shortcut>
        <SkinArt skin={firstOwned(facts)} rank={isRank(rank) ? rank : RealmLevels.Kingdom} size={56} />
        <span>
          <strong>{COSMETICS_WORDS.shortcutTitle}</strong>
          <span>{COSMETICS_WORDS.shortcutLine(ownedCountOf(facts))}</span>
        </span>
        <AppButton kind="primary" onClick={onOpen}>
          {COSMETICS_WORDS.open}
        </AppButton>
      </div>
    </AppPanel>
  );
};
