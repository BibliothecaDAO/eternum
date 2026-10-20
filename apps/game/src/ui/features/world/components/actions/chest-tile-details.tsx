import { Icon } from "@/ui/design-system/icon";
import type { ReactNode } from "react";
import { type ID, ResourcesIds, formatExact } from "@bibliothecadao/types";
import { configManager, dayOf } from "@bibliothecadao/eternum";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useExpeditionRules } from "@/ui/features/frontier/frontier-home";
import { HudButton, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { RelicChip } from "@/ui/features/military/utils/relic-chip";
import type { ChestOpening } from "@/hooks/store/use-chest-opening-store";
import { EntityDetailStat, EntityDetailStatList } from "../entities/layout";

/**
 * How a sealed chest opens from here: its Open, or, where it cannot open yet, the plain line that says what it needs
 * (live-qa-night-2 B-4: a disabled gold "Move next to it" said why only on hover).
 */
export type ChestOpen = { onOpen: () => void } | { blocked: string };

/**
 * A sealed crate keeps its contents a surprise. Only an opening receipt supplies relics to this panel.
 */
export function ChestTileDetails({
  rewardChestId,
  coordsLabel,
  headerAction,
  opening,
  open,
}: {
  /** Only Frontier LORDS chests supply a metadata ID; sealed relic packs are never read here. */
  rewardChestId?: ID;
  coordsLabel?: string;
  headerAction?: ReactNode;
  opening: ChestOpening | null;
  open: ChestOpen;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <HudPanel className="min-w-0" divided collapsible={false}>
        <HudPanel
          kind="section"
          title={
            coordsLabel ?? (rewardChestId === undefined && opening?.kind !== "lords" ? "Relic tile" : "Chest tile")
          }
          cue={headerAction}
        >
          <div className="flex items-center gap-2 text-hud-accent">
            <Icon name="chest" alt="" className="h-9 w-9 shrink-0 object-contain" />
            <p className="truncate text-hud-title">{chestTitle(opening, rewardChestId)}</p>
          </div>
        </HudPanel>
        <HudPanel kind="section" title="Contents" icon="chest">
          <ChestContents opening={opening} rewardChestId={rewardChestId} />
          {!opening && (
            <div className="mt-2">
              {"onOpen" in open ? (
                <HudButton kind="primary" onClick={open.onOpen}>
                  Open
                </HudButton>
              ) : (
                <p className="text-hud-body">{open.blocked}</p>
              )}
            </div>
          )}
        </HudPanel>
      </HudPanel>
    </div>
  );
}

function chestTitle(opening: ChestOpening | null, rewardChestId?: ID): string {
  if (opening?.kind === "lords") return opening.amount === 0 ? "Chest expired" : "Chest opened";
  if (opening) return "Crate opened";
  return rewardChestId === undefined ? "Crate" : "Reward Chest";
}

function ChestContents({ opening, rewardChestId }: { opening: ChestOpening | null; rewardChestId?: ID }) {
  if (opening?.kind === "relics") return <RelicList relics={opening.relics} />;
  if (opening?.kind === "lords") return <LordsReceipt amount={opening.amount} />;
  if (rewardChestId !== undefined) return <LordsChestContents entityId={rewardChestId} />;
  return <CrateContents />;
}

function LordsReceipt({ amount }: { amount: number }) {
  return (
    <div className="flex items-center gap-2" data-lords-receipt>
      <Icon name="lords" alt="LORDS" className="h-9 w-9" />
      <p>
        {amount === 0 ? "Reservation expired. No LORDS paid." : `${formatExact(amount)} LORDS paid to the army's realm`}
      </p>
    </div>
  );
}

function LordsChestContents({ entityId }: { entityId: ID }) {
  const chest = useNativeRow("SiteChest", { game_id: configManager.getActiveGameId(), entity_id: entityId });
  const rules = useExpeditionRules();
  const now = useNowSeconds();
  if (!chest) return <p>Syncing chest reward…</p>;
  if (!rules) throw new Error("A LORDS chest requires Frontier's calendar");
  const today = dayOf(rules, now);
  const expired = !today || BigInt(today.index) !== chest.reservation_day;
  return (
    <div className="flex flex-col gap-2" data-lords-chest data-expired={expired}>
      <div className="flex items-center gap-2">
        <Icon name="lords" alt="LORDS" className="h-9 w-9" />
        <p>{formatExact(expired ? 0 : chest.amount)} LORDS</p>
      </div>
      <p className="text-hud-muted">
        {expired
          ? "Reservation expired at day rollover. No LORDS remain."
          : "Paid to the opening army's home realm. Expires at day rollover."}
      </p>
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
