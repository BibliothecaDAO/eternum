import { HudWindow } from "@/ui/design-system/kit/hud-elements";
import { GameProvider } from "@/hooks/context/game-context";
import { useDocumentClass } from "@/hooks/use-document-class";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { BattleLab } from "@/ui/features/military/battle/battle-lab";
import { ArmyDeploymentPicker } from "@/ui/features/military/components/army-deployment-picker";
import { UnifiedArmyCreationBody } from "@/ui/features/military/components/unified-army-creation-modal/unified-army-creation-modal";
import { GuildListHeader, GuildRow } from "@/ui/features/social/guilds/guild-list";
import { PlayerList, type PlayerCustom } from "@/ui/features/social/player/player-list";
import { CRATE_NEEDS_AN_ARMY } from "@/ui/design-system/kit/words";
import { ChestTileDetails } from "@/ui/features/world/components/actions/chest-tile-details";
import { ProductionStatusBadge } from "@/ui/shared";
import type { VictoryPointGrants } from "@/ui/shared/lib/victory-point-grants";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";
import { type ReactNode, useMemo } from "react";

const GRANTS: VictoryPointGrants = {
  exploreTile: 5,
  openRelicCrate: 250,
  claimCampFromBandits: 250,
  claimHyperstructureFromBandits: 1_000,
  hyperstructurePerSecond: 1,
  hyperstructureScale: "per-realm",
};

const player = (address: bigint, name: string, rank: number, points: number, isUser = false): PlayerCustom => ({
  entity: `0x${address.toString(16)}`,
  address,
  name,
  points,
  rank,
  realms: 2,
  mines: 0,
  hyperstructures: rank === 1 ? 2 : 0,
  villages: 0,
  banks: 0,
  isAlive: true,
  guildName: "",
  isUser,
  isInvited: false,
  guild: undefined,
  activityBreakdown: {
    exploration: { count: 40 - rank * 8, points: (40 - rank * 8) * 5 },
    openRelicChest: { count: rank === 1 ? 1 : 0, points: rank === 1 ? 250 : 0 },
    otherStructureBanditsDefeat: { count: 0, points: 0 },
    hyperStructureBanditsDefeat: { count: rank === 1 ? 2 : 0, points: rank === 1 ? 2_000 : 0 },
    hyperstructureShare: { count: 0, points: rank === 1 ? 420 : 0 },
  } as PlayerCustom["activityBreakdown"],
  accruingHoldPoints: 0,
  mmrDelta: null,
});

const PLAYERS = [player(1n, "djizus", 1, 2_870), player(2n, "clientlane", 2, 120, true), player(3n, "uxplay", 3, 80)];

const GUILD = {
  entityId: 1n,
  name: "Iron Pact",
  isOwner: false,
  isMember: true,
  memberCount: 4,
  points: 3_070,
  rank: 1,
  prize: { lords: 1_200, strk: 40 },
  realms: 6,
  mines: 0,
  hyperstructures: 2,
  structureCount: 8,
  isPublic: true,
} as unknown as Parameters<typeof GuildRow>[0]["guild"];

/** One surface of area D, captured on its own (`pnpm hud:capture … --page /lab/kit/area-d`): its name, then the real component. */
const Surface = ({ name, children }: { name: string; children: ReactNode }) => (
  <section data-sheet-element={name} className="flex flex-col gap-2 p-4">
    <h2 data-lab-chrome className="text-sm text-white/60">
      {name}
    </h2>
    {children}
  </section>
);

/**
 * Dev only, at /lab/kit/area-d: area D's surfaces (rings, leaderboard, tribes, the Military picker and window body,
 * Combat, the crate panel) as the game renders them, on the deploy fixture's realm, for before and after captures of
 * the HUD sheet migration without a live game.
 */
export const AreaDLab = () => {
  useDocumentClass("classic-hud");
  const { store } = useMemo(() => frontierDay(), []);
  const game = { store, systemCalls: {} } as unknown as GameClientSetup;
  return (
    <GameProvider value={game} account={{ address: "0x111" } as never}>
      <div className="flex min-h-screen flex-wrap items-start bg-[#0b1418]">
        <Surface name="rings">
          {/* The realm card's grid, its tightest, with the widest rims side by side: two-figure counts beside times, and
              a second row of long times (99 days, the step to weeks, years, past 99 years). */}
          <div className="grid w-[294px] grid-cols-5 justify-items-center gap-y-5 pb-2 pt-2">
            <ProductionStatusBadge
              resource={ResourcesIds.Wheat}
              isProducing
              timeRemainingSeconds={Number.POSITIVE_INFINITY}
              buildings={1}
              amount="1,042"
            />
            <ProductionStatusBadge
              resource={ResourcesIds.Fish}
              isProducing
              timeRemainingSeconds={Number.POSITIVE_INFINITY}
              buildings={12}
              amount="380"
            />
            <ProductionStatusBadge
              resource={ResourcesIds.Wood}
              isProducing
              timeRemainingSeconds={86_340}
              buildings={12}
              amount="840"
            />
            <ProductionStatusBadge
              resource={ResourcesIds.Coal}
              isProducing
              timeRemainingSeconds={1_020}
              buildings={12}
              amount="1.2K"
            />
            <ProductionStatusBadge
              resource={ResourcesIds.Essence}
              isProducing={false}
              timeRemainingSeconds={null}
              amount="6.4K"
            />
            {[99, 100, 699, 1_000, 40_000].map((days, index) => (
              <ProductionStatusBadge
                key={days}
                resource={
                  [
                    ResourcesIds.Stone,
                    ResourcesIds.Copper,
                    ResourcesIds.Obsidian,
                    ResourcesIds.Silver,
                    ResourcesIds.Gold,
                  ][index]
                }
                isProducing
                timeRemainingSeconds={days * 86_400}
                buildings={12}
                amount="9,999"
              />
            ))}
          </div>
        </Surface>
        <Surface name="leaderboard">
          <div className="w-fit">
            <PlayerList
              players={PLAYERS}
              grants={GRANTS}
              mmr="off"
              viewPlayerInfo={() => undefined}
              whitelistPlayer={() => undefined}
              isLoading={false}
            />
          </div>
        </Surface>
        <Surface name="tribes">
          <div className="w-[56rem]">
            <GuildListHeader activeSort={{ sortKey: "rank", sort: "asc" }} setActiveSort={() => undefined} />
            <GuildRow guild={GUILD} onClick={() => undefined} />
          </div>
        </Surface>
        <Surface name="military-picker">
          <ArmyDeploymentPicker structureId={7} isExplorer />
        </Surface>
        <Surface name="military-window">
          <div className="w-[60rem]">
            <HudWindow title="Military" icon="military" onClose={() => undefined}>
              <UnifiedArmyCreationBody structureId={7} />
            </HudWindow>
          </div>
        </Surface>
        <Surface name="combat">
          <div className="w-[74rem]">
            <BattleLab mode="sim" />
          </div>
        </Surface>
        <Surface name="crate">
          <div className="w-80">
            <ChestTileDetails opening={null} open={{ onOpen: () => undefined }} />
          </div>
        </Surface>
        <Surface name="crate-far">
          <div className="w-80">
            <ChestTileDetails opening={null} open={{ blocked: CRATE_NEEDS_AN_ARMY }} />
          </div>
        </Surface>
      </div>
    </GameProvider>
  );
};
