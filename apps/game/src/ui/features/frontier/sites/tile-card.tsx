import { playUnitCommandSound } from "@/audio/unit-command-audio";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentArmiesTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { Skull, TreasureChest } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { toast } from "@/ui/features/event-feed/notify";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { biomeTypeOf, configManager, entityMapPosition, isViewerOwner } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { type ReactNode, useMemo, useState } from "react";
import { Chip, TroopChip } from "../frontier-chips";
import { formatAmount } from "../frontier-format";
import { BoltGlyph, FlagGlyph, SwordGlyph } from "../glyphs";
import { readSiteCard, type SiteAttack, type SiteCardPlan } from "./site-card-plan";

const SITE_MODELS = ["ExpeditionSite", "ExplorerTroops", "ArmySlot", "Guard", "Structure", "TileOccupancy"] as const;

interface SelectedSite {
  site: NativeRows["ExpeditionSite"];
  structure: NativeRows["Structure"];
  tile: TileSpatialRenderable;
}

/** The map tile the player tapped, when it holds a standing expedition site: a camp, rift or fallen realm. */
export const useSelectedSite = (): SelectedSite | null => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const selectedHex = useUIStore((state) => state.selectedHex);
  const hexes = useMemo(() => (selectedHex ? [selectedHex] : []), [selectedHex]);
  const [tile] = useWorldSpatialTiles(hexes);
  useNativeRevision(SITE_MODELS);
  if (!isMapView || !tile?.occupierIsStructure) return null;
  const key = { game_id: configManager.getActiveGameId(), entity_id: tile.occupierId };
  const site = setup.store.get("ExpeditionSite", key);
  if (!site || site.cleared) return null;
  return { site, structure: setup.store.require("Structure", key), tile };
};

/**
 * Frontier's tile card (design §3.12, mockup 5): the site as its art and name, its guard as troops and a tier badge,
 * the fight from the selected army as exchanges to win and troops lost, what it pays, and one Attack button carrying
 * its stamina. An army out of reach, or none selected, leaves the fight "—" and the button disabled. The card stays
 * between attacks and closes when the site falls.
 */
export const TileCard = ({ selected, onClose }: { selected: SelectedSite; onClose: () => void }) => {
  const { setup, account } = useGame();
  const attack = useSiteAttack(setup.store, selected.tile);
  const revision = useNativeRevision(SITE_MODELS);
  const siteTile = selected.tile.hexCoords;
  const plan = useMemo(
    () => readSiteCard(setup.store, selected.site, selected.structure, siteTile, attack),
    [attack, revision, selected, setup.store, siteTile],
  );
  const [pending, setPending] = useState(false);
  const canAttack = !pending && attack !== null && plan.fight !== undefined && plan.fight.outcome !== "refused";

  const attackSite = async () => {
    if (!attack || !account.account) return;
    setPending(true);
    try {
      playUnitCommandSound("attack");
      await setup.systemCalls.attack_explorer_vs_guard({
        signer: account.account,
        explorer_id: attack.army.explorer_id,
        structure_id: selected.structure.entity_id,
      });
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The attack could not be sent."));
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      aria-label={plan.name}
      data-frontier-sheet
      className={cn(
        "frontier-sheet pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] font-sans",
        "landscape:inset-x-auto landscape:bottom-4 landscape:left-1/2 landscape:w-[min(520px,60vw)] landscape:-translate-x-1/2",
      )}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="-mt-2 flex h-6 justify-center">
        <span className="frontier-handle mt-1" />
      </button>
      <header className="flex items-center gap-3">
        <img src={plan.art} alt="" className="size-24 shrink-0 rounded-xl bg-black/50 object-cover" />
        <span className="flex flex-col items-start gap-2">
          <h2 className="frontier-title">{plan.name}</h2>
          <GuardChip guard={plan.guard} />
        </span>
      </header>
      <div className="grid grid-cols-2 gap-3">
        <FightBox fight={plan.fight} />
        <PayoutBox payout={plan.payout} />
      </div>
      <button
        type="button"
        disabled={!canAttack}
        onClick={() => void attackSite()}
        className="frontier-primary flex items-center justify-center gap-3"
      >
        <SwordGlyph className="size-8" />
        Attack
        <Chip small tone="price" label="Stamina" icon={<BoltGlyph />} value={formatAmount(plan.attackStamina)} />
      </button>
    </section>
  );
};

/** The army the player has selected, standing where it stands, if it is theirs and orders are allowed. */
const useSiteAttack = (store: NativeFactStore, siteTile: TileSpatialRenderable): SiteAttack | null => {
  const viewer = useAccountAddress();
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const ordersAllowed = useUIStore(canIssueOrders);
  const timestamp = useNowSeconds();
  const armiesTick = useCurrentArmiesTick();
  useNativeRevision(SITE_MODELS);
  if (!ordersAllowed || selectedId === null) return null;
  const gameId = configManager.getActiveGameId();
  const army = store.get("ExplorerTroops", { game_id: gameId, explorer_id: Number(selectedId) });
  if (!army) return null;
  const home = store.get("Structure", { game_id: gameId, entity_id: army.owner });
  if (!home || !isViewerOwner(home.owner, viewer)) return null;
  const position = entityMapPosition(store, gameId, army.explorer_id);
  return {
    army,
    armyTile: { col: position.x, row: position.y, alt: position.alt },
    biome: biomeTypeOf(siteTile.biome),
    timestamp,
    armiesTick,
  };
};

const GuardChip = ({ guard }: { guard: SiteCardPlan["guard"] }) =>
  guard ? (
    <TroopChip type={guard.type} tier={guard.tier} count={guard.count} />
  ) : (
    // Unknown until the guard's slots arrive; a site with every guard fallen has nothing to show.
    guard === undefined && <Chip label="Guard" icon={<span />} value="—" />
  );

/** Exchanges to win as a flag and its count, or the fall or the stamina it runs out of; troops lost as a skull. */
const FightBox = ({ fight }: { fight: SiteCardPlan["fight"] }) => {
  const resolved = fight && fight.outcome !== "refused" ? fight : undefined;
  const outcome: Record<"wins" | "loses" | "stalls", { icon: ReactNode; color: string }> = {
    wins: { icon: <FlagGlyph className="size-7" />, color: "#9fd06a" },
    loses: { icon: <Skull className="size-7" />, color: "#ff8a73" },
    stalls: { icon: <BoltGlyph className="size-7 opacity-60" />, color: "#f6ac1d" },
  };
  return (
    <div className="frontier-card flex flex-col items-center justify-center gap-2 p-3" aria-label="The fight">
      <span
        className="flex items-center gap-1.5"
        aria-label={resolved ? `${resolved.outcome} in ${resolved.exchanges}` : "No fight"}
      >
        {resolved ? outcome[resolved.outcome].icon : <FlagGlyph className="size-7 opacity-40" />}
        <span className="frontier-title tabular-nums" style={resolved && { color: outcome[resolved.outcome].color }}>
          {resolved ? resolved.exchanges : "—"}
        </span>
        <BoltGlyph className="size-5" />
      </span>
      <span className="flex items-center gap-2" aria-label={`Troops lost ${resolved ? resolved.troopsLost : "—"}`}>
        <Skull className="size-7" />
        <span className="frontier-title tabular-nums">{resolved ? `−${formatAmount(resolved.troopsLost)}` : "—"}</span>
      </span>
    </div>
  );
};

/** The prize reads as the card's highlight: a gold edge and a warm glow under the number. */
const PAYOUT_GLOW = {
  borderColor: "rgba(223, 170, 84, 0.7)",
  background:
    "radial-gradient(circle at 50% 75%, rgba(246, 172, 29, 0.2), transparent 70%), linear-gradient(180deg, #2a2013, #15100a)",
};

/** What clearing the site pays home, large: a camp's labor, a rift's Essence, a fallen realm's chest. */
const PayoutBox = ({ payout }: { payout: SiteCardPlan["payout"] }) => (
  <div
    className="frontier-card flex flex-col items-center justify-center gap-1 p-3"
    style={PAYOUT_GLOW}
    aria-label={payout ? `Pays ${formatAmount(payout.amount)}` : "Pays a chest"}
  >
    {payout ? (
      <>
        <img src={`/images/resources/${payout.resourceId}.png`} alt="" className="size-10" />
        <span className="frontier-hero tabular-nums">+{formatAmount(payout.amount)}</span>
      </>
    ) : (
      <TreasureChest className="size-16" />
    )}
  </div>
);
