import { useParams, useSearchParams } from "react-router-dom";

import { homeIcon } from "@/ui/design-system/home-icons";
import { AppButton } from "@/ui/design-system/kit/app-elements";
import { FESTIVAL_WORDS } from "@/ui/design-system/kit/words";
import type { CampaignMark } from "@/ui/features/frontier/value/campaign-home";
import { findOwnEntry } from "@/ui/features/frontier/board/standings";
import { SeasonPayoutRow } from "@/ui/features/frontier/value/season-payout";

import { useLayout } from "../frame/layout";
import { seasonEnded } from "../season";
import { ARCHIVED_SEASONS, archivedSeason } from "../season-tab/archive/archive";
import { SeasonGreeting } from "../season-tab/festival";
import { SeasonOverRecap } from "../season-tab/season-over";
import { prizeOf } from "../season-tab/season-recap";
import { LAB_DEVCON_SEASON_0 } from "./app-lab-fixtures";

/**
 * Season 0's end on Diwali, the owner's pick page's stills (/lab/app/<screen>/season-end-devcon/<step>/<who>): a Devcon
 * realm's owner's greeting (`greeting`), then the recap See my season opens (`recap`), which every other player meets
 * at once. `?frame=<s>` holds the fireworks at that second; without it they play (still, under reduced motion). The
 * board is prod's Playtest read by its third place, as the HUD lab's season-over is; the season is named Season 0,
 * ending Fri 6 Nov 18:00Z.
 */
type Step = "greeting" | "recap";

/** Who is greeted: a Devcon realm's owner, a golden one's. */
type Who = "devcon" | "golden";

const MARKS: Record<Who, CampaignMark> = {
  devcon: { line: "Devcon", golden: false, icon: homeIcon("devcon", 2) },
  golden: { line: "Golden Devcon", golden: true, icon: homeIcon("devcon-golden", 2) },
};

const SEASON_REF = { chainId: ARCHIVED_SEASONS[0]!.chainId, gameId: ARCHIVED_SEASONS[0]!.game_id };
const BOARD = archivedSeason(SEASON_REF)!.board;
const VIEWER = "0x648174392d94df37bc7d59c3abf22116d20df16ddf0e380c5ff79aff86738c4";

export const LabSeasonEndDevcon = () => {
  const { step, who } = useParams() as { step: Step; who: Who };
  const held = useSearchParams()[0].get("frame");
  const frame = held === null ? undefined : Number(held);
  const cut = useLayout() === "phone" ? "tall" : "wide";
  const own = findOwnEntry(BOARD.entries, VIEWER)!;
  if (step === "greeting")
    return (
      <SeasonGreeting
        cut={cut}
        season={seasonEnded(LAB_DEVCON_SEASON_0)}
        mark={MARKS[who]}
        rank={own.rank}
        field={BOARD.entries.length}
        prize={prizeOf(BOARD, own)}
        frame={frame}
        step={
          <AppButton kind="primary" icon="victory" step>
            {FESTIVAL_WORDS.seeSeason}
          </AppButton>
        }
      />
    );
  return (
    <SeasonOverRecap
      gameRef={SEASON_REF}
      game={LAB_DEVCON_SEASON_0}
      board={BOARD}
      viewer={VIEWER}
      ending="lifted"
      withdraw={<SeasonPayoutRow lords={1_240} linkWalletLine={null} onLinkWallet={() => undefined} />}
      onExit={() => undefined}
    />
  );
};
