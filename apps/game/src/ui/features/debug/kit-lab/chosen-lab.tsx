import { GameProvider } from "@/hooks/context/game-context";
import { useDocumentClass } from "@/hooks/use-document-class";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { ChoiceButton, realmChoice, type Choice } from "@/ui/features/game-entry/home-source-picker";
import { TransferDirection } from "@/ui/features/military/components/transfer-troops/transfer-direction";
import { TransferSlotSelection } from "@/ui/features/military/components/transfer-troops/transfer-slot-selection";
import { DefenseSlotSelection } from "@/ui/features/military/components/unified-army-creation-modal/defense-slot-selection";
import type { GuardSummary } from "@/ui/features/military/components/unified-army-creation-modal/types";
import { GuildMemberList } from "@/ui/features/social/guilds/guild-member-list";
import { ActionTile } from "@/ui/features/world/containers/left-facets/structure-actions-panel";
import { FilterChipsRow } from "@/ui/features/world/containers/left-facets/structure-category-filter";
import { SuggestionChip } from "@/ui/features/world/containers/left-facets/suggestion-chip";
import type { EmpireSuggestion } from "@/ui/features/world/containers/left-facets/use-empire-suggestions";
import { kindsHeld } from "@/ui/features/world/hud/holdings-model";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { StructureType, TroopTier, TroopType } from "@bibliothecadao/types";
import { type ReactNode, useMemo } from "react";

const noop = () => undefined;

/** A pick of each kind, chosen and not, one row per surface, each marked for its still. */
const Surface = ({ name, children }: { name: string; children: ReactNode }) => (
  <section data-lab={`chosen-${name}`} className="flex flex-col gap-2 p-4">
    <h2 data-lab-chrome className="text-sm text-white/60">
      {name}
    </h2>
    {children}
  </section>
);

/** The Realm step's tiles: a golden ticket (chosen), a ticket and a held Realm. */
const HOME_CHOICES: { choice: Choice; picked: boolean }[] = [
  { choice: { kind: "ticket", campaign: "devcon-2026", golden: true }, picked: true },
  { choice: { kind: "ticket", campaign: "devcon-2026", golden: false }, picked: false },
  { choice: realmChoice({ realmId: 4786, map: null }), picked: false },
];

const suggestion = (id: string, label: string): EmpireSuggestion => ({
  id,
  realmId: 7,
  realmName: "Temtinos",
  action: "upgrade",
  label,
  icon: "upgrade",
});

const KNIGHTS = { tier: TroopTier.T1, category: TroopType.Knight, count: 1_200 };

const GUARDS: Map<number, GuardSummary> = new Map([
  [0, { slot: 0, cooldownRemaining: 0, troops: { category: TroopType.Knight, tier: TroopTier.T1, count: 900 } }],
  [1, { slot: 1, cooldownRemaining: 0, troops: { category: TroopType.Knight, tier: TroopTier.T1, count: 300 } }],
]);

/** Three kinds held; only a mine's kind reads its structure, so none is given. */
const HELD = kindsHeld(
  [StructureType.Realm, StructureType.Village, StructureType.Hyperstructure].map((category) => ({
    category,
    structure: undefined as never,
  })),
);

/**
 * Dev only, at /lab/kit/chosen: every pick the kit's chosen look (ui-pick) draws outside the HUD lab's rooms, chosen
 * and not: the Realm step's home tiles, Blitz's phone action tiles, Next up's suggestions, the holdings' category
 * filter, the transfer and defense slots and a tribe's member rows. Before and after stills of one selected style.
 */
export const ChosenLab = () => {
  useDocumentClass("classic-hud");
  const { store } = useMemo(() => frontierDay(), []);
  const game = { store, systemCalls: {} } as unknown as GameClientSetup;
  return (
    <GameProvider value={game} account={{ address: "0x111" } as never}>
      <div className="flex min-h-screen flex-wrap items-start bg-[#0b1418]">
        <Surface name="home">
          <div className="home-picker__strip">
            {HOME_CHOICES.map(({ choice, picked }) => (
              <ChoiceButton
                key={choice.kind === "ticket" ? String(choice.golden) : choice.realmId}
                choice={choice}
                picked={picked}
                onPick={noop}
                disabled={false}
              />
            ))}
          </div>
        </Surface>
        <Surface name="actions">
          <div className="flex w-80 gap-1">
            {(["build", "military", "transfer"] as const).map((id) => (
              <ActionTile
                key={id}
                action={{
                  id,
                  label: id[0]!.toUpperCase() + id.slice(1),
                  active: id === "military",
                  refusal: null,
                  onClick: noop,
                }}
              />
            ))}
          </div>
        </Surface>
        <Surface name="suggestions">
          <div className="flex w-80 flex-col gap-2">
            <SuggestionChip
              suggestion={suggestion("a", "Level up")}
              onClick={noop}
              isPending={false}
              refusal={null}
              selected
            />
            <SuggestionChip
              suggestion={suggestion("b", "Level up")}
              onClick={noop}
              isPending={false}
              refusal={null}
              selected={false}
            />
          </div>
        </Surface>
        <Surface name="filter">
          <FilterChipsRow availableCategories={HELD} filterValue={StructureType.Realm} onFilterChange={noop} />
        </Surface>
        <Surface name="transfer-balance">
          <div className="w-80">
            <TransferSlotSelection
              transferDirection={TransferDirection.ExplorerToStructure}
              slots={[0, 1]}
              orderedSlots={[0, 1]}
              guards={[{ slot: 0, troops: KNIGHTS }, { slot: 1 }]}
              selectedSlot="balance"
              onSelect={noop}
              balanceOption={{ key: "balance", visible: true, troop: KNIGHTS }}
            />
          </div>
        </Surface>
        <Surface name="transfer-slot">
          <div className="w-80">
            <TransferSlotSelection
              transferDirection={TransferDirection.ExplorerToStructure}
              slots={[0, 1]}
              orderedSlots={[0, 1]}
              guards={[{ slot: 0, troops: KNIGHTS }, { slot: 1 }]}
              selectedSlot={0}
              onSelect={noop}
              balanceOption={{ key: "balance", visible: true, troop: KNIGHTS }}
            />
          </div>
        </Surface>
        <Surface name="defense">
          <div className="w-96">
            <DefenseSlotSelection
              guardSlot={1}
              guardsBySlot={GUARDS}
              availableSlots={[0, 1, 2, 3]}
              selectedTroopCombo={{ type: TroopType.Knight, tier: TroopTier.T1 }}
              canCreateDefenseArmy
              defenseSlotInfoMessage={null}
              defenseSlotErrorMessage={null}
              onSelect={noop}
            />
          </div>
        </Surface>
        <Surface name="tribe">
          <div className="w-80">
            <GuildMemberList
              guildMembers={[
                { guildEntityId: 1n, name: "clientlane", address: 2n, isUser: true, isGuildMaster: false },
                { guildEntityId: 1n, name: "djizus", address: 1n, isUser: false, isGuildMaster: true },
              ]}
              isLoading={false}
              viewPlayerInfo={noop}
              userIsGuildMaster={false}
              removeGuildMember={noop}
            />
          </div>
        </Surface>
      </div>
    </GameProvider>
  );
};
