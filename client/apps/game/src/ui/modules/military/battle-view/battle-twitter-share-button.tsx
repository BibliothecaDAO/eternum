import TwitterShareButton from "@/ui/elements/twitter-share-button";
import { formatSocialText, twitterTemplates } from "@/ui/socials";
import { currencyFormat } from "@/ui/utils/utils";
import { ArmyInfo, BattleSide, ClientComponents, getAddressNameFromEntity, Structure } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";
import { env } from "../../../../../env";

export const BattleTwitterShareButton = ({
  userArmiesInBattle,
  attackerArmies,
  defenderArmies,
  ownArmySide,
  battleAdjusted,
  structure,
}: {
  userArmiesInBattle: ArmyInfo[];
  attackerArmies: ArmyInfo[];
  defenderArmies: (ArmyInfo | undefined)[];
  ownArmySide: string;
  battleAdjusted: ComponentValue<ClientComponents["Battle"]["schema"]> | undefined;
  structure: Structure | undefined;
}) => {
  const {
    setup: { components },
  } = useDojo();

  const userBattleSide = userArmiesInBattle[0]?.battle_side || BattleSide.None;

  const getLargestArmyName = (armies: (ArmyInfo | undefined)[]) => {
    return armies.reduce(
      (acc: { name: string; size: bigint }, army: ArmyInfo | undefined) => {
        const armySize =
          (army?.troops.crossbowman_count ?? 0n) +
          (army?.troops.knight_count ?? 0n) +
          (army?.troops.paladin_count ?? 0n);
        return armySize > acc.size
          ? {
              name: getAddressNameFromEntity(army?.entityOwner.entity_id || 0, components) ?? "mercenaries",
              size: armySize,
            }
          : acc;
      },
      { name: "mercenaries", size: 0n },
    ).name;
  };

  const calculateTotalTroops = (armies: (ArmyInfo | undefined)[], adjustedHealth: bigint | undefined) => {
    return (
      adjustedHealth ??
      armies.reduce(
        (acc: bigint, army: ArmyInfo | undefined) =>
          acc +
          (army?.troops.crossbowman_count ?? 0n) +
          (army?.troops.knight_count ?? 0n) +
          (army?.troops.paladin_count ?? 0n),
        0n,
      )
    );
  };

  const enemyName = useMemo(() => {
    const name = getLargestArmyName(ownArmySide === BattleSide[BattleSide.Attack] ? defenderArmies : attackerArmies);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }, [defenderArmies, attackerArmies, ownArmySide]);

  const totalAttackerTroops = useMemo(
    () => Number(calculateTotalTroops(attackerArmies, battleAdjusted?.attack_army_health.current)),
    [attackerArmies, battleAdjusted],
  );

  const totalDefenderTroops = useMemo(
    () => Number(calculateTotalTroops(defenderArmies, battleAdjusted?.defence_army_health.current)),
    [defenderArmies, battleAdjusted],
  );

  const generateTwitterText = () => {
    const text = structure
      ? structure.isMine
        ? twitterTemplates.underSiege
        : twitterTemplates.attacking
      : twitterTemplates.battling;
    return formatSocialText(text, {
      enemyName,
      attackerTroops: currencyFormat(totalAttackerTroops, 0),
      defenderTroops: currencyFormat(totalDefenderTroops, 0),
      url: env.VITE_SOCIAL_LINK,
    });
  };

  const twitterText = useMemo(generateTwitterText, [enemyName, totalAttackerTroops, totalDefenderTroops, structure]);

  return (
    userBattleSide !== BattleSide.None &&
    battleAdjusted?.duration_left !== 0n && (
      <TwitterShareButton
        className="h-10"
        variant="opaque"
        callToActionText="Call to Arms!"
        text={twitterText}
        buttonSize="md"
      />
    )
  );
};
