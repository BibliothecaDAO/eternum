import { useParams, useSearchParams } from "react-router-dom";

import { homeIcon, type HomeKind } from "@/ui/design-system/home-icons";
import { AppButton } from "@/ui/design-system/kit/app-elements";
import { FESTIVAL_WORDS } from "@/ui/design-system/kit/words";
import { findOwnEntry } from "@/ui/features/frontier/board/standings";
import { SeasonPayoutRow } from "@/ui/features/frontier/value/season-payout";
import { HomeArt } from "@/ui/shared/components/home-art";

import { useLayout } from "../frame/layout";
import { seasonEnded } from "../season";
import { ARCHIVED_SEASONS, archivedSeason } from "../season-tab/archive/archive";
import { SeasonGreeting } from "../season-tab/festival";
import { SeasonOverRecap } from "../season-tab/season-over";
import { prizeOf } from "../season-tab/season-recap";

/**
 * Season 0's end on Diwali, the owner's pick page's stills (/lab/app/<screen>/season-end-devcon/<layout>/<who>):
 * `sky` (A, the deck under fireworks, the ticket beside the season), `greeting` and `greeting-deck` (B, a greeting
 * before the deck, then the deck as it ships), `deck` (C, the deck dressed, the ticket stamped on the player's place).
 * `?frame=<s>` holds the fireworks at that second. The board is prod's Playtest read by its third place, as the HUD
 * lab's season-over is; the season is named Season 0, ending Fri 6 Nov 18:00Z.
 */
type Layout = "sky" | "greeting" | "greeting-deck" | "deck";

/** Who reads it: a Devcon realm's owner, a golden one's, a free home's, a held Realm's. */
type Who = "devcon" | "golden" | "free" | "held";

const HOMES: Record<Who, { kind: HomeKind; level: number; tier?: "golden" | "regular" | "free"; ticket: boolean }> = {
  devcon: { kind: "devcon", level: 2, tier: "regular", ticket: true },
  golden: { kind: "devcon-golden", level: 2, tier: "golden", ticket: true },
  free: { kind: "realm", level: 1, tier: "free", ticket: false },
  held: { kind: "realm", level: 2, ticket: false },
};

const SEASON_REF = { chainId: ARCHIVED_SEASONS[0]!.chainId, gameId: ARCHIVED_SEASONS[0]!.game_id };
const BOARD = archivedSeason(SEASON_REF)!.board;
const VIEWER = "0x648174392d94df37bc7d59c3abf22116d20df16ddf0e380c5ff79aff86738c4";
const SEASON_0 = {
  ...ARCHIVED_SEASONS[0]!,
  game_id: 990,
  season_number: 0,
  clock: { ...ARCHIVED_SEASONS[0]!.clock, end_at: Date.UTC(2026, 10, 6, 18) / 1000 },
};

export const LabSeasonEndDevcon = () => {
  const { layout, who } = useParams() as { layout: Layout; who: Who };
  const frame = Number(useSearchParams()[0].get("frame") ?? 1.4);
  const cut = useLayout() === "phone" ? "tall" : "wide";
  const home = HOMES[who];
  const own = findOwnEntry(BOARD.entries, VIEWER)!;
  if (layout === "greeting")
    return (
      <SeasonGreeting
        cut={cut}
        season={seasonEnded(SEASON_0)}
        home={<HomeArt icon={homeIcon(home.kind, home.level)} size={cut === "tall" ? 64 : 88} tier={home.tier} />}
        rank={own.rank}
        field={BOARD.entries.length}
        prize={prizeOf(BOARD, own)}
        ticket={home.ticket}
        frame={frame}
        step={
          <AppButton kind="primary" icon="victory">
            {FESTIVAL_WORDS.seeSeason}
          </AppButton>
        }
      />
    );
  return (
    <SeasonOverRecap
      gameRef={SEASON_REF}
      game={SEASON_0}
      board={BOARD}
      viewer={VIEWER}
      ending="lifted"
      withdraw={<SeasonPayoutRow lords={1_240} linkWalletLine={null} onLinkWallet={() => undefined} />}
      festival={layout === "greeting-deck" ? undefined : { look: layout, ticket: home.ticket, frame }}
      onSeason={() => undefined}
      onExit={() => undefined}
    />
  );
};
