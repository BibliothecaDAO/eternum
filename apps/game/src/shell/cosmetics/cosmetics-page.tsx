import "./cosmetics-page.css";

import { aspectName, RealmLevels, rankName } from "@bibliothecadao/types";
import { useState } from "react";
import { Navigate } from "react-router-dom";

import {
  BASE_REALM_SKIN,
  REALM_RANKS,
  REALM_SKIN_DEFAULT_ORDER,
  realmSkinIcon,
  REALM_SKIN_CODES,
  REALM_SKINS,
  realmSkinStanding,
  realmSkinWearableOnRealm,
  wearsDefaultSkin,
  wornRealmSkin,
  type RealmSkin,
  type RealmSkinFacts,
  type RealmSkinFamily,
  type RealmSkinStanding,
} from "@/three/cosmetics/realm-skins";
import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { AppButton, AppChip, AppPanel } from "@/ui/design-system/kit/app-elements";
import { COSMETICS_WORDS, TRY_AGAIN } from "@/ui/design-system/kit/words";
import { REALM_SKIN_FAMILIES } from "@bibliothecadao/eternum";
import { useIdentitySession } from "@/hooks/context/identity-session";
import { DEVICE_LIMIT_REACHED, isAccountStatePrompt } from "@/hooks/context/gameplay-account-sync";
import { useAccountStore } from "@/hooks/store/use-account-store";

import { AccountStatePrompt } from "../account-state";
import { useLayout } from "../frame/layout";
import { PageFrame } from "../frame/page-frame";
import { PROFILE_PATH } from "../profile/settings-route";
import { FRAGMENTS_PATH } from "../shop/fragments-route";
import { useRequestSignIn } from "../sign-in/connect";
import { useCosmeticStanding } from "./cosmetic-facts";
import { COSMETICS_HASH } from "./cosmetics-route";
import { useRealmSkinEquip } from "./realm-skin-equip";

const FAMILY_ROWS: readonly (readonly RealmSkinFamily[])[] = [["season-1"], ["devcon", "base", "wonder"]];

const isRank = (level: number | null): level is RealmLevels => REALM_RANKS.some((rank) => rank === level);

const ownedCountOf = (facts: RealmSkinFacts) =>
  REALM_SKINS.filter((skin) => realmSkinStanding(skin, facts) === "owned").length;

const isOtherAspectSkin = (standing: RealmSkinStanding, wearable: boolean, facts: RealmSkinFacts) =>
  standing === "owned" && !wearable && facts.aspect !== null;

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
  const { facts, rank, game, realm } = useCosmeticStanding();
  const [chosen, pick] = useState<RealmSkin | null>(null);
  const worn = realm ? wornRealmSkin(facts) : undefined;
  const picked = chosen ?? worn ?? BASE_REALM_SKIN;
  const equipping = useRealmSkinEquip(game, realm);
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
        <SkinPreview
          skin={picked}
          facts={facts}
          worn={picked === worn}
          rank={isRank(rank) ? rank : null}
          equipping={equipping}
        />
        <div className="cosmetics__families">
          {FAMILY_ROWS.map((row) => (
            <div key={row.join()} className="cosmetics__row" data-families={row.length}>
              {row.map((family) => (
                <FamilyPanel key={family} family={family} facts={facts} worn={worn} picked={picked} onPick={pick} />
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
  worn,
  picked,
  onPick,
}: {
  family: RealmSkinFamily;
  facts: RealmSkinFacts;
  worn: RealmSkin | undefined;
  picked: RealmSkin;
  onPick: (skin: RealmSkin) => void;
}) => {
  const skins = REALM_SKINS.filter((skin) => skin.family === family);
  return (
    <AppPanel title={COSMETICS_WORDS.families[family]} cue={familyCue(family, skins, facts)}>
      <ul className="cosmetics__cards" data-family={family}>
        {skins.map((skin) => {
          const standing = realmSkinStanding(skin, facts);
          const wearable = realmSkinWearableOnRealm(skin, facts);
          const otherAspect = isOtherAspectSkin(standing, wearable, facts);
          return (
            <li key={skin.id}>
              <SkinCard
                skin={skin}
                standing={standing}
                wearable={wearable}
                otherAspect={otherAspect}
                worn={skin === worn}
                picked={skin === picked}
                onPick={onPick}
              />
            </li>
          );
        })}
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
  wearable,
  otherAspect,
  worn,
  picked,
  onPick,
}: {
  skin: RealmSkin;
  standing: RealmSkinStanding;
  wearable: boolean;
  otherAspect: boolean;
  worn: boolean;
  picked: boolean;
  onPick: (skin: RealmSkin) => void;
}) => (
  <button
    type="button"
    className="app-choice cosmetics__card"
    data-skin={skin.id}
    data-standing={standing}
    data-wearable={standing === "owned" ? String(wearable) : undefined}
    data-other-aspect={otherAspect ? "true" : undefined}
    aria-pressed={picked}
    onClick={() => onPick(skin)}
  >
    <span className="cosmetics__art">
      <SkinArt skin={skin} rank={RealmLevels.Kingdom} size={112} />
      <StandingBadge standing={standing} worn={worn} otherAspect={otherAspect} />
    </span>
    <span className="cosmetics__name">
      {skin.aspect !== undefined && <AspectMark aspect={skin.aspect} size={18} decorative />}
      {skin.name}
    </span>
    {otherAspect && <span className="cosmetics__card-note">{COSMETICS_WORDS.otherAspect}</span>}
  </button>
);

const StandingBadge = ({
  standing,
  worn,
  otherAspect = false,
}: {
  standing: RealmSkinStanding;
  worn: boolean;
  otherAspect?: boolean;
}) => (
  <span
    className="cosmetics__badge"
    data-standing={worn ? "equipped" : standing}
    data-other-aspect={otherAspect ? "true" : undefined}
  >
    {standing !== "owned" && standing !== "wonder" && <Icon name="lock" size={14} />}
    {worn ? COSMETICS_WORDS.equipped : COSMETICS_WORDS.standing[standing]}
  </span>
);

const SkinArt = ({ skin, rank, size }: { skin: RealmSkin; rank: RealmLevels; size: number }) => (
  <Icon name={realmSkinIcon(skin, rank)} size={size} />
);

const SkinPreview = ({
  skin,
  facts,
  worn,
  rank,
  equipping,
}: {
  skin: RealmSkin;
  facts: RealmSkinFacts;
  worn: boolean;
  rank: RealmLevels | null;
  equipping: ReturnType<typeof useRealmSkinEquip>;
}) => {
  const [chosenRank, show] = useState<RealmLevels | null>(null);
  const shown = chosenRank ?? rank ?? RealmLevels.Kingdom;
  const standing = realmSkinStanding(skin, facts);
  const wearable = realmSkinWearableOnRealm(skin, facts);
  const otherAspect = isOtherAspectSkin(standing, wearable, facts);
  const icon = realmSkinIcon(skin, shown);
  return (
    <AppPanel
      title={COSMETICS_WORDS.familySkin(COSMETICS_WORDS.families[skin.family], skin.name)}
      cue={<StandingBadge standing={standing} worn={worn} otherAspect={otherAspect} />}
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
      <div className="cosmetics__matching">
        <span>
          <strong>{COSMETICS_WORDS.matchingIcon}</strong>
          <span>{COSMETICS_WORDS.matchingIconWhere}</span>
        </span>
        <Icon name={icon} size={38} />
        <Icon name={icon} size={22} />
      </div>
      <StandingAction skin={skin} standing={standing} worn={worn} facts={facts} equipping={equipping} />
    </AppPanel>
  );
};

const StandingAction = ({
  skin,
  standing,
  worn,
  facts,
  equipping,
}: {
  skin: RealmSkin;
  standing: RealmSkinStanding;
  worn: boolean;
  facts: RealmSkinFacts;
  equipping: ReturnType<typeof useRealmSkinEquip>;
}) => {
  if (standing === "owned") return <OwnedAction skin={skin} worn={worn} facts={facts} equipping={equipping} />;
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

const OwnedAction = ({
  skin,
  worn,
  facts,
  equipping,
}: {
  skin: RealmSkin;
  worn: boolean;
  facts: RealmSkinFacts;
  equipping: ReturnType<typeof useRealmSkinEquip>;
}) => {
  const { session } = useIdentitySession();
  const requestSignIn = useRequestSignIn();
  const accountState = useAccountStore((state) => state.provisioningError);
  const { equip, sending, failed } = equipping;
  if (!realmSkinWearableOnRealm(skin, facts)) {
    return facts.aspect !== null ? (
      <div className="cosmetics__wearable" data-not-wearable="">
        <AppButton kind="secondary" disabled>
          {COSMETICS_WORDS.notWearableOnRealm}
        </AppButton>
        <p className="cosmetics__note">{COSMETICS_WORDS.otherAspectNote(skin.name, aspectName(facts.aspect))}</p>
      </div>
    ) : (
      <p className="cosmetics__note" data-not-wearable="">
        {COSMETICS_WORDS.noRealmAspectNote(skin.name)}
      </p>
    );
  }
  if (!session)
    return (
      <AppButton kind="primary" onClick={() => requestSignIn()}>
        {COSMETICS_WORDS.connectToEquip}
      </AppButton>
    );
  if (isAccountStatePrompt(accountState)) return <AccountStatePrompt />;
  const family = REALM_SKIN_CODES[skin.family]!;
  const backToDefault = REALM_SKIN_FAMILIES.DEFAULT_REALM_SKIN;
  if (accountState === DEVICE_LIMIT_REACHED) {
    const action = worn ? backToDefault : family;
    const canRetry = equip && sending === null && failed === action;
    return <AccountStatePrompt onRetry={canRetry ? () => void equip(action) : undefined} />;
  }
  if (!equip) return <p className="cosmetics__note">{defaultOrderLine()}</p>;
  const busyFor = (code: number) => (sending === code ? COSMETICS_WORDS.equip : undefined);
  const wordFor = (code: number, word: string) => (failed === code ? TRY_AGAIN : word);
  if (!worn)
    return (
      <AppButton kind="primary" busy={busyFor(family)} disabled={sending !== null} onClick={() => void equip(family)}>
        {wordFor(family, COSMETICS_WORDS.equip)}
      </AppButton>
    );
  return (
    <>
      <AppChip tone="good">{COSMETICS_WORDS.equipped}</AppChip>
      {!wearsDefaultSkin(facts) && (
        <AppButton
          kind="quiet"
          busy={busyFor(backToDefault)}
          disabled={sending !== null}
          onClick={() => void equip(backToDefault)}
        >
          {wordFor(backToDefault, COSMETICS_WORDS.useDefaultOrder)}
        </AppButton>
      )}
    </>
  );
};

export const RealmCosmeticsShortcut = ({ onOpen }: { onOpen: () => void }) => {
  const { facts, rank } = useCosmeticStanding();
  return (
    <AppPanel>
      <div className="cosmetics-shortcut" data-cosmetics-shortcut>
        <SkinArt skin={wornRealmSkin(facts)} rank={isRank(rank) ? rank : RealmLevels.Kingdom} size={56} />
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
