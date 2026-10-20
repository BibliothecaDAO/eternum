import { beastMeaning } from "@/ui/design-system/domain-icon-meaning";
import { type IconMeaning } from "@/ui/design-system/icon";
import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { requestArmySelection } from "@/three/scenes/worldmap-army-select-request";
import { requestOrderAt } from "@/three/scenes/worldmap-order-request";

import type { Tier } from "@/ui/design-system/kit/tier-chip";
import { extractReadableErrorMessage } from "@/utils/error-message";
import {
  biomeTypeOf,
  configManager,
  entityMapPosition,
  getStructureName,
  isViewerOwner,
  Position,
} from "@bibliothecadao/eternum";
import {
  safeInteger,
  type GameClientSetup,
  type NativeFactStore,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { useMemo, type ReactNode } from "react";

import { useFrontierRealm, useGoToFrontierPlace } from "../frontier-home";
import { type ArmyOrder, type Cost, isCovered, useArmyStamina, useOrderAt } from "../hud/army-order";
import { armyArt, type DockArmy, useDockArmies } from "../hud/dock-armies";
import { useApproachTile } from "./approach";
import { readFightRecord, readPayoutRecord } from "./fight-record";
import {
  fightEnded,
  type FightGain,
  fightIsSent,
  type FightResult,
  fightResultOf,
  type FightSent,
  fightWasNotSent,
  lostArmyResult,
  useFightRefusal,
} from "./fight-result";
import { useSelectedOwnArmy } from "./selected-army";
import { readArmyCard, readSiteCard, type SiteAttack, type SiteCardPlan, storeAtLimit } from "./site-card-plan";
import { type SiteChoice, SiteCardView, type SiteVerb } from "./site-card-view";

const SITE_MODELS = [
  "ExpeditionSite",
  "SiteChest",
  "ExplorerTroops",
  "ArmyProgress",
  "ArmySlot",
  "Guard",
  "Structure",
  "TileOccupancy",
  "ResourceBalance",
  "ResourceProduction",
  "RealmKnowledge",
] as const;

/** The resources a clear pays home, by the icon the card draws them with. */
const PAY_ICONS: Partial<Record<ResourcesIds, IconMeaning>> = {
  [ResourcesIds.Labor]: "labor",
  [ResourcesIds.Essence]: "essence",
};

/** What the tile card attacks: a standing site through its guard, or another player's army. */
type AttackTarget =
  | {
      kind: "site";
      site: NativeRows["ExpeditionSite"];
      structure: NativeRows["Structure"];
      tile: TileSpatialRenderable;
    }
  | { kind: "army"; army: NativeRows["ExplorerTroops"]; tile: TileSpatialRenderable };

/**
 * The map tile the player tapped, when something an army can attack stands on it: a standing expedition site (a
 * camp, rift, ruin or beasts), or an army that is not the player's own.
 */
export const useSelectedTarget = (): AttackTarget | null => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const viewer = useAccountAddress();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const hexes = useMemo(() => (selectedHex ? [selectedHex] : []), [selectedHex]);
  const [tile] = useWorldSpatialTiles(hexes);
  useNativeRevision(SITE_MODELS);
  if (!isMapView || !tile) return null;
  return tile.occupierIsStructure ? standingSite(setup.store, tile) : otherArmy(setup.store, tile, viewer);
};

const standingSite = (store: NativeFactStore, tile: TileSpatialRenderable): AttackTarget | null => {
  const key = { game_id: configManager.getActiveGameId(), entity_id: tile.occupierId };
  const site = store.get("ExpeditionSite", key);
  if (!site || site.clear) return null;
  return { kind: "site", site, structure: store.require("Structure", key), tile };
};

/** The army on the tile when it is someone else's; the player's own armies have their dock, not a card. */
const otherArmy = (store: NativeFactStore, tile: TileSpatialRenderable, viewer: bigint | null): AttackTarget | null => {
  const gameId = configManager.getActiveGameId();
  const army = store.get("ExplorerTroops", { game_id: gameId, explorer_id: tile.occupierId });
  if (!army) return null;
  const home = store.get("Structure", { game_id: gameId, entity_id: army.owner });
  return home && isViewerOwner(home.owner, viewer) ? null : { kind: "army", army, tile };
};

/** The card's reading of its target for an attack: a site's by its guard, an army's by its troops. */
const readTarget = (store: NativeFactStore, target: AttackTarget, attack: SiteAttack | null): SiteCardPlan =>
  target.kind === "site"
    ? readSiteCard(store, target.site, target.structure, target.tile.hexCoords, attack)
    : readArmyCard(store, target.army, target.tile.hexCoords, attack);

const targetId = (target: AttackTarget): number =>
  safeInteger(target.kind === "site" ? target.site.entity_id : target.army.explorer_id);

/**
 * A target's card over the game's facts: the selected army's matchup and exact forecast, what a clear pays and its
 * XP, then Attack in reach, Move until the army arrives, or the stamina it lacks. With no army selected, the realm's
 * armies are the choices. The card stays between attacks and closes when the target falls. It is the one surface an
 * army's attack is confirmed on, whatever it attacks.
 */
export const TileCard = ({
  selected,
  onClose,
  receipt,
}: {
  selected: AttackTarget;
  onClose: () => void;
  receipt?: ReactNode;
}) => {
  const { setup, account } = useGame();
  const actor = useSelectedOwnArmy();
  const attack = useSiteAttack(selected.tile, actor);
  const revision = useNativeRevision(SITE_MODELS);
  const siteTile = selected.tile.hexCoords;
  const plan = useMemo(() => readTarget(setup.store, selected, attack), [attack, revision, selected, setup.store]);
  const choices = useSiteChoices(selected, actor === null);
  const approach = useOrderAt(useApproachTile(siteTile, actor !== null && plan.fight === undefined));
  const stamina = useArmyStamina(actor ? safeInteger(actor.army.explorer_id) : null, plan.attackStamina);
  const realm = useFrontierRealm();
  const goToPlace = useGoToFrontierPlace(realm);
  const armyId = actor ? safeInteger(actor.army.explorer_id) : null;
  const inFlight = useInFlight("army", armyId)?.order;
  const refused = useFightRefusal(armyId, targetId(selected));

  const attackSite = async () => {
    if (!attack || !account.account || armyId === null) return;
    const signer = account.account;
    const sent = fightSentBy(attack.army, selected, plan);
    try {
      const fought = await sendOnce("army", armyId, { order: "attack" }, () => {
        fightIsSent();
        playUnitCommandSound("attack");
        return sendAttack(setup.systemCalls, signer, armyId, selected);
      });
      if (fought !== null) fightEnded(readFightResult(setup.store, sent, fought));
    } catch (error) {
      fightWasNotSent({
        armyId,
        targetId: targetId(selected),
        line: extractReadableErrorMessage(error, "The attack could not be sent."),
      });
    }
  };

  const verb = siteVerb({
    hasArmy: actor !== null,
    inReach: plan.fight !== undefined,
    approach,
    stamina,
    attack: { stamina: plan.attackStamina, inFlight, refused, onAttack: () => void attackSite() },
  });

  return (
    <SiteCardView
      receipt={receipt}
      site={plan.kind}
      name={selected.kind === "site" ? getStructureName(selected.structure).name : undefined}
      beast={plan.beast && plan.guard ? { ...plan.beast, combatClass: plan.guard.type } : undefined}
      army={actor && { art: armyArt(actor.army.troops), troops: wholeTroops(actor.army) }}
      guard={plan.guard === undefined ? undefined : (plan.guard?.count ?? null)}
      fight={plan.fight}
      pay={sitePay(plan)}
      chest={plan.chest ? { tier: (plan.chest.tier + 1) as Tier, lords: plan.chest.amount } : undefined}
      xp={plan.xp}
      verb={verb}
      choices={actor ? undefined : choices}
      onRealm={() => {
        onClose();
        goToPlace(false);
      }}
      onClose={onClose}
    />
  );
};

/** The attack the contract takes for the target: on a site's guard, or on another army (taking nothing from it). */
const sendAttack = (
  systemCalls: GameClientSetup["systemCalls"],
  signer: NonNullable<ReturnType<typeof useGame>["account"]["account"]>,
  explorerId: number,
  target: AttackTarget,
) =>
  target.kind === "site"
    ? systemCalls.attack_explorer_vs_guard({ signer, explorer_id: explorerId, structure_id: targetId(target) })
    : systemCalls.attack_explorer_vs_explorer({
        signer,
        aggressor_id: explorerId,
        defender_id: targetId(target),
        steal_resources: [],
      });

/**
 * The card's step: Move toward the site until the army is in reach (its prices, the order's), or Attack held back
 * when no order leads beside it; then Attack, the same tap whatever the forecast, or held back by the stamina it
 * lacks.
 */
const siteVerb = ({
  hasArmy,
  inReach,
  approach,
  stamina,
  attack,
}: {
  hasArmy: boolean;
  inReach: boolean;
  approach: ArmyOrder | null;
  stamina: Cost | undefined;
  attack: Omit<Extract<SiteVerb, { kind: "attack" }>, "kind">;
}): SiteVerb | null => {
  if (!hasArmy) return null;
  if (!inReach) {
    if (!approach) return { kind: "far" };
    return {
      kind: "move",
      prices: [
        { of: "stamina", amount: approach.stamina.cost },
        { of: "wheat", amount: approach.wheat.cost },
      ],
      onMove: () => requestOrderAt(approach.target),
    };
  }
  if (stamina && !isCovered(stamina)) return { kind: "short", stamina };
  return { kind: "attack", ...attack };
};

/** The selected army's attack on this site: where it stands, on the site's biome, at the current clocks. */
const useSiteAttack = (
  siteTile: TileSpatialRenderable,
  actor: ReturnType<typeof useSelectedOwnArmy>,
): SiteAttack | null => {
  const timestamp = useCurrentDefaultTick();
  return actor && { ...actor, biome: biomeTypeOf(siteTile.biome), timestamp };
};

/** With no army selected, each of the realm's armies as a choice, with the fight it would have from where it stands. */
const useSiteChoices = (selected: AttackTarget, wanted: boolean): SiteChoice[] => {
  const { setup } = useGame();
  const realm = useFrontierRealm();
  const armies = useDockArmies(realm);
  const timestamp = useCurrentDefaultTick();
  if (!wanted || !realm) return [];
  return armies.map((army: DockArmy) => {
    const troops = setup.store.get("ExplorerTroops", { game_id: realm.game_id, explorer_id: army.explorerId });
    const position = entityMapPosition(setup.store, realm.game_id, army.explorerId);
    const fight =
      troops &&
      readTarget(setup.store, selected, {
        army: troops,
        armyTile: { col: position.x, row: position.y, alt: position.alt },
        biome: biomeTypeOf(selected.tile.biome),
        timestamp,
      }).fight;
    return {
      label: army.label,
      art: army.art,
      troops: army.troops,
      fight,
      onPick: () =>
        requestArmySelection(
          army.explorerId,
          Position.fromContract({ x: selected.tile.hexCoords.col, y: selected.tile.hexCoords.row }),
        ),
    };
  });
};

/** What a camp or rift pays home and what of it fits; a ruin pays its chest, beasts only XP. */
const sitePay = (plan: SiteCardPlan) => {
  const icon = plan.payout && PAY_ICONS[plan.payout.resourceId];
  return plan.payout && icon ? { icon, amount: plan.payout.amount, fits: plan.payout.fits } : null;
};

/** The attack as it leaves, for its result: who fights whom, for which realm, and the XP a clear of it gives. */
const fightSentBy = (army: NativeRows["ExplorerTroops"], selected: AttackTarget, plan: SiteCardPlan): FightSent => ({
  targetId: targetId(selected),
  site: plan.kind,
  armyId: safeInteger(army.explorer_id),
  armyArt: armyArt(army.troops),
  guardIdentity: plan.beast ? { name: plan.beast.name, art: beastMeaning(plan.beast.beast) } : undefined,
  army: wholeTroops(army),
  homeId: safeInteger(army.owner),
  clearXp: plan.xp,
});

/**
 * The applied attack's result, from evidence that exists. The battle's own record says what it did to both sides.
 * With no record, only the army's own row speaks: gone, the army was lost; still there, nothing is claimed. A ruin's
 * clear shows as its chest opening, which is that fight's result.
 */
const readFightResult = (store: NativeFactStore, sent: FightSent, transactionHash: string): FightResult | null => {
  const record = readFightRecord(transactionHash);
  if (!record) return armyIsGone(store, sent.armyId) ? lostArmyResult(sent) : null;
  const result = fightResultOf(sent, record, () => readFightGain(store, sent, transactionHash));
  return result.verdict === "victory" && result.site === "Ruin" ? null : result;
};

/**
 * What the victory paid: the reward the clear's own payout record names, never the preview's figure, and whether the
 * store that took it stands at its limit now (the store's own fact, not a sum of what it held and what it got).
 */
const readFightGain = (store: NativeFactStore, sent: FightSent, transactionHash: string): FightGain | null => {
  if (sent.clearXp === undefined) return null;
  const paid = readPayoutRecord(transactionHash);
  const icon = paid && PAY_ICONS[paid.resourceId];
  return {
    pay:
      paid && icon ? { icon, amount: paid.amount, storeFull: storeAtLimit(store, sent.homeId, paid.resourceId) } : null,
    xp: sent.clearXp,
  };
};

const armyIsGone = (store: NativeFactStore, armyId: number): boolean =>
  store.get("ExplorerTroops", { game_id: configManager.getActiveGameId(), explorer_id: armyId }) === undefined;

const wholeTroops = (army: NativeRows["ExplorerTroops"]): number =>
  Number(army.troops.count / BigInt(RESOURCE_PRECISION));
