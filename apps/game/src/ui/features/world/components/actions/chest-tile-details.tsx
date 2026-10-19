import { Icon } from "@/ui/design-system/icon";
import type { ReactNode } from "react";
import { ResourcesIds, formatExact } from "@bibliothecadao/types";
import { configManager } from "@bibliothecadao/eternum";
import { HudButton, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { RelicChip } from "@/ui/features/military/utils/relic-chip";
import type { RelicCrateOpening } from "@/hooks/store/use-relic-crate-store";
import { EntityDetailStat, EntityDetailStatList } from "../entities/layout";

/**
 * A sealed crate keeps its contents a surprise. Only an opening receipt supplies relics to this panel.
 */
export function ChestTileDetails({
  coordsLabel,
  headerAction,
  opening,
  onOpen,
  openBlockedReason,
}: {
  coordsLabel?: string;
  headerAction?: ReactNode;
  opening: RelicCrateOpening | null;
  onOpen?: () => void;
  openBlockedReason?: string;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <HudPanel className="min-w-0" divided collapsible={false}>
        <HudPanel kind="section" title={coordsLabel ?? "Relic tile"} cue={headerAction}>
          <div className="flex items-center gap-2 text-hud-accent">
            <Icon name="chest" alt="" className="h-9 w-9 shrink-0 object-contain" />
            <p className="truncate text-hud-title">{opening ? "Crate opened" : "Crate"}</p>
          </div>
        </HudPanel>
        <HudPanel kind="section" title="Contents" icon="chest">
          {opening ? <RelicList relics={opening.relics} /> : <CrateContents />}
          {!opening && (
            <div className="mt-2">
              <HudButton
                kind="primary"
                onClick={onOpen}
                disabled={!onOpen}
                data-tip={onOpen ? undefined : openBlockedReason}
              >
                {onOpen ? "Open" : "Move next to it"}
              </HudButton>
            </div>
          )}
        </HudPanel>
      </HudPanel>
    </div>
  );
}

const CrateContents = () => {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-hud-body">Three relics. Open to reveal them.</p>
      <EntityDetailStatList compact columns={1}>
        <EntityDetailStat
          compact
          label="Points"
          value={formatExact(configManager.getVictoryPointGrants().openRelicCrate)}
        />
      </EntityDetailStatList>
    </div>
  );
};

/** The awarded relics, each as the sheet's relic chip with its effect on hover. */
const RelicList = ({ relics }: { relics: ResourcesIds[] }) => (
  <ul aria-label="Relics" className="flex flex-col gap-1">
    {relics.map((relicId, index) => (
      <li key={`${relicId}-${index}`}>
        <RelicChip relic={relicId} />
      </li>
    ))}
  </ul>
);
