/**
 * The figures the Balance & data mockup shows, copied from perf's pull of 25 October 17:24Z
 * (reports/frontier-blitz-live-data-3.md, evidence/perf/frontier-blitz-live-data-3/analysis.md) and the research
 * balance study (reports/frontier-research-balance-1.md). The built page reads the newest pull instead.
 */
export const PULL = {
  taken: "25 Oct 17:24Z",
  block: "Herald block 378,110",
  where: "Frontier game 1, day 7, 3.6 h in · 13 Blitz games",
  rerun: "cd evidence/perf/frontier-live-data-1 && python3 -I live-data.py all",
};

export const FRONTIER_TILES = [
  { figure: "8", line: "players left; they made 82% of 4,455 actions" },
  { figure: "0 / 32", line: "realms at depth: depth 1 costs 160,000 Essence, the most earned is 80,160" },
  { figure: "900", line: "LORDS paid out in 7 days, from 6 ruins; no chest opened" },
  { figure: "0", line: "reverted of 12,830 shard transactions" },
];

export const FRONTIER_DAYS = [
  { day: "0", hours: 24, settled: 22, active: 18 },
  { day: "1", hours: 12, settled: 6, active: 16 },
  { day: "2", hours: 20, settled: 2, active: 16 },
  { day: "3", hours: 8, settled: 1, active: 10 },
  { day: "4", hours: 16, settled: 1, active: 12 },
  { day: "5", hours: 12, settled: 0, active: 10 },
  { day: "6", hours: 8, settled: 0, active: 8 },
  { day: "7 (open)", hours: 3.6, settled: 0, active: 7 },
];

export const UNUSED = [
  "Research in 10 of 32 realms; Scouts' lodge, Hearth, Depth and Rations never picked",
  "Side picks lopsided: Drill 10 of 10, Tools 11 of 12, Fields 9 of 13",
  "No army has bought Scouting tier 3; Battle 4 bought once",
];

export const BLITZ_TILES = [
  { figure: "13 / 69", line: "slots that took a registration and became games" },
  { figure: "8", line: "of 13 games were solo; 5 saw no action" },
  { figure: "100", line: "LORDS from each of the 4 chests opened: one entry's price" },
  { figure: "32%", line: "of all points from Hyperstructure shares, 26% from their bandits" },
];

/** The research balance study's three questions, its options, and the recommendation. */
export const BALANCE_QUESTIONS = [
  {
    question: "Storage",
    options: [
      "S1 · Cut storage research: the realm sets capacity",
      "S2 · Make storage matter later: smaller Kingdom and Empire stores",
    ],
    recommended: 0,
  },
  {
    question: "Research paths",
    options: [
      "T1 · Separate levels: buying one side never closes the other",
      "T2 · Four picks total, each side its own prices",
      "T3 · Keep today's rule: four shared purchases",
    ],
    recommended: 0,
  },
  {
    question: "Beast labor",
    options: [
      "B1 · Initial guards / 4: median 85 labor a clear",
      "B2 · Guards / 8: median 43",
      "B3 · Guards / 2: median 170, more than camps",
    ],
    recommended: 0,
  },
];
