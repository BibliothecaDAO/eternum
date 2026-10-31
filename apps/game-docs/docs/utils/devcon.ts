import { campaignHomeClaim } from "@bibliothecadao/eternum";
import { seasonDayUnitSeconds } from "../../../../config/source/common/season-clock";
import { frontierDevconPreset } from "../../../../config/source/frontier/devcon";
import { nativeResearchConstants as research } from "../../../../contracts/l3/world-native/schema/client.gen";
import { CAMPAIGNS } from "../../../../packages/identity/src/campaigns";
import { laborRulesOf } from "../../../game/src/services/home-claim-rules";
import { prizeShares } from "../../../../packages/core/src/sync/frontier-prize";
import { LONG_DAY_UNITS, SHORT_DAY_UNITS } from "./frontier";

/**
 * The Devcon season as its page states it: the Devcon preset (preset 6, Frontier at Devcon's speed), the campaign its
 * flyers open, and the ledger's prize curve. Only the start and the pool are set at launch rather than in code; they are
 * the two values written here.
 */
const campaign = CAMPAIGNS["devcon-2026"];

/** Nov 3 2026, 12:00 IST: the Devcon season's first day opens (launch input; the campaign holds only its end). */
const STARTS_AT = Date.UTC(2026, 10, 3, 6, 30) / 1000;
/** The LORDS the Devcon season is funded with at launch. */
const POOL = 300_000;

const n = (value: number) => value.toLocaleString("en-US");
const pct = (bps: number) => `${n(bps / 100)}%`;

/** A moment as the page writes it in one zone: "Mon 3 Nov, 12:00 IST". */
const momentIn = (seconds: number, timeZone: string, zone: string) =>
  `${new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  })
    .format(seconds * 1000)
    .replace(",", "")} ${zone}`;
const moment = (seconds: number) => ({
  ist: momentIn(seconds, "Asia/Kolkata", "IST"),
  utc: momentIn(seconds, "UTC", "UTC"),
});

const hoursOf = (units: number) => (units * seasonDayUnitSeconds(frontierDevconPreset)) / 3600;

const chests = frontierDevconPreset.chests;
const leaderboardPool = (POOL * (10_000 - chests.poolBps)) / 10_000;
const rules = laborRulesOf(frontierDevconPreset.labor);
/** What a ticket's home claims each game day, golden or not. */
const claimOf = (golden: boolean) => {
  const { labor, essence } = campaignHomeClaim(rules, golden);
  return { labor: n(labor), essence: n(essence) };
};
const depthEssence = (preset: typeof frontierDevconPreset) =>
  preset.research
    .filter((step) => step.row === research.ROW_DEPTH)
    .sort((a, b) => a.tier - b.tier)
    .map((step) => n(step.essenceCost));

export const DEVCON = {
  starts: moment(STARTS_AT),
  ends: moment(campaign.redeemUntil),
  pool: n(POOL),
  chestShare: pct(chests.poolBps),
  chestPool: n((POOL * chests.poolBps) / 10_000),
  leaderboardShare: pct(10_000 - chests.poolBps),
  leaderboardPool: n(leaderboardPool),
  places: chests.topN,
  prizes: prizeShares(BigInt(leaderboardPool), chests.topN).map((share) => n(Number(share))),
  goldenFlyers: n(campaign.golden),
  claim: { ticket: claimOf(false), golden: claimOf(true), realm: n(Number(rules.amount)) },
  day: { shortestHours: hoursOf(SHORT_DAY_UNITS), longestHours: hoursOf(LONG_DAY_UNITS) },
  speed: n(frontierDevconPreset.clockScale.activity),
  depths: depthEssence(frontierDevconPreset),
};
