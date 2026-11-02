import { LeaderboardSurface } from "@/ui/features/social/components/social-board";
import { shortString } from "starknet";

import { LabGame } from "./lab-game";
import { PLAYER } from "./fixture-game";

/** Eternum's preset, the one mode whose standings hold Tribes. */
const ETERNUM_PRESET = 3;

/** The tribe's master (a tribe's id is its master's address), and its two other members. */
const MASTER = "0x222";
const MEMBERS = [MASTER, "0x333", "0x444"];

/**
 * The tribe and its members, each a registered player of the lab game, and what Eternum's window reads that the lab
 * game leaves out: the season's points for a win.
 */
const tribeFacts = () => [
  { model: "SeasonWinThreshold", key: "0x7a0", value: { game_id: 1, points: "10000000000000" } },
  {
    model: "Guild",
    key: "0x7a1",
    value: { game_id: 1, guild_id: MASTER, public: true, name: shortString.encodeShortString("Ironwood") },
  },
  ...MEMBERS.flatMap((address) => [
    { model: "GuildMember", key: `0x7b${address.slice(2)}`, value: { game_id: 1, actor: address, guild_id: MASTER } },
    { model: "PlayerEntry", key: `0x7c${address.slice(2)}`, value: { game_id: 1, owner: address, player: address } },
  ]),
  { model: "PlayerEntry", key: `0x7c${PLAYER.slice(2)}`, value: { game_id: 1, owner: PLAYER, player: PLAYER } },
];

/**
 * Dev only: an Eternum game's standings at /lab/kit/standings, the real leaderboard window on the lab game with one
 * tribe of three: Tribes, a tribe's members, a member's card, and the chosen tribe pressed again for its members (a
 * player's card has no Back). The phone proof plays it (prove-app-phone.mjs).
 */
export const StandingsLab = () => (
  <div data-lab="standings" className="ui flex min-h-screen items-start justify-center bg-hud-surface p-2">
    <LabGame preset={ETERNUM_PRESET} facts={tribeFacts}>
      {() => <LeaderboardSurface />}
    </LabGame>
  </div>
);
