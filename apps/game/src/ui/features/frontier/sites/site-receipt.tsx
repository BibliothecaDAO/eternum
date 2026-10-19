import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Icon } from "@/ui/design-system/icon";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { XP } from "@/ui/design-system/kit/words";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatCharge, formatExact, resourceName, structureName, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { siteClearXp } from "./site-card-plan";

const RECEIPT_MODELS = ["ExpeditionSite", "Structure"] as const;

type ClearedSite = { site: NativeRows["ExpeditionSite"]; structure: NativeRows["Structure"] };

/** The site's receipt lives independently of whoever now occupies its tile. */
export function readClearedSite(
  store: NativeFactStore,
  gameId: number,
  hex: { col: number; row: number; alt: boolean },
): ClearedSite | null {
  const site = [...store.inGame("ExpeditionSite", gameId)].find(
    (site) => site.clear !== null && site.col === hex.col && site.row === hex.row && site.alt === hex.alt,
  );
  return site ? { site, structure: store.require("Structure", site) } : null;
}

export function useSelectedClearedSite(): ClearedSite | null {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const hex = useUIStore((state) => state.selectedHex);
  const alt = useUIStore((state) => state.mapLayer);
  useNativeRevision(RECEIPT_MODELS);
  return isMapView && hex ? readClearedSite(setup.store, configManager.getActiveGameId(), { ...hex, alt }) : null;
}

/** What this clear credited, including zero when a store was full; never today's balance or the preview. */
export function SiteReceipt({ selected }: { selected: ClearedSite }) {
  const receipt = selected.site.clear;
  if (!receipt) throw new Error("A site receipt requires a cleared site");
  const reward = receipt.reward;
  return (
    <section aria-label="Clear reward" className="flex flex-col gap-2 text-hud-body">
      <div className="flex items-center gap-2">
        <Icon name="flag" size={24} />
        <strong>Cleared · {structureName(selected.structure.base.category)}</strong>
      </div>
      <div className="flex items-center gap-3" data-site-rewards>
        {reward && (
          <span className="flex items-center gap-1">
            <Icon name={resourceMeaning(reward.resource_type)} size={28} />
            <strong>{formatCharge(Number(reward.amount) / RESOURCE_PRECISION)}</strong>{" "}
            {resourceName(reward.resource_type)}
          </span>
        )}
        <span>
          <strong>{formatExact(siteClearXp(selected.site))}</strong> {XP}
        </span>
      </div>
    </section>
  );
}
