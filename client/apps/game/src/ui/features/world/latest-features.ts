export type FeatureType = "feature" | "improvement" | "balance" | "fix";

interface LatestFeature {
  date: string;
  title: string;
  description: string;
  type: FeatureType;
}

export const latestFeatures: LatestFeature[] = [
  {
    date: "2026-03-20",
    title: "Factory Prize Settings",
    description:
      "Blitz Factory launches now let you review and override the prize token and amount with human-readable values, so you can enter amounts like 500 or 0.00004 without manually converting them to raw token units.",
    type: "feature",
  },
  {
    date: "2026-03-20",
    title: "Desktop Factory Pickers Work",
    description:
      "Factory start scheduling now keeps the real browser date and time pickers usable on desktop while preserving the tap-friendly mobile picker rows, so launch timing works properly on both device sizes.",
    type: "fix",
  },
  {
    date: "2026-03-19",
    title: "Blitz Duration Profiles Landed",
    description:
      "Blitz Factory launches now treat 60-minute and 90-minute games as full balance profiles instead of just shorter or longer timers, so the official resource, building, realm, and starting-loadout tuning follows the selected game length automatically.",
    type: "balance",
  },
  {
    date: "2026-03-19",
    title: "Factory Time Pickers Look Native",
    description:
      "The Factory start form now shows date and time as cleaner custom rows while still opening the real iPhone picker, so the schedule controls feel balanced instead of shoving the value against one side.",
    type: "improvement",
  },
  {
    date: "2026-03-19",
    title: "Factory Time Pickers Stay Inside",
    description:
      "The Factory start form now keeps its date and time pickers clipped and contained on iPhone-sized screens, so the schedule controls no longer spill past their rounded panels on iOS.",
    type: "fix",
  },
  {
    date: "2026-03-19",
    title: "Factory Steps Read Clearly",
    description:
      "Factory setup steps now use shorter progress wording and clearer status text, so the watch flow reads like work in progress instead of instructions or backend jargon.",
    type: "improvement",
  },
  {
    date: "2026-03-19",
    title: "Factory Timing Gets A Full Row",
    description:
      "Blitz now gives the start schedule its own full-width row, so the date and time controls no longer feel squeezed next to the game duration picker.",
    type: "improvement",
  },
  {
    date: "2026-03-19",
    title: "Factory Progress Counts Forward",
    description:
      "Factory launch progress now gives the launch request its own first step, then carries the rest of setup forward on the same total so the watch flow no longer feels like it resets when the real run appears.",
    type: "fix",
  },
  {
    date: "2026-03-19",
    title: "Factory Start Time Fills Out",
    description:
      "The new Factory start form now gives both the date and time controls full-width schedule panels, so the kickoff picker feels properly sized on both mobile and desktop.",
    type: "improvement",
  },
  {
    date: "2026-03-19",
    title: "Steadier Factory Launch Tracking",
    description:
      "Factory now stays on Start when you switch modes or networks, and games you just launched keep showing up after a refresh while the first deployment update is still on the way.",
    type: "fix",
  },
  {
    date: "2026-03-18",
    title: "Cleaner Factory Start Time",
    description:
      "The new Factory start form now uses separate date and time pickers, so the schedule control feels cleaner and easier to use on both Eternum and Blitz.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Factory Progress Feels Active",
    description:
      "The Check a game view in the new Factory now gives the current step a clearer in-progress treatment, with a stronger active card and progress track that make setup feel visibly underway.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Factory Start Fits Mobile",
    description:
      "The new Factory start form now keeps fields like Start time inside the card on smaller phones, so Eternum launch setup no longer spills past the mobile layout.",
    type: "fix",
  },
  {
    date: "2026-03-18",
    title: "Factory Actions Stay Inline",
    description:
      "Retry, continue, and indexer actions in the new Factory now stay in the Factory flow instead of interrupting you with a network-switch prompt unless you choose to switch networks yourself.",
    type: "fix",
  },
  {
    date: "2026-03-18",
    title: "Factory Workflow Stays Put",
    description:
      "The new Factory now keeps you on Start if you switch away from Check while the same game is still deploying, so background updates no longer yank you back to the watch panel.",
    type: "fix",
  },
  {
    date: "2026-03-18",
    title: "Friendlier Factory Status Copy",
    description:
      "Factory V2 now talks about games and status in plain language instead of internal run jargon, and the watch timeline keeps older and upcoming steps softer so the current step is easier to focus on.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Clearer Factory Watch States",
    description:
      "Factory V2 now uses clearer watch-state wording and a calmer progress stack, so setup steps read like real status updates and only the current step stays visually in focus.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Aligned Factory Watch Search",
    description:
      "The Check a game panel in Factory now keeps its title, field, helper copy, and recent-game picker on one centered mobile column, so the search flow feels properly aligned on phones.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Cleaner Factory Watch",
    description:
      "Checking a game in Factory now feels much calmer on mobile, with a clearer search lead, a more readable live-status card, and softer pending and empty states.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Factory Control Deck Polish",
    description:
      "The top of Factory now reads as a cleaner centered control deck, with calmer switch groups, tidier section headers, and a softer version chooser footer that feels less bolted on.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Factory Starts Higher",
    description:
      "The Factory chooser now sits below the main Factory surface, so the tab starts much closer to the main landing header and gets into the actual launch flow sooner.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Factory Escapes Landing Gutter",
    description:
      "The Factory tab on the landing page now breaks out of the shared page margins, so Factory can use much more horizontal space than the Play, Learn, and News sections.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Factory Mobile Goes Edge To Edge",
    description:
      "The new Factory now drops its extra outer mobile frame so the launch and watch sections can use far more of the phone screen, making the flow feel much less boxed in on smaller devices.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Static Blitz Play Style Labels",
    description:
      "Blitz play-style choices in the new Factory now stay on the same three labels again, so changing More options like max players no longer rewrites the section into player-cap wording.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Factory Feels Native On Mobile",
    description:
      "The new Factory now uses much more of the phone screen, with wider controls, cleaner section bands, and sticky action bars that make starting or checking a game feel far more natural on mobile.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Cleaner Factory Start Card",
    description:
      "The Factory start card now separates launch basics, Blitz setup, and advanced tuning, so the main launch choices are easier to scan and the player-cap control sits with the play-style options it affects.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Fixed Blitz Play Style Labels",
    description:
      "Blitz play-style choices in the new Factory now stay on the same three preset labels again, so changing More options like max players no longer rewrites the section into numbered player-cap text.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Steadier Factory More Options",
    description:
      "Factory More options now keeps the section you opened in place while you type, so adjusting values like Blitz max players no longer snaps the drawer back closed.",
    type: "fix",
  },
  {
    date: "2026-03-18",
    title: "Player Cap In Blitz Styles",
    description:
      "The Blitz play-style section in Factory now shows the current player cap directly in each multiplayer option, so it is easier to see the actual setup before you launch.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Smarter Factory Blitz Controls",
    description:
      "Factory More options now shows Blitz-specific launch controls more clearly, including minute-based relic timing and a max-player cap that only appears for multiplayer Blitz setups.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Refined Blitz Play Style Copy",
    description:
      "Blitz play-style labels in the new Factory now use cleaner player-and-realm wording, so the default setup, the 2-player variant, and the single-realm option read more naturally at a glance.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Cleaner Factory Finish",
    description:
      "Blitz play-style copy in the new Factory now reads as clearer title-case presets, and the page ends with more bottom space so the final controls do not feel jammed against the edge.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Softer Blitz Play Style Copy",
    description:
      "Blitz play-style options in the new Factory now use calmer one-line labels, making the default multi-player setup, the 2-player variant, and the single-realm option easier to scan without feeling as shouty.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Cleaner Blitz Selector",
    description:
      "The Blitz play-style section now uses a lighter choice list instead of chunky option buttons, making the player-and-realm presets feel cleaner and easier to scan.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Blitz Play Style Copy",
    description:
      "Blitz play-style options in the new Factory now read as clear player-and-realm combinations, so it is easier to scan the default setup, the 2-player variant, and the single-realm option at a glance.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Smoother Factory Finish",
    description:
      "The new Factory now uses more compact Blitz play-style cards and adds extra space at the bottom of the page, so the controls feel lighter and the layout no longer ends so abruptly.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Sticky Factory Workflow",
    description:
      "Changing game type in the new Factory now keeps your current workflow section selected, so switching between Eternum and Blitz no longer kicks you out of Start or Watch unexpectedly.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Clearer Blitz Play Styles",
    description:
      "Blitz factory play styles now describe player and realm counts directly, making it easier to tell whether you are launching the default multi-player setup, a 2-player run, or a single-realm match.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Factory Launch More Options",
    description:
      "Factory start cards now include mode-aware More options controls for map tuning, so you can adjust launch-time discovery and relic settings without leaving the new flow.",
    type: "feature",
  },
  {
    date: "2026-03-18",
    title: "Factory Launch Without Switching",
    description:
      "Starting a game in the new Factory no longer forces a wallet network switch first, so you can kick off launches for another environment without interrupting your current wallet session.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Factory Guided Recovery",
    description:
      "Factory recovery now waits for you to press Continue or Retry first, then carries on through later successful steps without forcing extra clicks.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Factory Mobile Layout Pass",
    description:
      "The new Factory now holds up better on smaller screens, with cleaner top toggles, roomier touch targets, and watch-state cards that no longer feel cramped on mobile.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Clearer Factory Timeline Cards",
    description:
      "The new Factory now gives its Done, Now, and Next timeline cards different emphasis, making it easier to see what already happened, what matters most, and what comes next.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Softer Blitz Factory Divider",
    description:
      "The new Factory now uses a calmer separator in Blitz mode, so the top controls no longer cut too sharply into the cards below.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Calmer Factory Done State",
    description:
      "Completed games in the new Factory no longer keep saying they are updating automatically, making the finished state feel clearer and less noisy.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Clearer Factory Step Notes",
    description:
      "Factory step details now use plain status messages instead of raw launcher wording, so each part is easier to understand while you check a game.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Manual Indexer Restart",
    description:
      "Factory details now include a dedicated indexer action, so you can bring the indexer back online again without rerunning the whole launch.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Cleaner Factory Waiting State",
    description:
      "The new Factory now shows one clear loading state while a game is starting or recovering, removing the extra repeated badges so it is easier to understand what is happening.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Clearer Factory Words",
    description:
      "The new Factory now uses plainer language across launch and watch screens, replacing tool-heavy progress messages with shorter copy that is easier to understand at a glance.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Smarter Factory Relaunch",
    description:
      "Factory recovery now restarts the full launch automatically when the very first launch step fails, instead of forcing you through a step-by-step retry that cannot make forward progress.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Faster Factory Recovery Feedback",
    description:
      "Factory continue and retry actions now switch straight into a working state as soon as the launcher accepts them, so the page no longer leaves the old action button hanging around.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Stronger Factory Live Signal",
    description:
      "The Factory live badge now uses a brighter pulsing green signal so it is easier to tell at a glance when a game is actively being watched.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Cleaner Factory Live State",
    description:
      "Factory live tracking now shows a clearer pulsing live indicator and hides the extra manual refresh button while updates are already streaming in.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Tighter Factory Picker",
    description:
      "The Factory game picker now uses a smaller floating menu, so switching games feels lighter and takes up less space on the page.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Factory Picker Contrast",
    description:
      "The Factory game picker now uses a clearer floating surface, making the chooser easier to distinguish from the rest of the page while you switch between games.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Cleaner Factory Game Picker",
    description:
      "The Factory game picker now opens as a floating chooser instead of pushing the page around, making it easier to switch between games without losing your place.",
    type: "improvement",
  },
  {
    date: "2026-03-18",
    title: "Smoother Factory Launch Tracking",
    description:
      "Factory launch tracking now keeps a new game visible as soon as you start it and stays in a steady waiting state until the first live deployment update arrives.",
    type: "improvement",
  },
  {
    date: "2026-03-06",
    title: "Tournament Leaderboard Table Cleanup",
    description:
      "The Tournaments Score to Beat table now consistently shows only Rank, Player, and Score in the main leaderboard view, removing extra per-game columns from the grid.",
    type: "fix",
  },
  {
    date: "2026-03-06",
    title: "Proving Grounds Static Leaderboard",
    description:
      "The Tournaments Score to Beat leaderboard now supports static proving-grounds data for s0-game-1 through s0-game-4, including per-game points and chest counts for each player when live Torii endpoints are unavailable.",
    type: "feature",
  },
  {
    date: "2026-03-06",
    title: "Tournament Series Selection",
    description:
      "Score to Beat in the Tournaments tab now lets you select either individual games or full series, automatically expanding each series into its indexed games for faster multi-game leaderboard setup.",
    type: "feature",
  },
  {
    date: "2026-03-06",
    title: "Reliable Mainnet Realm Settlement",
    description:
      "Fixed cases where mainnet settlement could stop after the first realm. Settlement now resumes correctly from partial progress and waits for confirmed transactions so all expected realms are created.",
    type: "fix",
  },
  {
    date: "2026-02-18",
    title: "Smoother Worldmap Chunking",
    description:
      "World map chunk prefetching now follows camera direction more accurately and chunk cache sizing is more stable, reducing pop-in and traversal stutter during fast panning.",
    type: "improvement",
  },
  {
    date: "2026-02-17",
    title: "Game Review for Ended Worlds",
    description:
      "Ended games now include a dedicated Game Review flow with final rankings, score highlights, and share-ready recap cards so you can revisit each world after it concludes.",
    type: "feature",
  },
  {
    date: "2026-02-12",
    title: "Building Cost Visual Feedback",
    description:
      "Missing resources in building construction costs now appear in red, making it easier to identify what resources you need to gather before building.",
    type: "improvement",
  },
  {
    date: "2026-02-11",
    title: "Unit Selection Recovery After Moves",
    description:
      "Fixed a case where moved units could become unselectable after rapid chunk camera jumps by automatically recovering stale movement locks and refreshing map state.",
    type: "fix",
  },
  {
    date: "2026-02-11",
    title: "Stable Chunk Refresh Recovery",
    description:
      "Fixed a world map issue where terrain could disappear after rapid cross-chunk movement, so map rendering now recovers automatically without requiring a full reload.",
    type: "fix",
  },
  {
    date: "2026-02-09",
    title: "In-Game Leaderboard Live Updates",
    description:
      "Hyperstructure leaderboard points now refresh automatically while you play, so rankings stay current without reloading or switching tabs.",
    type: "fix",
  },
  {
    date: "2026-02-09",
    title: "Auto-Refreshing MMR Leaderboard",
    description:
      "The Ranked leaderboard now refreshes automatically in the background, so standings update without needing to click Refresh.",
    type: "fix",
  },
  {
    date: "2026-02-05",
    title: "New Landing Experience",
    description:
      "The landing page has been completely redesigned! Browse Live, Upcoming, and Ended games in organized columns. Register for games directly from the home screen. Faster game loading with instant entry - you'll land right at your realm. Mobile users get a new hamburger menu and contextual bottom tabs that change based on your current section.",
    type: "feature",
  },
  {
    date: "2026-01-19",
    title: "Mobile Game Registration",
    description:
      "The game registration flow is now fully responsive. Mobile and tablet users can now select worlds, connect accounts, and create avatars with an optimized touch-friendly interface.",
    type: "improvement",
  },
  {
    date: "2026-01-17",
    title: "Chat Room Subscriptions",
    description:
      "Chat now joins only the room you're viewing, reducing background traffic while keeping messages responsive.",
    type: "improvement",
  },
  {
    date: "2026-01-15",
    title: "Open Loot Chests",
    description:
      "Open loot chests directly from the Cosmetics section. Select from your owned chests, watch the animated opening sequence, and reveal your rewards with a premium card reveal experience.",
    type: "feature",
  },
  {
    date: "2026-01-14",
    title: "Prediction Market: Combined Claims",
    description:
      "When claiming from a resolved prediction market, your position winnings and vault fees are now claimed together in a single transaction. The displayed amount shows the combined total for a smoother experience.",
    type: "improvement",
  },
  {
    date: "2026-01-14",
    title: "Prediction Market: Custom Odds",
    description:
      "Create prediction markets with customizable player weights and odds. Select 1-5 players, adjust individual weights, and see real-time percentage chances. The 'None of the above' option is also customizable. Minimum funding reduced to 100 LORDS.",
    type: "feature",
  },
  {
    date: "2026-01-13",
    title: "Transaction Status Center",
    description:
      "A new transaction center is now available in the bottom-right corner. Track all your pending, confirmed, and failed transactions in real-time with a status beacon indicator. Click on any transaction to view details on Voyager.",
    type: "feature",
  },
  {
    date: "2026-01-13",
    title: "Unit Ownership Indicators",
    description:
      "Colored indicator dots now appear above units to clearly show player ownership. Your units display green dots, allies show blue, enemies have distinct colors, and AI agents show gold/amber dots for instant recognition during gameplay.",
    type: "improvement",
  },
  {
    date: "2026-01-09",
    title: "Troop Balance Update",
    description:
      "Paladin stamina has been increased to 120, and mercenary troop bounds have been adjusted to 800-1600 for improved balance.",
    type: "balance",
  },
];
