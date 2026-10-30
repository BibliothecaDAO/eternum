import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Icon } from "@/ui/design-system/icon";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { HudPanel, HudSheet } from "@/ui/design-system/kit/hud-elements";
import { XP } from "@/ui/design-system/kit/words";
import { configManager, siteDisplayName, siteClearXp } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatCharge, formatExact, resourceName, frontierSiteName, scaledToUnits } from "@bibliothecadao/types";

const RECEIPT_MODELS = ["ExpeditionSite"] as const;

type ClearedSite = { site: NativeRows["ExpeditionSite"] };

/** The site's receipt lives independently of whoever now occupies its tile. */
export function readClearedSite(
  store: NativeFactStore,
  gameId: number,
  hex: { col: number; row: number; alt: boolean },
): ClearedSite | null {
  const site = [...store.inGame("ExpeditionSite", gameId)].find(
    (site) => site.clear !== null && site.col === hex.col && site.row === hex.row && site.alt === hex.alt,
  );
  return site ? { site } : null;
}

export function useSelectedClearedSite(): ClearedSite | null {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const hex = useUIStore((state) => state.selectedHex);
  const alt = useUIStore((state) => state.mapLayer);
  useNativeRevision(RECEIPT_MODELS);
  return isMapView && hex ? readClearedSite(setup.store, configManager.getActiveGameId(), { ...hex, alt }) : null;
}

/** A cleared site's name, from its receipt's id alone: the rule every reader of a site shares, its rename included. */
const clearedSiteName = (selected: ClearedSite): string => siteDisplayName(Number(selected.site.entity_id));

/** A cleared site's receipt as its own sheet: titled by the site's name, what the clear credited beneath. */
export const ClearedSiteSheet = ({ selected, onClose }: { selected: ClearedSite; onClose: () => void }) => (
  <HudSheet label={clearedSiteName(selected)} onClose={onClose}>
    <ReceiptLines selected={selected} />
  </HudSheet>
);

/**
 * A cleared site's receipt inside another card (an army standing on the tile): a section titled by the site's name, so
 * the receipt names its place whatever card holds it.
 */
export function SiteReceipt({ selected }: { selected: ClearedSite }) {
  const name = clearedSiteName(selected);
  return (
    <HudPanel kind="section" title={name} label={name} collapsible={false}>
      <ReceiptLines selected={selected} />
    </HudPanel>
  );
}

/** What this clear credited, including zero when a store was full; never today's balance or the preview. */
function ReceiptLines({ selected }: { selected: ClearedSite }) {
  const receipt = selected.site.clear;
  if (!receipt) throw new Error("A site receipt requires a cleared site");
  const reward = receipt.reward;
  return (
    <section aria-label="Clear reward" className="flex flex-col gap-2 text-hud-body">
      <div className="flex items-center gap-2">
        <Icon name="flag" size={24} />
        <strong>Cleared · {frontierSiteName(selected.site.category)}</strong>
      </div>
      <div className="flex items-center gap-3" data-site-rewards>
        {reward && (
          <span className="flex items-center gap-1">
            <Icon name={resourceMeaning(reward.resource_type)} size={28} />
            <strong>{formatCharge(scaledToUnits(BigInt(reward.amount)))}</strong> {resourceName(reward.resource_type)}
          </span>
        )}
        <span>
          <strong>{formatExact(siteClearXp(selected.site))}</strong> {XP}
        </span>
      </div>
    </section>
  );
}
