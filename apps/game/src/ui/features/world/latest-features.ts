type FeatureType = "feature" | "improvement" | "balance" | "fix";

interface LatestFeature {
  date: string;
  title: string;
  description: string;
  type: FeatureType;
  gameSlug?: string;
  readMore?: string;
}

const MAX_LATEST_FEATURES = 8;

const latestFeatureTypePriority: Record<FeatureType, number> = {
  fix: 0,
  feature: 1,
  improvement: 2,
  balance: 3,
};

const compareLatestFeatureDatesDescending = (left: LatestFeature, right: LatestFeature) => {
  const timestampDifference = new Date(right.date).getTime() - new Date(left.date).getTime();
  if (timestampDifference !== 0) return timestampDifference;
  const typePriorityDifference = latestFeatureTypePriority[left.type] - latestFeatureTypePriority[right.type];
  if (typePriorityDifference !== 0) return typePriorityDifference;
  return left.title.localeCompare(right.title);
};

const buildLatestFeaturesFeed = (features: LatestFeature[]) =>
  features.toSorted(compareLatestFeatureDatesDescending).slice(0, MAX_LATEST_FEATURES);

// Curated, deduplicated news feed. Same-day iteration churn and dev-only entries
// are collapsed into single player-facing items; only the latest MAX_LATEST_FEATURES
// are surfaced in the What's New popup.
const allLatestFeatures: LatestFeature[] = [
  {
    date: "2026-10-18",
    title: "Ring badges no longer overlap",
    description:
      "A resource ring's building count and its time left share the top of the ring and never cover each other or the next ring. The time shows its largest unit (7h, 2d, then weeks or years for long ones), and production that never runs out, like a farm's wheat, shows no countdown. Screen readers hear the full time left, or that production never runs out.",
    type: "fix",
  },
  {
    date: "2026-10-18",
    title: "Clearer resource and landmark icons",
    description:
      "Icons fill their frames. Production resources return to their familiar designs, Research has teal liquid, and landmarks show the built Hyperstructure and chest without its tile.",
    type: "improvement",
  },
  {
    date: "2026-10-18",
    title: "Relic artwork comparison",
    description:
      "The resource icon lab compares the original relic designs with painted Facets versions at four sizes. The game keeps the original relics during review.",
    type: "improvement",
  },
  {
    date: "2026-10-18",
    title: "Recognizable resources and landmarks",
    description:
      "Essence and Research have distinct icons, the original relic symbols return, and Farm, Workers Hut and map landmarks match their game models.",
    type: "improvement",
  },
  {
    date: "2026-10-18",
    title: "Deploy an army by troop column",
    description:
      "The map's deploy picker and the Military window now lay out troops the same way: a column per troop with its three tiers always in the same place, an empty one dimmed, then the amount with +500 and Max. Deploy carries its cost, and says in one line why it cannot go. Reinforcing a guard offers only the troop already in it. The Military window keeps its map for where a field army steps out.",
    type: "improvement",
  },
  {
    date: "2026-10-18",
    title: "Military, rings and the leaderboard in the new style",
    description:
      "The resource rings, the leaderboard and tribes, the Military form and deploy picker, Combat, the attack preview, troop and relic transfers, chat, the crate panel and Frontier's season screens (the season's end, the standings, a realm's detail and a visit) now wear your game's colours and the one set of buttons, tabs, fields and chips. A ring's rim shows whether it is producing. Disbanding an army or dismissing a guard acts at once in Blitz and Eternum, and asks first only in Frontier, where it cannot be undone.",
    type: "improvement",
  },
  {
    date: "2026-10-18",
    title: "Camps and rifts have names",
    description:
      "Every camp and rift on the map now carries a short name of its own, the same for every player (\"Grimtear\"), and no label shows an id. At rest a label says only who or what it is and its guard; hover it for the rest: an army's home and exact stamina, a realm's guard slots and the troops on their way (when they arrive first), a camp's or rift's kind and the Labor or Essence it holds. A stamina wait now counts to the second: \"ready in 24s\".",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "Tidier text sizes",
    description:
      "Titles, figures and labels outside a game now share one set of sizes: page titles, profile names, reward figures, the sign-in code and the lobby's entry rows moved by a few pixels, and Play's headline and a reward's multiple grew slightly.",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    type: "feature",
    title: "The mist returns",
    description:
      "At game end, spires contract their orbs and release a fractured veil across the map. Frontier keeps your realm clear. Results stays available; Escape skips the animation from either map or realm view, then works as usual.",
  },
  {
    date: "2026-10-17",
    title: "Events keep the last three, and filter",
    description:
      "The Events strip shows the game's three latest events. It shows the important ones by default (your fights and captures, armies lost, crates you opened, and any Hyperstructure taken); switch to Mine or All in its header. The Log uses the same filter, and it is remembered for you. Notices and the game's milestones show above it as they happen.",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "Leaderboard headers on two lines",
    description:
      "Each leaderboard column reads its short name on one line and its points under it on the next: Tiles 5 each, Crates 250 each, Camps & Rifts 250 each, HS taken 1K each, HS held x/s. Hover a column for its full rule.",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "Next up: the one step that scores now",
    description:
      "Next up shows the step that scores most for where you are: open a crate your army stands beside, explore, go for a crate or a camp, or level up first when an attack would wipe your army out. After a loss it raises the next army where your troops are. Paging to other steps is a look: it comes back to the current one. The camera frames what it shows clear of the side panels, and Events and the Log tell every event in the same sentence, with what came of it.",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "Map labels you can read at a glance",
    description:
      "Every army, realm, camp and rift on the map wears a small label in the HUD's panel style: an army's player over its troops and stamina, a realm's player and rank (City, Kingdom, Empire) over its name and guard, or Undefended, and a camp or rift's reward (\"Essence Rift | 1,200 Essence\", \"Camp | 250 points\") over its guard. Hover a tile, or select it, to open its label: an army's home realm, a structure's guards in the order an attacker meets them, and troops on their way.",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "Advice you can follow",
    description:
      "A certain-loss forecast now asks only for an army your realm can hold, and when it cannot, says to level the realm up, which of your realms can raise it now (troops on hand, a free army slot, the cap), or the troops to train there first. After raising an army the Military window stays on Attack, and a full army cap reads as a note, not an error. ",
    type: "fix",
  },
  {
    date: "2026-10-17",
    title: "Hovers that explain",
    description:
      "A realm's level-up says why it waits, what it costs (or that it is free) and what the level gives, and every window shows the same level number. The realm card's numbers, automation and the order buttons explain themselves on hover, and relics say what they do, for how long and for how much Essence. An army standing on an opened crate shows first.",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "Points first",
    description:
      'The top bar says how to win ("Most points in 1h wins") beside your points, and the start banner says what scores. Next up walks a first game by points: raise an army, explore, open a crate, take a camp or rift, then a Hyperstructure, and says when an army falls. Events rows say what came of each action, and the game says points everywhere.',
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "Build cards say what they cost and make",
    description:
      "Each building in the Build window shows what it makes, named and per minute (+360 Wheat / min, +6 population cap), and what it costs with what you have (10 Labor (you have 1,574)). The switch reads Pay with Resources or Labor.",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "Clearer armies and attacks",
    description:
      "A resource you find mid-game (your first Essence) now joins the end of your realm's rings instead of moving them all. The Military window says what you have on hand and which army cap applies, and when you have none, which barracks trains the troop and from what. A forecast that your army would be wiped out at any roll now says so in red, with about how many more troops would survive, and Attack steps back.",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "Leaderboard scoring",
    description:
      "The leaderboard's columns say what each action earns in points, read from the game: 5 points a tile, 250 points a crate or camp, 1K points a hyperstructure taken, and points every second for a hyperstructure held (each pays by the realms around it). Opening a player shows only what earns them points: their points by activity and the hyperstructures paying them, with a button to go to each.",
    type: "fix",
  },
  {
    date: "2026-10-17",
    title: "One panel style",
    description:
      "Every HUD panel now looks like the picked tile's: the holdings, the selected realm, the minimap, Next up, the events and the standings share one frame and one title band, and their text reads a step larger in the same space.",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "The map says what a right-click does",
    description:
      "With an army selected, hover a tile: it says what a right-click does there, what it costs and what it scores (Explore · 21 stamina · +5 points, Open crate · +250 points). Every food an order burns is listed as it is charged, fish too where the game charges it. Where no order is possible it says the rules' reason: the stamina it needs and when it is ready, the food, a structure no army may attack, or a target too far. The line keeps up when that changes under a resting pointer.",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "Production time back on the rings",
    description:
      'Each resource ring shows its production time left on its right (∞ when it never runs out), beside the building count and the amount. Hovering a ring now just names the resource. When fewer troops fit than you hold, the troop amount reads "of 500 that fit", so Max and +500 are clear.',
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "Captures tell both sides",
    description:
      "A realm's owner now learns who took it: Events and the Log tell the capture to both sides, even after time away, and a notification reaches them. Both are told that the realm's armies and incoming deliveries went with it.",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "Minimap follows the camera again",
    description:
      "The minimap centres on the camera and zooms with it, closer than the whole map it showed before. Names shown on hover, such as a resource ring's, now draw above every panel instead of under the next row.",
    type: "fix",
  },
  {
    date: "2026-10-17",
    title: "Transfer, Arrivals, Automation, Balances: one window, four tabs",
    description:
      "The Transfer window's views are tabs again, and switching away keeps what you were about to send. Send from, Send to and the goods each sit in their own panel, and each list leads with its kinds as tabs (Realms, Camps, Essence Rifts).",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "+500 is back",
    description:
      "Wherever you choose how many troops go (deploying an army, the Military window, transferring troops), +500 adds 500 with each press, up to what you can send, beside Max.",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "Transfers say when they land",
    description:
      "The Transfer window, bank swaps and the Log's delivery rows now tell when goods land, as the game delivers them: at the end of the 3-minute delivery window their road ends in, troops riding slower. Essence Rifts are listed as Essence Rifts.",
    type: "fix",
  },
  {
    date: "2026-10-17",
    title: "Transfer from the map",
    description:
      "With a holding chosen in the holdings list or on the map, right-click another of yours: the Transfer window opens between the two. Its holding lists show long names in full, and donkeys are called donkeys.",
    type: "fix",
  },
  {
    date: "2026-10-17",
    title: "Fights end the way they did",
    description:
      "A fight's line in Events and World history now names its winner exactly as the battle decided it, a guard's win included. A fight both sides survive reads Draw, and one neither survives reads Both sides fall.",
    type: "fix",
  },
  {
    date: "2026-10-17",
    title: "Create field army stays put",
    description:
      "The deploy and Military buttons keep their place when their reason (such as Choose a troop count.) comes and goes, so pressing Max no longer moves the button out from under your click.",
    type: "fix",
  },
  {
    date: "2026-10-17",
    title: "Clearer events and log",
    description:
      "Each event stays its full 20 s on screen before it fades and leaves, and each action is one row. An opened crate's row takes you to what holds its relics, the army or the realm. The log tells each action once and names what it is about in plain words. The minimap takes the shape of the map it shows, the realm card shows all its relics, and labels on the map stay clear of the side panels.",
    type: "improvement",
  },
  {
    date: "2026-10-17",
    title: "Transfers open without errors",
    description:
      "Transfer windows no longer greet you with a red error. What is still to choose is the button's own words (Choose an amount, Choose where to send), and what keeps a transfer closed, such as a full guard slot, is said calmly. Red is kept for an action that failed.",
    type: "fix",
  },
  {
    date: "2026-10-17",
    title: "Troop kinds named when deploying",
    description:
      "The deploy picker names Crossbow, Knight and Paladin over their columns, as the Military window does, and your row on the leaderboard shows your name like everyone else's, without an address under it.",
    type: "fix",
  },
  {
    date: "2026-10-17",
    title: "A simpler deploy",
    description:
      "Deploying an army takes one row: type the amount or press Max, beside how many can go. Deploy shows what it costs, and when it cannot go it says why in a few words.",
    type: "improvement",
  },
  {
    date: "2026-10-16",
    title: "Attack forecast names both sides",
    description:
      "The attack forecast's title now reads you against the target's owner (or the Vanguard), in full. What each side loses and who survives stays in the casualty lines, with the exchanges and stamina the fight takes just below them.",
    type: "improvement",
  },
  {
    date: "2026-10-16",
    title: "Official LORDS token mark",
    description:
      "LORDS amounts use the official vector token symbol, sharp at every size, in your purse, entry fees, rewards and resource transfers.",
    type: "fix",
  },
  {
    date: "2026-10-16",
    title: "Your MMR if the game ended now",
    description:
      "In a paid, rated Blitz the leaderboard shows each player's rating gain or loss if the game ended with the standings as they are, worked out by the ledger exactly as it settles the result. Free games show no MMR.",
    type: "feature",
  },
  {
    date: "2026-10-16",
    title: "A leaderboard that fits",
    description:
      "The leaderboard window is as large as its table and rows, in the HUD's teal and type. Each activity column shows the points it grants under its name; hover it for the rule in full.",
    type: "improvement",
  },
  {
    date: "2026-10-16",
    title: "One Transfer window",
    description:
      "Transfer lists your holdings as the holdings list does, sends any goods to several holdings at once with each total split evenly, and opens from the map: select a holding, right-click another of yours. Arrivals, Automation and Balances are a click away.",
    type: "feature",
  },
  {
    date: "2026-10-16",
    title: "A tighter HUD",
    description:
      "Panels fit their contents and read at the top bar's size, the minimap is taller and fits what you have explored, and every resource ring shows its buildings top-left and its amount below. The picked tile shows its structure and biome together, events take two lines and fade, an opened crate's event selects the army holding its relics, relics read larger, the clock shows only the game's time left, and Next up's tips can be turned off in Settings.",
    type: "improvement",
  },
  {
    date: "2026-10-16",
    title: "Keys for the HUD",
    description:
      "B, P, M and T open Build, Production, Military and Transfer, Space takes Next up's step, and I selects your next idle army (full stamina, no order), as does the new Idle button on the minimap. No key fires while you type.",
    type: "feature",
  },
  {
    date: "2026-10-16",
    title: "A new HUD for Blitz and Eternum",
    description:
      "Your holdings sit on the left, one kind at a time under tabs. Star a realm to pin it to the top, and provision or level it up from its row. The selected realm's card shows its resources five to a row, its relics, population and automation, with a taller minimap under it. On the right, Next up tells you what to do next, the events stay on, and a picked tile shows its structure or army and its biome as tabs. The four orders are round buttons at the bottom. It reads in Exo 2 with Cinzel titles on teal glass, nothing smaller than 14 px.",
    type: "feature",
  },
  {
    date: "2026-10-16",
    title: "Trade opens again",
    description:
      "Opening Trade in an Eternum game no longer stops the game: every resource and relic in the market shows its painting.",
    type: "fix",
  },
  {
    date: "2026-10-16",
    title: "A leaner leaderboard",
    description:
      "The in-game leaderboard is one ranked list of every player, kept current as points land: the search field, the refresh button and the Results tab are gone.",
    type: "improvement",
  },
  {
    date: "2026-10-16",
    title: "New T1 Knight model",
    description: "T1 Knights now carry the new armour, sword and shield, with lighter geometry at gameplay distance.",
    type: "improvement",
  },
  {
    date: "2026-10-16",
    title: "Blitz guards and spire jackpots",
    description:
      "Camps and Essence Rifts have one T1 guard of 999–1,499 troops, with equal chances of Knight, Paladin or Crossbowman. Each Hyperstructure has three T2 guards of 1,499–1,999 troops each. Dormant spires still appear on one explored hex in two hundred and pay a flat 1,000 Essence, plus your active Exploration relic bonus, regardless of army size or tier.",
    type: "balance",
    gameSlug: "blitz",
  },
  {
    date: "2026-10-16",
    title: "Larger realm minimap emblems",
    description: "Realm paintings fill more of their minimap hex, with ownership colours and level numbers kept clear.",
    type: "improvement",
  },
  {
    date: "2026-10-16",
    title: "Recognize each realm level",
    description:
      "Realm portraits and minimap badges now follow each level’s buildings: canvas and thatch, the city forum, twin towers and the imperial spire.",
    type: "improvement",
  },
  {
    date: "2026-10-16",
    title: "The command sidebar is back",
    description:
      "Blitz and Eternum use the command sidebar again: your structures and the selected one's panel and actions on the left, events and the selected tile on the right, and the Empire, Map, Log, Chat and Details tabs on a phone.",
    type: "improvement",
  },
  {
    date: "2026-10-16",
    title: "Warm windows in realms",
    description:
      "City and kingdom windows glow with warm glass. Imperial upper windows share that light, with wooden shutters on the lower floor.",
    type: "improvement",
  },
  {
    date: "2026-10-16",
    title: "Clearer realm entrances",
    description:
      "Settlements use Canvas & Thatch with your Order and ownership colours. Terrace Forum has unobstructed upper windows and larger doors; Twin Ward has plain upper windows, cleaner lower walls and larger entrances.",
    type: "improvement",
  },
  {
    date: "2026-10-16",
    title: "Full windows open centred",
    description:
      "Windows such as Transfer Troops & Relics, spire travel, relic crafting and battle details now open in the middle of the screen instead of next to the army or button that opened them, so they no longer spill off the edge. Every full window, Build and Production included, opens there each time, even after you dragged one aside.",
    type: "fix",
  },
  {
    date: "2026-10-16",
    title: "Village tents stay in view",
    description:
      "Village cottages sit toward the side fences, opening the hearth yard and the view of the small tent beside the rear canvas shelter.",
    type: "improvement",
  },
  {
    date: "2026-10-16",
    title: "Crates say where relics went",
    description:
      "An opened relic crate's feed row and log line now name its pack and where its relics went: army relics to the army that opened it, realm relics to that army's home realm, where the realm's card lists them. A dormant spire now stands on its hex without a name over it.",
    type: "fix",
  },
  {
    date: "2026-10-16",
    title: "Preview the building you place",
    description:
      "Construction cards now show the game’s building models, including farms, workshops and markets. Action and resource icons keep their painted artwork.",
    type: "fix",
  },
  {
    date: "2026-10-16",
    title: "Explore with small armies, fight with big ones",
    description:
      "In Blitz, a reveal now finds a share of the exploring army's strength up to 3,000 (3,000 T1, 1,000 T2 or 334 T3): at that size a tile finds 150, 300 or 600 Essence, 300 or 600 labor, or 300 donkeys, and a smaller army finds its share of that. A bigger army finds no more, and neither does a dormant spire pay more, so explore with small armies and keep the big ones for battle.",
    type: "balance",
  },
  {
    date: "2026-10-16",
    title: "Big Blitz armies eat on the march",
    description:
      "In Blitz, moving and exploring each cost 0.05 wheat per troop per hex. A 1,000-troop army pays 50 wheat a step; a 20,000-troop army pays 1,000, so moving a big army needs farms behind it.",
    type: "balance",
  },
  {
    date: "2026-10-16",
    title: "Clear device limit recovery",
    description:
      "If eight devices already use your account, game entry explains how to remove one from a signed-in device and try again.",
    type: "fix",
  },
  {
    date: "2026-10-16",
    title: "Shadows hold still",
    description:
      "The sun now lights the map from one direction all day, so shadows no longer creep and shimmer as the day turns. Day and night still colour the world.",
    type: "fix",
  },
  {
    date: "2026-10-15",
    title: "Your army stays selected",
    description: "After you order an army to move or explore, it stays selected, ready for its next order.",
    type: "improvement",
  },
  {
    date: "2026-10-15",
    title: "Painted icons across the game",
    description:
      "Resources, soldier tiers, buildings and actions share the Facets paintings across the map and every page. Transfer shows a loaded donkey; Production shows a forge. Hex minimap badges repeat ownership with colour and shape.",
    type: "improvement",
  },
  {
    date: "2026-10-15",
    title: "The command sidebar is back",
    description:
      "Blitz and Eternum return to the left command sidebar, the structure list, the empire cockpit and the fading events, in the readable type. A realm's level-up and a suggested level-up are sent the one way the castle sheet sends them.",
    type: "improvement",
  },
  {
    date: "2026-10-15",
    title: "Realms grow through the ages",
    description:
      "Canvas & Thatch, Terrace Forum and Twin Ward lead to the imperial citadel. Each age has its own wonders, rising magic and your Order on its banners.",
    type: "improvement",
  },
  {
    date: "2026-10-15",
    title: "Mist at the frontier",
    description:
      "Moving mist marks the edge of explored land. Frontier takes on warm Ember light and darker mist; Blitz keeps its familiar lighting.",
    type: "improvement",
  },
  {
    date: "2026-10-15",
    title: "Open yards around village cottages",
    description:
      "Village cottages sit clear of the fence, with lower roofs, a shared hearth and room to walk around them.",
    type: "improvement",
  },
  {
    date: "2026-10-15",
    title: "Canvas and thatch villages",
    description:
      "Villages combine thatched cottages, canvas shelters and a shared hearth, with your colors on their standard and tent trim.",
    type: "improvement",
  },
  {
    date: "2026-10-15",
    title: "Relic crates hold themed packs",
    description:
      "Each Blitz relic crate now holds one pack of three relics, named on its tile before you open it: War, Explore, Produce or Fortress. Army relics go to the army that opens it, realm relics to its home realm. One crate in five is lucky and holds the whole pack at level II. Labor Production Relic II now adds 40%, twice level I.",
    type: "balance",
  },
  {
    date: "2026-10-15",
    title: "Bigger armies find more",
    description:
      "In Blitz, what a reveal finds now grows with the army that explores: a share of its troops times their tier (1 for T1, 3 for T2, 9 for T3), so a 1,000-troop T1 army finds what every army found before. One reveal in two hundred finds a dormant spire: your realm receives a flat 1,000 Essence plus any active Exploration relic bonus, and the spire stays on its hex, blocking it and doing nothing else.",
    type: "balance",
  },
  {
    date: "2026-10-15",
    title: "The map opens on your realm",
    description:
      "Entering a game, the map now opens where your realm is, or the realm you watch, instead of reloading the page the first time you open it. Watching a Frontier season, Map stays on the map instead of returning to the watched realm.",
    type: "fix",
  },
  {
    date: "2026-10-15",
    title: "Blitz ends on time",
    description:
      "Every Blitz keeps its scheduled start and end. Entry closes five minutes before the start; if placing every player's realms runs late, the game opens as soon as the last realm is placed and still ends on schedule.",
    type: "improvement",
  },
  {
    date: "2026-10-15",
    title: "One troop type per realm",
    description:
      "Each of your three Blitz realms starts with 1,000 T1 troops in its garrison and 1,000 in reserve: one realm Knights, one Crossbowmen, one Paladins, in an order drawn for you.",
    type: "balance",
  },
  {
    date: "2026-10-15",
    title: "Merge armies across realms",
    description:
      "Your armies from different realms can now merge when they hold the same troop type and tier, in every mode.",
    type: "balance",
  },
  {
    date: "2026-10-15",
    title: "Play from a game you watch",
    description:
      "Watching a game where you hold realms now offers Play from your name chip, and pressing it brings you straight into your own realms instead of waiting on your account.",
    type: "fix",
  },
  {
    date: "2026-10-15",
    title: "Places across the top",
    description:
      "On a desktop, Play, Season and You now sit in a bar across the top, keys 1 to 3 as before, and every page starts its content right under it. A Blitz result opens on your score card, the one you share after a game, stacked on a phone so every word reads at full size.",
    type: "improvement",
  },
  {
    date: "2026-10-15",
    title: "Rifts within fallen walls",
    description:
      "Fallen realms show rubble in their courts and violet fissures within broken walls, around the same guarding beasts.",
    type: "improvement",
  },
  {
    date: "2026-10-15",
    title: "The clock opens with the game",
    description:
      "The game clock and the start notice follow the chain, so a Blitz no longer shows as running minutes before your orders can go through.",
    type: "fix",
  },
  {
    date: "2026-10-15",
    title: "Crate points and relic names",
    description:
      "A relic crate shows the victory points it really grants, and each relic keeps one name in the crate, your stocks and the game's history.",
    type: "fix",
  },
  {
    date: "2026-10-15",
    title: "Results after the end",
    description:
      "When a game ends, Game finished, the game's doorway and its map's address all lead to its Results page: your place, the standings and your rewards.",
    type: "fix",
  },
  {
    date: "2026-10-15",
    title: "Distinct outposts and discoveries",
    description:
      "Spot camps, villages and stranded companies by their silhouettes, with new shrines and wells on the world map.",
    type: "improvement",
  },
  {
    date: "2026-10-15",
    title: "See everything a player holds",
    description:
      "Selecting a realm on the world map rings every structure and army its owner holds, yours or another player's, so their reach shows at a glance. The rings follow captures and moves, and clear with the selection.",
    type: "feature",
  },
  {
    date: "2026-10-14",
    title: "Three places: Play, Season, You",
    description:
      "The app now has three places. Season shows one board per mode, and Blitz's rating board carries the prize each place would take if the season ended now. You holds your card, your finished games and one Settings page for your account, payout wallet, notifications, music and devices, plus How to play and What's new. The Blitz lobby counts down to one moment at a time, and a result's chest Open is its main button.",
    type: "improvement",
  },
  {
    date: "2026-10-14",
    title: "Leaderboard fits a phone",
    description:
      "On a narrow screen the leaderboard shows rank, name and points in full, with what each player did written under their name.",
    type: "fix",
  },
  {
    date: "2026-10-14",
    title: "Give an army its next order while it moves",
    description:
      "An army stays selected after you order it. Tap a tile while its order is on its way and that tile becomes its next order, shown in the order bar: it leaves as soon as the first one lands. A later tap replaces it, and Cancel or Escape drops it.",
    type: "feature",
  },
  {
    date: "2026-10-14",
    title: "Play shows what you can do now",
    description:
      "Play leads with your next step and one button, lists everything under way with its own (resume your day, watch a match), and keeps each mode's next and finished games behind a switch. Results of any game you have not opened appear there, and signing in or linking a wallet from a Blitz lobby brings you back to it.",
    type: "improvement",
  },
  {
    date: "2026-10-14",
    title: "One readable typeface",
    description:
      "Everything you read is set in one legible face at 14 px or larger, in sentence case, with enough contrast on every panel.",
    type: "improvement",
  },
  {
    date: "2026-10-14",
    title: "One lab for every tool",
    description:
      "Art, character, renderer and interface tools share one lab selector. Model review and terrain captures keep their existing addresses.",
    type: "improvement",
  },
  {
    date: "2026-10-14",
    title: "Neutral tone mapping control",
    description:
      "Graphics debug controls expose Neutral tone mapping alongside the existing renderer modes and exposure slider.",
    type: "improvement",
  },
  {
    date: "2026-10-14",
    title: "Army highlights hold still",
    description:
      "Fixed the hexes around a selected army flashing out and back in every few seconds. They now stay put while nothing changes, and when a tile becomes reachable, such as once stamina refills, only that tile appears.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "Armies answer right after an order",
    description:
      "Fixed the wait before an army you just ordered could be picked again: a click on the tile it is heading to selects it at once, and its next orders show as soon as the game has applied the last one, without waiting for its walk to end or a second click.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "Relics last their full duration",
    description:
      "Timed relic bonuses now start when you apply them and last their full duration. Their remaining time follows confirmed blocks.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "Production and stamina follow blocks",
    description:
      "Stores, barracks and armies earn each elapsed second at the same rates. Their figures advance with confirmed blocks, so what you see is available to spend.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "Blitz opens for its players",
    description:
      "Fixed the game view failing as a player entered a Blitz game: a realm's stores are read as not known yet for the moment your account's view of the world is being loaded, and the panels fill in as it arrives.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "Phone sheets keep their margins",
    description:
      "Fixed Settings and the account sheet running into the screen's left and right edges on a phone: they keep the same margin as every other panel.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "A cleared site pays on screen",
    description:
      "Fixed clearing a camp, a rift, stragglers or a ruin passing in silence: the guard now falls with its dust, what the site paid flies home to its counter, and a ruin's chest opens, with the losses of the attack that won it.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "Community links on a phone",
    description:
      "Added Discord, X, Telegram and GitHub to Profile on a phone, which has no footer to hold them; each opens in a new tab.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "Stores read aloud in full",
    description:
      "Changed the four stores on Frontier's top bar: each one's full line (Wheat 1,771 of 6,000, its rate an hour and when it is full) is now also what a screen reader says, the same words its tooltip shows.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "A Blitz slot that is opening",
    description:
      "Fixed a Blitz slot's page saying The ledger did not answer, with Try again and a dash for its registrations, in the minute between a slot being listed and its entry opening: it now says Entry is opening, shows 0 registered, and opens by itself a few seconds later. A read that really failed keeps its line.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "A day log in plain names",
    description:
      "Changed Frontier's Today: a reveal reads as a whole number (+98 labor), a building is one line by its build card's name (Farm built), an army is Army 1, and each of the six totals names itself on hover or hold. Production writes Wheat, Labor and Troops beside their icons.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "Your wallet opens by itself",
    description:
      "Changed paying from your linked wallet: Pay & join, a refund, a prize claim, a chest and the dev build's test-token mint now open that wallet's own prompt at once, with no wallet to pick again each time. If the wallet is on another account, one line names the linked one.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "Chat comes back by itself",
    description:
      "Fixed chat staying on Chat unavailable until a reload after its connection dropped: the room and your inbox now reconnect on their own, and the panel says Reconnecting while they do.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "A clearer screen, bigger targets",
    description:
      "Changed several things that covered each other in Frontier. On desktop, chat now starts closed and opens from its tab, so it no longer hides the guide. The Updating terrain message is gone. On a phone, the LORDS button steps aside while Chat, Research or the season board is open, every control in chat is tall enough to tap, and the guide's mark sits beside what it points at instead of on top of the figures.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "No answer yet, said plainly",
    description:
      "Changed the event feed's line for an action the game has not answered: it now says No answer yet, that the action may still apply and that you can try another, where it used to stay on Checking and count as still in flight.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "Explored tiles keep their ground",
    description:
      "Fixed explored tiles staying black when part of the map's terrain could not be built: that part is now drawn as plain explored ground, without its trees, roads or settlement ground, instead of not at all. A structure of a kind this version does not know also keeps its marker in the far view instead of stopping the others.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "A map that cannot be drawn says so",
    description:
      "Changed what you see when the map fails to open on the way into a game: the screen now says the map could not be drawn, instead of blaming the world, and offers Open realm beside Try again, so you can still reach your realm, build and research while the map is unavailable.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "Every action waits in its place",
    description:
      "Fixed building, deploying, research, the castle's upgrade, an army's refill and its tier upgrade in Frontier: a second press no longer sends a second time, and a refusal is no longer silent. The sheet still closes as the action leaves; the wait then shows where you look next, a ghost on the plot, Deploying… on the dock's open slot, Upgrading… or Researching… on the Research row, and the button itself on the castle and the army. If the game refuses, or no answer comes, one line says so and the control is free again.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "A victory shows what it paid",
    description:
      "Changed the Victory card in Frontier: the reward is the one the clear itself recorded, where it used to repeat the preview's figure. When the store that took it is at its limit, the figure carries a Full mark, and its tooltip says the rest did not fit.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "The forecast is this attack",
    description:
      "Fixed the attack forecast in Frontier disagreeing with the fight's result. When a fight takes several attacks, the forecast used to add up the losses of all of them, while Attack sends one and its result showed that one. The forecast now shows what this attack costs you and the guard it leaves, exactly as the result will read; the pips still count the attacks the whole fight takes.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "A fight's result is the fight's own",
    description:
      "Fixed the result of an attack in Frontier: it is now read from the battle's own record, so an army lost in a fight reads Army lost with the guard as the battle left it, and can no longer read Victory with a payout when its region left your map with it. An attack the game refused shows no result at all, only why. A black tile now says Unexplored when you hover it.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "A sent order stays sent",
    description:
      "Fixed orders in Frontier that looked as if they had not left: after you attack, the button reads Attacking… until the fight's own result arrives, where it used to fall back to Attack for several seconds. An army whose order is still on its way takes no second one, on the map or on a card, so a second press never sends a second transaction. If the game refuses an order, or it cannot be sent, one line says why and the army is free again.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "Sites show their strength",
    description:
      "Changed the plate over a Frontier camp, rift, ruin or band of stragglers: it now reads the site's kind and the strength of its guard, such as Camp 1.2k, instead of a long id, and is always shown. The wide second label with its empty picture frame is gone, and plates sit just over the roof so they no longer cover a unit standing behind.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "The season board opens from Menu",
    description:
      "Changed the Frontier season board: it no longer sits over the map on desktop, and opens from Menu, Season on every screen. Its two number columns say what they count when you hover their icon or press and hold it, and a name you have just claimed shows at once.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "Armies wear a number",
    description:
      "Changed the plate over each of your Frontier armies: it now shows the army's number and its stamina bar, sits on the unit instead of a tile above it, and keeps one readable size at every zoom and on a phone. The army's card carries the same number, and the second label that used to open over your own army is gone.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "Buildings show what they make",
    description:
      "Added to every building's panel in Frontier what it makes an hour, how many stand, what its store holds and the population it takes. The castle shows the labor it makes by itself and the labor it holds.",
    type: "feature",
  },
  {
    date: "2026-10-13",
    title: "The fast order is back",
    description:
      "Restored the fast order in Frontier: with an army selected, a right-click on a highlighted tile, or a press-and-hold on a phone, sends the explore or the move at once, with no preview. A click or a tap still opens the preview with its costs and its confirm, and the tile's tooltip says which is which. An attack is never sent unseen: either gesture opens its forecast. The preview still stays on the tile you chose while the pointer moves, Esc backs out one step, and Enter confirms the open preview or puts the cursor in chat.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "Numbers stay after an action",
    description:
      "Fixed the top bar and the army cards turning into dashes for a second or two after every move, explore, build or deploy: Essence, wheat, troops and each army's stamina now stay on screen while the action lands.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "The game leaves the page with you",
    description:
      "Fixed the game's view staying on the app's pages after you left a match: it showed under the footer of Play and Learn and kept drawing. Outside a match it is off the page and at rest, and it returns when you go back in.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "The guide says the rules",
    description:
      "Added six first-time lines to the Frontier guide, each with the game's own numbers: when population runs out, when you first select an army (what exploring, moving and attacking cost in stamina), your first XP, a guard beside your army, your first look at Research, and the day's last hour. Menu, Guide now lists every line you have seen, to read again, with a switch to turn the guide off.",
    type: "feature",
  },
  {
    date: "2026-10-13",
    title: "Deploy opens at half",
    description:
      "Improved the Deploy sheet in Frontier: the slider opens at half your troops, so there is something left for the day's other armies, with Minimum and Maximum as buttons on its two ends. Every figure on the sheet says what it is when you hover it or press and hold it.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "XP says what it buys",
    description:
      "Improved the army card in Frontier: XP is written beside its number on desktop, over a thin bar toward the next attribute tier it buys, with a pip for each tier the army has reached. Hover the XP, or press and hold it on a phone, to read the goal.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "One sheet for every attack",
    description:
      "Changed attacking in Frontier: another player's army now opens the same sheet as a camp or a rift, with the same forecast, Attack and result, instead of the older popup. Another player's realm is no longer offered as a target there, since Frontier only allows attacks on what nobody owns. A realm's own guard striking an army beside it, and an attack through a spire, still use the older popup.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "Panels end in their action",
    description:
      "Improved the Castle, building and Research panels in Frontier: Upgrade and Research always stand at the foot with their price, dimmed while they cannot run, over one line that says why and a button for the fix. A tier with two sides says to choose one, and every Research row says what it gives on its tooltip.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "The map names its highlights",
    description:
      "Added a name to every highlighted tile in Frontier: with an army selected, hover a tile and one line says what the army would do there and what it costs, such as Unexplored · Explore · 30 stamina, Move · 10 stamina or Rift · Attack · 30 stamina. On a phone a tap on the tile opens its preview, which names the same action.",
    type: "feature",
  },
  {
    date: "2026-10-13",
    title: "Odds for each army on a site",
    description:
      'Improved a site\'s card in Frontier: with no army chosen, each of your armies is a row showing the fight it would have from where it stands, the same forecast as the attack itself, and the row of dashes is gone. Tap a row to open the attack with that army; the card used to close instead. The skull says "Would be lost" on hover or press-and-hold.',
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "Every fight ends on a result",
    description:
      "Added a result to every attack in Frontier: Victory, Army lost or Guard holds, with your troops and the guard's before and after, and what a clear paid with its XP. It stays in the attack's own sheet until you tap it away, and a ruin's chest now waits for your tap too. The day log names the site, how the attack ended and the numbers instead of \"Battle resolved\", and a lost army's highlights leave the map at once.",
    type: "feature",
  },
  {
    date: "2026-10-13",
    title: "The build menu explains itself",
    description:
      "Improved the Frontier build menu: each building says what it does on its tooltip, a locked training building says what opens it with Research on the button, and a price that has risen carries an arrow that gives the rule.",
    type: "improvement",
  },
  {
    date: "2026-10-13",
    title: "Numbers that stay put",
    description:
      "Fixed the top bar and the army cards turning into dashes for a second or two after every move, build or deploy. What you hold stays on screen until the new amounts arrive.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "A refused build says why",
    description:
      "Fixed the build sheet in Frontier: it shows the realm's free population in its head, a building that cannot rise says what it needs in one line, and the gold button carries the fix, Build Hut or Explore for labor. A Workshop the realm could pay for is no longer refused.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "No more black buildings",
    description:
      "Fixed realm buildings drawing as solid black shapes on some graphics cards. Every building on your realm shows its own colours again.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "Closing a card keeps your place",
    description:
      "Fixed closing a card on the map: the camera no longer jumps back to your realm and your selected army stays selected. A card closed the moment it opened can no longer step the browser back off the game.",
    type: "fix",
  },
  {
    date: "2026-10-13",
    title: "Every icon names itself",
    description:
      "Added one tooltip to Frontier: hover any chip or icon on desktop, or press and hold it on a phone, and it says its name. The four stores say what they hold of their limit, their rate an hour and when they are full.",
    type: "feature",
  },
  {
    date: "2026-10-12",
    title: "Attack with the same tap",
    description:
      "Fixed attacking in Frontier: with an army selected, a click or tap on a target it can reach opens the attack with its forecast and its Attack button, as a tile opens Explore or Move. Attack turns red when the army would be lost, and a line under it says what is missing when it cannot run. On a phone, a card opened by a tap on the map no longer closes at once.",
    type: "fix",
  },
  {
    date: "2026-10-12",
    title: "Plots you can see on snow",
    description:
      "Improved the outline of a realm's building plots: a light line in a dark edge, so it reads on snow and sand as well as on dark ground, and no part of it sinks into uneven ground.",
    type: "improvement",
  },
  {
    date: "2026-10-12",
    title: "Your realm's real surroundings",
    description:
      "Fixed the realm view showing one ground everywhere in Frontier. Each side of the realm now shows the land of the tile beside it on the map, and it updates when a neighbouring tile is explored.",
    type: "fix",
  },
  {
    date: "2026-10-12",
    title: "No stand-in picture for your realm",
    description:
      "Improved the Resume card, the doorway into a game and the day-done card: they no longer show a stock picture of a castle on grass as if it were your realm. The Resume card wears Frontier's painting and names your realm under its Order.",
    type: "improvement",
  },
  {
    date: "2026-10-12",
    title: "Map draws around Frontier sites",
    description:
      "Fixed the map going black on newly explored tiles, or failing to load, once a Rift, a Ruin or Stragglers was in view. Ruins and Stragglers on water now stand on their own island like camps.",
    type: "fix",
  },
  {
    date: "2026-10-12",
    title: "A home page that says things once",
    description:
      "Improved the home page: the community links, the four ages and the news each stand in one place. The community links live in the footer, an age opens from its card beside the play card, and the Scroll is read in Learn.",
    type: "improvement",
  },
  {
    date: "2026-10-12",
    title: "Deploy toward a tile",
    description:
      "Fixed a crash in Frontier when right-clicking a tile beside your selected realm. It now opens Deploy aimed at that tile, and the realm's one-entry map menu and its empty guard line are gone.",
    type: "fix",
  },
  {
    date: "2026-10-11",
    title: "Where a Blitz entry goes",
    description:
      "A Blitz game's pot is now split of the whole: the treasury's cut and the chests' share are each taken of everything paid, and the rest goes to the season's prize pool. The bar under an entry's price shows that split.",
    type: "balance",
  },
  {
    date: "2026-10-11",
    title: "Chest tokens count in entries",
    description:
      "A Blitz chest's token reward is now a multiple of its game's entry: four, two or one entry for the top three rank bands, never less than an entry. A sealed chest shows that multiple, an opened one shows it with the sum sent, and the two lowest bands draw cosmetics and credits only.",
    type: "balance",
  },
  {
    date: "2026-10-11",
    title: "Sign in with email",
    description: "Sign in with an emailed code, with Discord shown only when it is available.",
    type: "improvement",
  },
  {
    date: "2026-10-11",
    title: "A chest's price follows the day",
    description:
      "A Frontier day now sets what a share of a ruin chest pays from the LORDS it has and the chests the day before rolled, never above the season's ceiling. The Season page shows today's price per share beside the ceiling, and its common chest reads at today's price once the day's first ruin is found.",
    type: "balance",
  },
  {
    date: "2026-10-11",
    title: "The season's pool on the Season page",
    description:
      "A Frontier season's Season page now shows the pool of LORDS deposited for the season and how much of it today releases to ruin chests. Before the deposit is published it says so, and no ruin holds a chest until then.",
    type: "feature",
  },
  {
    date: "2026-10-11",
    title: "A sold Realm no longer blocks your labor",
    description:
      "Claim all now grants the labor of every Realm still in your wallet even when one you claimed with before has left it. That Realm is marked Not in this wallet and left out of the claim.",
    type: "fix",
  },
  {
    date: "2026-10-11",
    title: "Blitz entry closes five minutes before the start",
    description:
      "A Blitz slot's entry now closes five minutes before its games start, so every game of the slot is drawn, created and seated before the clock runs. The lobby shows both times.",
    type: "improvement",
  },
  {
    date: "2026-10-11",
    title: "Realm labor in one claim",
    description:
      "Claim all on the Realms sheet now claims every ready Realm's labor in a single request, so several Realms take no longer than one.",
    type: "improvement",
  },
  {
    date: "2026-10-11",
    title: "A linked wallet receives at once",
    description:
      "A newly linked payout wallet no longer waits 24 hours: withdrawals and prizes reach it as soon as it is linked with its signature and the emailed code.",
    type: "improvement",
  },
  {
    date: "2026-10-11",
    title: "Refunds for a replaced wallet",
    description:
      "A Blitz refund owed to a wallet you have since replaced now shows in the Blitz list when that wallet is connected in this browser, and is taken with it.",
    type: "fix",
  },
  {
    date: "2026-10-11",
    title: "Withdraw after the season ends",
    description:
      "When a Frontier season is over, its last card shows the LORDS still in your realm, until when you can withdraw them, and Withdraw. A finished season's Results lead back to it.",
    type: "fix",
  },
  {
    date: "2026-10-10",
    title: "Ratings on the Blitz roster",
    description:
      "A Blitz game's lobby shows each seated player's rating again, read for the wallet their seat was drawn with.",
    type: "improvement",
  },
  {
    date: "2026-10-10",
    title: "Chat in a Blitz slot's lobby",
    description:
      "Once your payout wallet is registered in a slot, you can write in its lobby chat. Everyone signed in can read it.",
    type: "feature",
  },
  {
    date: "2026-10-10",
    title: "Withdraw LORDS and claim Realm labor",
    description:
      "In Frontier, tap your LORDS to withdraw them to your payout wallet and follow the payment to its transaction. Realms in that wallet give labor once a day: add a Realm by its number in the Menu's Realms, then claim them all from there or from the Realms chip.",
    type: "feature",
  },
  {
    date: "2026-10-10",
    title: "Blitz slots show who registered",
    description:
      "A Blitz slot shows how many players registered instead of a row of seats. Your entry reads Registered until the slot closes, then Seated with the way to your game, or Not seated with your refund to take. A closed slot stays in the Blitz list while it owes you a refund.",
    type: "improvement",
  },
  {
    date: "2026-10-10",
    title: "Your Blitz winnings follow your seat",
    description:
      "Results, chests and season prizes are read and claimed with the wallet your seat was played with, even after you change your payout wallet, and the Season tab follows your own games, so a new season's first game never hides a prize still to claim.",
    type: "fix",
  },
  {
    date: "2026-10-10",
    title: "Free Blitz signup removed",
    description: "Blitz no longer offers free signup from the lobby. Entry is paid through a linked Starknet wallet.",
    type: "fix",
  },
  {
    date: "2026-10-09",
    title: "Clearer Blitz results",
    description:
      "The results table now says when it is still waiting for the final result instead of showing an empty game, and the end of a Blitz game is announced once, with its winners.",
    type: "fix",
  },
  {
    date: "2026-10-09",
    title: "No more stuck actions",
    description:
      "Each action in the event feed now says sending, checking, done, refused with the reason, or not sent. An action still being checked no longer holds up your next ones, and an action is only called not sent once the game has confirmed it never arrived.",
    type: "fix",
  },
  {
    date: "2026-10-09",
    title: "Clearer Frontier building plots",
    description: "Removed special plot markers so every available building plot uses the same appearance.",
    type: "improvement",
    gameSlug: "frontier",
  },
  {
    date: "2026-10-09",
    title: "Link Ready by Email",
    description:
      "Added Ready's email wallet to the wallets you can link in Account, so a phone, or a browser without a wallet extension, can link one without installing anything.",
    type: "feature",
  },
  {
    date: "2026-10-09",
    title: "Link wallets before deployment",
    description:
      "Link supported Ready and Braavos wallets with a signed message and email code before sending a transaction.",
    type: "feature",
  },
  {
    date: "2026-10-09",
    title: "Your LORDS under the strip",
    description:
      "Frontier now shows the LORDS your realm holds right under the strip, so the chests you open and the refills you buy read at a glance.",
    type: "improvement",
  },
  {
    date: "2026-10-09",
    title: "Desktop panels dock under the bar",
    description:
      "On desktop every Frontier panel now opens under the place bar, as tall as what it shows, with a close mark or a back arrow, and the bar stays in reach.",
    type: "improvement",
  },
  {
    date: "2026-10-08",
    title: "Frontier, redrawn for phone and desktop",
    description:
      "Frontier's match is rebuilt around the map: one strip with your stores and the day's clock, armies you upgrade with XP, a castle's tree of building tiers and training buildings, Deploy that counts the troops coming home, ruins whose chest opens as you clear them, Today and the Season in the Menu, a guide that points at what it names, and a desktop layout with the same parts at the corners.",
    type: "feature",
  },
  {
    date: "2026-10-07",
    title: "Shrines and wells read right",
    description:
      "Selecting a shrine or well no longer opens an army panel, and armies are no longer offered a move onto one.",
    type: "fix",
  },
  {
    date: "2026-10-07",
    title: "A new home for Realms",
    description:
      "Play opens on one card with your next step (Resume your Frontier day, Enter your Blitz, see a finished season) and the four ages of the lore beside it, each with its own painting and page.",
    type: "feature",
  },
  {
    date: "2026-10-09",
    title: "Email codes protect wallet changes",
    description: "Link, replace or unlink your payout wallet with a six-digit code sent to your verified email.",
    type: "fix",
  },
  {
    date: "2026-10-07",
    title: "Site rewards before attacking",
    description:
      "Frontier site cards show clear XP, the reward that fits at home, and a ruin's stored LORDS and chest tier before you attack.",
    type: "fix",
  },
  {
    date: "2026-10-07",
    title: "Armies Upgrade with XP",
    description:
      "In Frontier, armies spend their XP on the attribute tier you choose instead of levelling, and Homecoming replaces Support: when the day ends, part of each army's survivors return to your realm as troops.",
    type: "balance",
  },
  {
    date: "2026-10-07",
    title: "Wheat pays to Deploy",
    description:
      "In Frontier, barracks train for free and each troop costs its wheat when you Deploy it; the Deploy screens show the cost and wait until your realm holds it.",
    type: "balance",
  },
  {
    date: "2026-09-28",
    title: "Games stay visible during outages",
    description:
      "Games remain listed when launch records cannot be read, with an unavailable label until entry recovers.",
    type: "fix",
  },
  {
    date: "2026-09-27",
    title: "Clear Blitz watch entry",
    description:
      "The doorway explains when you are outside the roster or a game has ended, and offers Review for finished games.",
    type: "fix",
  },
  {
    date: "2026-09-27",
    title: "Castle visible during entry",
    description:
      "The doorway shows your realm's castle from the start, using the level already known in the game directory.",
    type: "fix",
  },
  {
    date: "2026-09-27",
    title: "Consistent player portraits",
    description:
      "Players without a chosen portrait show the same stock portrait in the game, profiles, standings, and podium.",
    type: "fix",
  },
  {
    date: "2026-09-27",
    title: "One entry after founding",
    description: "Founding a realm enters the game once, keeping Back navigation and the doorway handoff consistent.",
    type: "fix",
  },
  {
    date: "2026-09-27",
    title: "Realm visits return home",
    description:
      "Returning to your realm clears the visit banner and army dock together. Account changes also leave the visited view.",
    type: "fix",
  },
  {
    date: "2026-09-27",
    title: "Chest opening recovery",
    description:
      "Confirmed chest openings recover pending relic choices after a reconnect, and clear the opening effect when its result is unavailable.",
    type: "fix",
  },
  {
    date: "2026-09-27",
    title: "Blitz attack preview accuracy",
    description:
      "Attack previews stop at the battle cooldown, showing what this attack can do before another order is allowed.",
    type: "fix",
  },
  {
    date: "2026-09-27",
    title: "Frontier starts on time",
    description:
      "Upcoming seasons count down to their start. Resume prefers a live season, and expedition sites appear only once play begins.",
    type: "fix",
  },
  {
    date: "2026-09-27",
    title: "Enter Frontier depths",
    description: "Select your army beside its spire to enter an unlocked Ethereal depth and see its stamina cost.",
    type: "fix",
  },
  {
    date: "2026-09-27",
    title: "Wallet Deployment Guidance",
    description: "Linking an undeployed wallet explains how to deploy it on Starknet mainnet before trying again.",
    type: "fix",
  },
  {
    date: "2026-09-27",
    title: "Blitz Stays In View",
    description:
      "Your registered slot stays visible while its game launches. Ended games remain available to watch until their results are recorded.",
    type: "fix",
  },
  {
    date: "2026-09-27",
    title: "Retry Device List Errors",
    description: "The Devices panel shows account lookup errors and offers a retry when it cannot load your devices.",
    type: "fix",
  },
  {
    date: "2026-09-27",
    title: "Clear Account Recovery Steps",
    description: "Removed devices and account sign-in problems now explain the steps needed to play again.",
    type: "fix",
  },
  {
    date: "2026-09-26",
    title: "Support feeds your realm",
    description:
      "Your best Support army boosts realm production until midnight. The bonus survives its death, and income displays include it.",
    type: "feature",
    gameSlug: "frontier",
  },
  {
    date: "2026-09-26",
    title: "Explored Daily Realm Ring",
    description: "Your realm's six neighbours start explored each day. Deployment waits for explored, free ground.",
    type: "improvement",
    gameSlug: "frontier",
  },
  {
    date: "2026-09-26",
    title: "Research and building tiers",
    description:
      "Research unlocks building tiers and depths. Existing buildings upgrade individually for labor; new buildings include their researched tier in the price.",
    type: "feature",
    gameSlug: "frontier",
  },
  {
    date: "2026-09-25",
    title: "Frontier LORDS chests",
    description:
      "Frontier chests award relics or LORDS. When the released LORDS budget is exhausted, a chest grants a relic of the same rarity and explains why.",
    type: "feature",
    gameSlug: "frontier",
  },
  {
    date: "2026-09-25",
    title: "Army attributes and relics",
    description:
      "Your Frontier armies earn attribute choices from exploration, victories and relics. Battle increases damage, and Logistics expands the stamina bar.",
    type: "feature",
    gameSlug: "frontier",
  },
  {
    date: "2026-09-25",
    title: "Stamina while loading",
    description: "Army stamina shows — while its daily slot is loading, and actions wait until the bar is known.",
    type: "fix",
  },
  {
    date: "2026-09-25",
    title: "Ysolde's guide",
    description:
      "Ysolde of the Fox walks new Lords through their first Frontier day, one line at a time. Skip her any time, or replay her from settings.",
    type: "feature",
  },
  {
    date: "2026-09-25",
    title: "Frontier chat",
    description: "Game chat now has a strip above your Frontier armies; it folds away while you command one.",
    type: "feature",
    gameSlug: "frontier",
  },
  {
    date: "2026-09-25",
    title: "Only the actions a game allows",
    description:
      "Panels no longer offer actions the game turns off: no transfer shortcut, pause switch, production refill, relic list or defense army where the game has none.",
    type: "fix",
  },
  {
    date: "2026-09-25",
    title: "Exact fight forecasts",
    description:
      'The attack preview now computes each exchange with the game\'s own arithmetic, so it shows exactly what a fight costs: "Wins in 2 exchanges · loses 420 · 60 stamina". Where a game rolls dice, it shows the worst and best rolls.',
    type: "improvement",
  },
  {
    date: "2026-09-25",
    title: "Frontier's own screen",
    description:
      "Frontier now has a HUD built for it, phone first: today's day and time left, your Essence, labor, wheat and troops at home, one card per army slot with strength and stamina, and one switch between the expedition map and your realm.",
    type: "feature",
    gameSlug: "frontier",
  },
  {
    date: "2026-09-25",
    title: "Scores respect your view",
    description:
      "Scores outside your Frontier view show a dash until known. Realm captures now record both owners in the game story.",
    type: "fix",
  },
  {
    date: "2026-09-22",
    title: "One app for every game",
    description:
      "The lobby, results and your account now live in the game app at play.realms.party, and a game opens at its own address. The lobby loads without the 3D client, so it opens fast on a phone.",
    type: "improvement",
  },
  {
    date: "2026-09-22",
    title: "Frontier Mode Configuration",
    description: "Frontier uses its own building choices and season labels.",
    type: "fix",
    gameSlug: "frontier",
  },
  {
    date: "2026-09-19",
    title: "Transfer Eternum Structure Ownership",
    description:
      "Transfer an owned Eternum structure from its owner panel, with recipient validation and confirmation. Villages cannot be transferred.",
    type: "feature",
  },
  {
    date: "2026-09-19",
    title: "Dismiss Structure Guards",
    description: "Dismiss an occupied guard from its deployment picker, with confirmation before its troops are lost.",
    type: "feature",
  },
  {
    date: "2026-09-19",
    title: "Eternum Hyperstructure Construction",
    description:
      "Start construction, contribute resources from your structures, and choose who can contribute from the hyperstructure's tile panel.",
    type: "feature",
  },
  {
    date: "2026-09-19",
    title: "Free Blitz Slots and Results",
    description:
      "Register for a free slot, join your assigned game with prepared realms, and see final ranks and victory points after the whole roster is scored.",
    type: "feature",
  },
  {
    date: "2026-09-18",
    title: "Automatic Blitz settlement",
    description:
      "Assigned players receive three prepared realms and starting guards automatically. Play opens when the whole roster is ready.",
    type: "improvement",
  },
  {
    date: "2026-09-18",
    title: "Complete claims and season closure",
    description: "Mining claims and season closure continue through all required batches before reporting completion.",
    type: "fix",
  },
  {
    date: "2026-09-18",
    title: "Guard slots match the battlefield",
    description:
      "Starting guards now appear in the first defense slot. Recruitment, slot icons and battle stories use the same numbering.",
    type: "fix",
  },
  {
    date: "2026-09-18",
    title: "Faith, Armies and Resource Bridge",
    type: "feature",
    description:
      "Claim faith points and prizes, receive your village army, and rename explorers. Eternum settlements can deposit and withdraw supported resources.",
  },
  {
    date: "2026-09-18",
    title: "Synchronized Player Actions",
    description:
      "Actions wait for your player state to synchronize. Structures no longer appear unclaimed while their ownership is loading.",
    type: "fix",
  },
  {
    date: "2026-09-17",
    title: "Complete Troop History",
    description:
      "Recruitment, disbanding and troop transfers appear in your game history, with the correct guard slot.",
    type: "fix",
  },
  {
    date: "2026-09-17",
    title: "Mining Claims Catch Up",
    description:
      "Claim ready mining phases together. Winner rewards return to the first contributing structure; the owner's share stays in the mine.",
    type: "improvement",
  },
  {
    date: "2026-09-17",
    title: "Simpler Army and Structure Display",
    description:
      "Removed autonomous map agents and hyperstructure level variants. Player armies keep their normal ownership colors and troop models.",
    type: "improvement",
  },
  {
    date: "2026-09-17",
    title: "Command sync recovery",
    description:
      "A stalled game update now reports an error and releases the controls that were waiting instead of blocking play until reload.",
    type: "fix",
  },
  {
    date: "2026-09-17",
    title: "Production and exploration fixes",
    description:
      "Blitz uses Resource production only. Build orders leave your map selection alone, ships sail bow-first, and surface exploration grants its reward in the same action.",
    type: "fix",
  },
  {
    date: "2026-09-17",
    title: "Clear game creation feedback",
    description:
      "Creating a game shows its progress and keeps any launch error beside the button, so you can fix it and retry without losing the form.",
    type: "fix",
  },
  {
    date: "2026-09-17",
    title: "Reliable game end effects",
    description:
      "Frozen terrain updates without a reload. A game-end banner announces the clock ending and names the winner or tied winners when the final result arrives.",
    type: "fix",
  },
  {
    date: "2026-09-17",
    title: "Wallet choice and live lobby",
    description:
      "Pick a wallet to connect and sign in in one flow, with wallet choices available after an error. Lobby countdowns advance every second and player counts refresh while the lobby is open.",
    type: "fix",
  },
  {
    date: "2026-09-17",
    title: "Settlement surroundings revealed",
    description:
      "New realms and villages reveal the six neighbouring terrain tiles when settled, without discoveries or exploration rewards.",
    type: "improvement",
  },
  {
    date: "2026-09-17",
    title: "Responsive army selection",
    description: "Army range checks stay responsive as more players and structures fill the map.",
    type: "fix",
  },
  {
    date: "2026-09-17",
    title: "Confirmed settlement before entry",
    description: "Game entry waits for your settlement to appear and reports a rejected settlement before proceeding.",
    type: "fix",
  },
  {
    date: "2026-09-17",
    title: "Reliable game entry and updates",
    description:
      "The lobby opens before game rules load, and exploration rewards keep your next action ready without reconnecting.",
    type: "fix",
  },
  {
    date: "2026-09-17",
    title: "Independent village placement",
    description:
      "Villages use the settlement planner. Choose a connected realm for the army grant and bridge fee; villages no longer use one of six surrounding tiles.",
    type: "feature",
  },
  {
    date: "2026-09-17",
    title: "Consistent reinforcement and production",
    description:
      "Reinforcement checks the target owner in every game mode. Production controls show the recorded resource, labor, and troop bonuses through their end ticks.",
    type: "fix",
  },
  {
    date: "2026-09-18",
    title: "Illustrated Mobile HUD",
    description:
      "Replaced the compact HUD's labeled generic symbols with spacious illustrated Eternum controls for Empire, Map, Log, Chat and Details.",
    type: "improvement",
  },
  {
    date: "2026-09-16",
    title: "Game-World Menu Icons",
    description:
      "Reworked key menus with illustrated tools, war gear, caravans, maps and artifacts that stay clear at compact HUD sizes and feel native to Eternum's world.",
    type: "improvement",
  },
  {
    date: "2026-09-15",
    title: "Direct Message Alert Controls",
    description:
      "Enable raven alerts for existing devices from Settings. Battle alerts report the correct outcome, and enabling alerts keeps them quiet while you play.",
    type: "fix",
  },
  {
    date: "2026-09-15",
    title: "Ravens and Richer Alerts",
    description:
      "Notifications now describe battles, caravans, construction, exploration and troop movements in the voice of the realm. New direct messages can also arrive as privacy-safe raven alerts while you are away.",
    type: "feature",
  },
  {
    date: "2026-09-15",
    title: "Quiet Foreground Alerts",
    description:
      "Background push alerts now stay quiet while you are actively playing; confirmed activity continues to appear in the in-game feed, and device alerts resume after you leave.",
    type: "fix",
  },
  {
    date: "2026-09-15",
    title: "Clearer Mobile Map Controls",
    description:
      "Improved the portrait game header with a stable settings position and a simpler one-tap map layer switch, keeping every control within reach on narrow screens.",
    type: "improvement",
  },
  {
    date: "2026-09-15",
    title: "Ethereal Spire Portals",
    description:
      "Spires rise above dark basalt steps with floating shards and swirling neon portals, making passages between layers easier to recognise.",
    type: "improvement",
  },
  {
    date: "2026-09-14",
    title: "World selection validation",
    description: "Game entry and registration report an unavailable world instead of selecting another deployment.",
    type: "fix",
  },
  {
    date: "2026-09-14",
    title: "Roomier Mobile Action Menus",
    description:
      "Build, Production, Military, Transfer and Trade adapt to portrait and landscape with compact structure selection, larger touch controls and clearer actions. Building costs are visible before you build, and menus stay in place when you rotate or enter an amount.",
    type: "improvement",
  },
  {
    date: "2026-09-14",
    title: "Mobile Action Menu and Market",
    description:
      "The Build, Production, Military, Transfer and Trade menu now appears on phones: a rail on the left in landscape and a row above the tab bar in portrait. The Market fits a phone screen and keeps your AMM tab open when you change resources. The phone order book now leads with a Buy/Sell toggle and the order form, shows the three best offers beneath it, and opens the full list on See all.",
    type: "feature",
  },
  {
    date: "2026-09-13",
    title: "Background Notification Account Safety",
    description:
      "Signing out or disabling background notifications stops this device from accepting alerts immediately, even while setup is waiting for a connection.",
    type: "fix",
  },
  {
    date: "2026-09-13",
    title: "Automatic Background Game Alerts",
    description:
      "When available, enable game alerts on this device to receive confirmed activity with the game closed. Your account notification level controls which alerts arrive.",
    type: "feature",
  },
  {
    date: "2026-09-13",
    title: "Notification Settings Across Tabs",
    description: "Changing your account notification level also updates your other open game tabs.",
    type: "fix",
  },
  {
    date: "2026-09-13",
    title: "Install Realms Easily",
    description:
      "Use Install Realms on the home page or in Settings to install the game or see instructions for your browser.",
    type: "feature",
  },
  {
    date: "2026-09-13",
    title: "Game Activity Compatibility",
    description: "Game activity remains available as new kinds of events are introduced.",
    type: "fix",
  },
  {
    date: "2026-09-12",
    title: "Local Game Notifications",
    description:
      "Enable device alerts in Settings for new confirmed activity involving you while the game remains running. Test delivery before relying on it.",
    type: "feature",
  },
  {
    date: "2026-09-12",
    title: "Notification Preferences",
    description: "Choose a notification level in Settings and save it to your account.",
    type: "feature",
  },
  {
    date: "2026-09-12",
    title: "Confirmed Game Activity",
    description: "Game activity keeps its confirmed version when live updates and history overlap.",
    type: "fix",
  },
  {
    date: "2026-09-12",
    title: "Living hyperstructure towers",
    description:
      "Hyperstructures rise piece by piece into distinctive magic towers, including instant builds in Blitz. Six architectural families and eight crowns feature moving wings, orbiting gems and swirling power cores: unstable violet or calm teal. They awaken on completion and freeze when the game ends.",
    type: "feature",
  },
  {
    date: "2026-09-12",
    title: "Install Realms",
    description:
      "Install Realms on your device, retry when your connection returns, and apply game updates when you are ready.",
    type: "feature",
  },
  {
    date: "2026-09-12",
    title: "Cleaner Game Activity",
    description:
      "Live activity and history now share event identities, so the same event appears only once when history loads.",
    type: "fix",
  },
  {
    date: "2026-09-12",
    title: "Smoother Mobile Map Gestures",
    description:
      "Pan the world map with one finger and pinch to zoom around your fingers. Switching gestures stays steady, and interrupted touches no longer affect the next drag.",
    type: "fix",
  },
  {
    date: "2026-09-12",
    title: "Map and game-end fixes",
    description:
      "Local zoom shows two rings of terrain. Tile details follow your view in a narrower panel, and ground outlines mark selected armies and structures. Finished games close gameplay and freeze the map, including dev games.",
    type: "fix",
  },
  {
    date: "2026-09-12",
    title: "Frost and calmer banners",
    description:
      "End-game frost coats terrain, trees, structures, armies and chests. Preview it with Freeze map in the lab. Heraldry stays clear and banners ease into gusts.",
    type: "improvement",
  },
  {
    date: "2026-09-12",
    title: "Blitz Entry Config Refresh",
    description:
      "Rejoining a game after a world update refreshes its configuration instead of using an outdated saved game.",
    type: "fix",
  },
  {
    date: "2026-09-12",
    title: "Eternum Portals and Dev Settlement",
    description:
      "Six spires reveal their access hexes on both layers. In Eternum dev games, choose a realm number to preview its name and resources, settle additional realms, and place villages without passes.",
    type: "feature",
  },
  {
    date: "2026-09-12",
    title: "Clean realm upgrades",
    type: "fix",
    description: "Upgrading a realm removes its previous model, including when a map refresh is interrupted.",
  },
  {
    date: "2026-09-12",
    title: "Travel between the layers",
    type: "feature",
    description: "Armies keep their selection after crossing a spire, and explore and fight on their current layer.",
  },
  {
    date: "2026-09-12",
    title: "Spires on the map",
    type: "feature",
    description: "Find animated spires on both layers and select their tiles to inspect a crossing.",
  },
  {
    date: "2026-09-12",
    title: "One map, two layers",
    description:
      "Switch between Surface and Ethereal to see each layer's terrain, armies, structures and chests in the world map.",
    type: "feature",
  },
  {
    date: "2026-09-12",
    title: "Refined Realms and Clear Ownership",
    description:
      "Realm masonry grows paler and finer with each tier, with hand-laid roofs, a raised kingdom drawbridge, and full-height empire gates. Settlement supplies sit beside a clear entrance. Owned realms and villages fly green banners; all others fly red. Every realm hanging displays its order emblem. Chests are 30% smaller on the map. Game entry loads entity models as the selected world needs them.",
    type: "improvement",
  },
  {
    date: "2026-09-12",
    title: "Spire Preview and Rift Motion",
    description:
      "Preview levitating spires with engraved stone and spherical essence portals in the terrain lab. Essence rifts animate independently across the map.",
    type: "improvement",
  },
  {
    date: "2026-09-12",
    title: "Retired quest map tiles",
    description: "Legacy quest tiles and standalone holy sites no longer appear in game creation or map actions.",
    type: "improvement",
  },
  {
    date: "2026-09-12",
    title: "Ethereal portals and dice",
    description:
      "Travel through seven public spires for Essence, contest guarded Bitcoin mines, and roll a d20 damage bonus in ethereal battles. Battle Lab lets you select the defending layer; ethereal previews assume +10% for both sides.",
    type: "feature",
  },
  {
    date: "2026-09-12",
    title: "Mobile Selection Keeps the Map Clear",
    description:
      "Selecting an army or structure on a phone no longer opens the details sheet over the map. Tap the next hex or hold to move straight away, and open the Details tab when you want the full view.",
    type: "improvement",
  },
  {
    date: "2026-09-11",
    title: "Eternum Factory and Entry",
    description:
      "Create Eternum games and settle a realm with its canonical traits at a random position. Entry remains open after the game starts. Earned points register automatically.",
    type: "feature",
    gameSlug: "eternum",
  },
  {
    date: "2026-09-11",
    title: "Smoother Game Entry",
    description:
      "Game entry avoids a blocking wallet network request, and the first local view prepares its graphics before appearing.",
    type: "improvement",
  },
  {
    date: "2026-09-11",
    title: "Smaller Wildlife Downloads",
    description: "Wildlife assets use 43% less download data with compressed textures.",
    type: "improvement",
  },
  {
    date: "2026-09-11",
    title: "Livelier Realms and Villages",
    description:
      "Realms grow from timber settlements into golden imperial palaces, with furnished courtyards, order banners, flickering fires and spinning gems in world and local views. Villages feature rounded yurts, and penguins keep their feet on the ground.",
    type: "improvement",
  },
  {
    date: "2026-09-11",
    title: "Global and Game Chat",
    description: "Start in Global chat with players across all games, or switch to Game chat for your current match.",
    type: "fix",
  },
  {
    date: "2026-09-11",
    title: "Consistent Rain Direction",
    description: "Rain falls straight down across camera angles, with consistent streaks and ground splashes.",
    type: "fix",
  },
  {
    date: "2026-09-10",
    title: "Stable Lab Dropdowns",
    description:
      "Live terrain statistics update independently of the Lab controls, keeping dropdown selections undisturbed while you browse models and settings.",
    type: "fix",
    readMore: "/lab",
  },
  {
    date: "2026-09-10",
    title: "Sandy Settlement Islands",
    description:
      "Camps, villages and realms keep the terrain beneath them. Water settlements gain procedural sand, including in local views.",
    type: "improvement",
    readMore: "/lab",
  },
  {
    date: "2026-09-10",
    title: "One Graphics Lab",
    description: "Work on biomes, settlements, models and rewards from one lab. The HUD experiment has been removed.",
    type: "improvement",
    readMore: "/lab",
  },
  {
    date: "2026-09-10",
    title: "Clearer Terrain and Smoother Storms",
    type: "improvement",
    description:
      "Explored terrain stays distinct from fog through daylight, sunset and moonlight. Scorched tiles show burnt volcanic rock and glowing lava fissures. Storms, chests and rifts animate more smoothly, with less stutter when lightning first strikes. Map shadows stay grounded, and fish and turtles swim partly submerged.",
  },
  {
    date: "2026-09-10",
    title: "Fleet details and reward preview",
    type: "fix",
    description:
      "Tier 1 ships carry their class color along the upper hull, with the forward sail rope removed. Compressed sails and flags animate correctly. Preview chest opening and all three relic icons in the Reward Lab. Map view labels match the other header controls.",
  },
  {
    date: "2026-09-10",
    title: "Arcane Chests and Essence Rifts",
    type: "improvement",
    description:
      "Camera-facing chests pair light purple enamel with gold and blue gems, with a softer daytime finish and a night glow. New chests emerge through violet shadows; opening reveals three relics before the altar sinks into the biome. Existing chests stay settled as you browse. Essence rifts erupt with textured liquid spray and catch moonlight with a violet glow after dark.",
  },
  {
    date: "2026-09-10",
    title: "Tap To Select, Hold To Move",
    description:
      "Tap the map to select or inspect. Hold a highlighted destination for half a second to issue an order. Dragging or pinching cancels the hold, and repeated taps no longer issue orders.",
    type: "improvement",
  },
  {
    date: "2026-09-10",
    title: "Clearer Mobile Map Controls",
    description:
      "Keep more of the map in view with a compact header, stable navigation tabs, and one closable panel at a time. Portrait sheets and landscape drawers make tile details and the minimap easier to use on a phone.",
    type: "improvement",
  },
  {
    date: "2026-09-10",
    title: "Usernames and portraits everywhere",
    description:
      "Your identity username and portrait now show on armies, tiles, chat, standings and the settings header, and registration writes that username to the chain.",
    type: "improvement",
  },
  {
    date: "2026-09-10",
    title: "Surfaces open beside the right column",
    description:
      "The guard slot picker, the army swap surface and the attack details now open beside the right column instead of over it, and the picker names the slot it is for.",
    type: "improvement",
  },
  {
    date: "2026-09-10",
    title: "Realms provision themselves",
    description:
      "Once the main phase opens, every realm you own is provisioned automatically, with one feed row per realm and a retry at the next block on failure.",
    type: "feature",
  },
  {
    date: "2026-09-10",
    title: "Relic crates open from the map",
    description:
      "Right-click a crate with an adjacent army selected, or press Open in the crate tile, to open it; the relics burst from the hex and the tile lists what you found.",
    type: "feature",
  },
  {
    date: "2026-09-10",
    title: "Actions bubble and calmer HUD",
    description:
      "Build, Production, Military and Transfer sit in their own Actions bubble; tile details stay visible under the feed while chat is open; feed rows are easier to read over bright terrain; building cards build directly in the world view; the deployment picker opens at zero troops.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Quick Feed and Chat Strip",
    description:
      "Events show as a short stack of rows under the header that fade on their own, with a Log button for the full history. Chat is one line at the foot of the right column that expands over the details when you press Enter.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Clock Shows the Day Phase",
    description:
      "The match countdown now carries the day phase icon, the time left in the phase and a six-segment underline; hover for the full breakdown.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Selected Hex Stays Outlined",
    description:
      "The hex you select keeps its outline while hovering elsewhere, survives a Local/World flight, and clears on an empty-map click or Escape.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Compact Settings",
    description:
      "One popover: profile, video with the frame-rate cap, audio, the keys bound in the current view, sign out and leave game.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Sails Show Ownership",
    description:
      "Ship sails keep white outer panels and a printed centre stripe in the owner's map colour, the same one their armies and labels carry.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Weather Across the World",
    description:
      "Sunny, cloudy, rainy and stormy weather evolves through gradual fronts, driving lighting and wind, with falling rain and ground splashes that follow the map perspective.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Readable Nights",
    description:
      "Night and twilight gain brighter fill and cool moonlight; compare all seven lighting setups in the biome lab.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Tier 3 Building Milestones",
    description: "A realm's first Tier 3 military building makes the news; repeated army deployments no longer do.",
    type: "fix",
  },
  {
    date: "2026-09-09",
    title: "Caravans in Events",
    description: "Track sent and arrived caravans in Events and the next incoming delivery on your structure's tile.",
    type: "feature",
  },
  {
    date: "2026-09-09",
    title: "Spectator Standings",
    description: "Watch the top ten and the selected player's points each tick; select a row to visit their capital.",
    type: "feature",
  },
  {
    date: "2026-09-09",
    title: "Choose the Battle to Watch",
    description: "Battle rows fly the camera on demand; the automatic combat-follow header control is removed.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "One Game Clock",
    description: "The countdown carries a day phase underline; hover to see the current phase.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Consistent Header Labels",
    description: "Player names and spectator labels share the same small caps style across the header.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Simpler Game Settings",
    description:
      "Settings groups quality, shadows, motion and audio controls beneath your identity, with one Leave game action.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Tile Details Stay Anchored",
    description: "Tile details stay at the bottom right while Events and Chat fill the space above them.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Events and Chat Together",
    description:
      "Switch between Events and Chat in one panel. Enter focuses chat, Escape returns to Events, and Log keeps the full activity history.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Spectator Controls Stay Consistent",
    description: "Switching between Local and World keeps order controls hidden while spectating.",
    type: "fix",
  },
  {
    date: "2026-09-09",
    title: "Readable Relic Crate Details",
    description: "Chest tiles show their crate contents above the biome bonuses and coordinates.",
    type: "fix",
  },
  {
    date: "2026-09-09",
    title: "Armies Follow Realm Ownership",
    description: "Armies change owner and colour immediately when their home structure changes hands.",
    type: "fix",
  },
  {
    date: "2026-09-09",
    title: "Continuous World and Local Flights",
    description: "Keep the map visible while the next view loads during World and Local camera flights.",
    type: "fix",
  },
  {
    date: "2026-09-09",
    type: "fix",
    title: "Biome Bonuses Stay Visible",
    description:
      "Biome keeps its troop bonuses expanded and uses only their content height. Keyboard actions inside panel headers no longer collapse their panels.",
  },
  {
    date: "2026-09-09",
    type: "fix",
    title: "Consistent Tile Coordinates",
    description:
      "Structure, army and plain-tile headers all show the same map coordinates, whether you select them from the map or a panel.",
  },
  {
    date: "2026-09-09",
    type: "fix",
    title: "Battles Stay in Events",
    description:
      "Events loads battle history directly, so movement and production stories cannot push fights out of the feed. Confirmed updates keep the battle list current.",
  },
  {
    date: "2026-09-09",
    type: "improvement",
    title: "One Plain Tile Panel",
    description: "Plain tiles show their coordinates, header actions and troop bonuses inside a single Biome frame.",
  },
  {
    date: "2026-09-09",
    type: "fix",
    title: "Recover After Graphics Loss",
    description:
      "If WebGPU loses its device, the game reloads once in WebGL at the same map URL, rebuilding models and terrain for that renderer.",
  },
  {
    date: "2026-09-09",
    type: "fix",
    title: "Leaderboard Retry Stays Yours",
    description:
      "If points history is unavailable, Players keeps its error and cached details until you press Refresh. Background requests resume after a successful retry.",
  },
  {
    date: "2026-09-09",
    type: "improvement",
    title: "Quieter Event Feed",
    description:
      "Routine production stays in Activity. Events keeps battles, caravans and action results readable in one compact type style, with failed or stuck production still visible.",
  },
  {
    date: "2026-09-09",
    type: "improvement",
    title: "Structure Details Together",
    description:
      "See a structure’s owner, guards and resources in one panel. Biome uses only the space its bonuses need.",
  },
  {
    date: "2026-09-09",
    type: "fix",
    title: "Panels Align With the Header",
    description:
      "Structures and Events start beside the top header, leaving more room for realm controls and tile details below.",
  },
  {
    date: "2026-09-09",
    type: "improvement",
    title: "Points Ready When You Open",
    description:
      "Your leaderboard breakdown loads when you enter the game and stays refreshed while you play, so opening Players no longer scans the match history.",
  },
  {
    date: "2026-09-09",
    title: "Roomier Panels and Compact Chat",
    description:
      "Keep world chat open below tile details, with Events above. The wider structure panel has more room for names and resources, and its action buttons sit directly underneath.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "One Feed for Game Events",
    description:
      "Read battles, action results and your incoming caravans in Events. Battle rows show both armies and the winner; floating notifications no longer cover the map.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Open Suggestions Without Interruptions",
    description: "Cycle through attention targets and open suggested actions without interrupting your game.",
    type: "fix",
  },
  {
    date: "2026-09-09",
    title: "Resume After Signing In Elsewhere",
    description:
      "If another tab’s sign-in replaces your gameplay key, this tab takes control once and retries your action once. The event feed tells you what happened.",
    type: "fix",
  },
  {
    date: "2026-09-09",
    title: "Events, Details and Chat",
    description:
      "Keep important events above tile details on the right. Filter events by all, mine or combat, jump to surviving participants, and press Enter to open chat. Activity keeps the full log.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "See Where Points Come From",
    description:
      "The Players board now shows points earned through exploration, chests, captured camps and hyperstructures, and held hyperstructures.",
    type: "fix",
  },
  {
    date: "2026-09-09",
    title: "Your Place on the Leaderboard",
    description:
      "Click your name, rank and points to open the Players board at your highlighted row. Your gameplay address is there too, with the player profile one click away.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Fly Between Map Views",
    description:
      "Fly toward a realm when entering it and pull back when leaving, with a short scene crossfade. Reduced motion keeps the familiar fade, and Local/World controls support keyboard navigation.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Day Timer Returns",
    description:
      "The familiar day-phase indicator returns beside the match clock. Hover it for the current phase and time remaining; daylight and the gong keep running independently.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "One Attention List",
    description:
      "Cycle through locations needing attention, then suggested actions, from one header pill. Suggestions open beside familiar panel styling and remain yours to confirm.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Action Previews Beside Their Targets",
    description:
      "Attack, help, chest and spire previews open beside the target hex. Right-click another legal target to move the preview, or click elsewhere to close it.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Visual Building Choices",
    description:
      "Choose buildings from thumbnails with resource costs beside each choice. Buildable options come first, and tall plot pickers stay inside the screen with scrolling.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Visual Troop Deployment",
    description:
      "Choose troops by their icon, tier and stock. Add 100, add 500 or use Max when deploying field armies and guards, with empty choices clearly marked.",
    type: "improvement",
  },
  {
    date: "2026-09-09",
    title: "Clearer Army Movement",
    description:
      "Armies move without duplicate pending silhouettes or destination rings, keeping the battlefield clear.",
    type: "fix",
  },
  {
    date: "2026-09-09",
    title: "Daylight Independent of the HUD",
    description: "The world's day and night cycle follows game time even when the day timer is hidden.",
    type: "improvement",
  },
  {
    date: "2026-09-08",
    title: "One clock and attention count",
    description:
      "See the start countdown or time left in one clock. The attention count combines structures under attack and ready arrivals; click it to cycle through their locations.",
    type: "improvement",
  },
  {
    date: "2026-09-08",
    title: "Clearer action selection",
    description:
      "Your selected entity and its available actions keep the focus. Hover a target for instructions; the bottom action banner is gone, and Escape still clears selection.",
    type: "improvement",
  },
  {
    date: "2026-09-08",
    title: "Production beside your buildings",
    description:
      "Set production amounts on building and castle panels without leaving the map. Switch each realm between Smart, Idle, and Custom from its resource header.",
    type: "improvement",
  },
  {
    date: "2026-09-08",
    title: "Build directly on a plot",
    description:
      "Click an open plot to choose and build immediately. Costs and blocked reasons stay beside the plot, with the map in view.",
    type: "improvement",
  },
  {
    date: "2026-09-08",
    title: "Deploy Armies on the Map",
    description:
      "Right-click a highlighted spawn hex or use Add on a guard slot to choose troops and deploy with the map in view. Pick from troops in stock, enter a count or use Max, and see exactly what the order uses. Blocked orders explain what is missing.",
    type: "feature",
  },
  {
    date: "2026-09-09",
    title: "Roaming Biome Wildlife",
    description:
      "Biome creatures wander through explored terrain, with native species and sparse populations of at most one animal per 8×8 region.",
    type: "feature",
  },
  {
    date: "2026-09-08",
    title: "Refreshed Biome Artwork",
    description:
      "Updated terrain vegetation, rocks and biome portraits with the new BIOME / 16 artwork, including forest canopies, mushrooms and cycads.",
    type: "improvement",
  },
  {
    date: "2026-09-08",
    title: "More Grounded Character Walking",
    description:
      "Improved walking with heel-to-toe foot motion, weight acceptance and calmer upper-body movement, plus visible contact diagnostics in the gym.",
    type: "improvement",
  },
  {
    date: "2026-09-08",
    title: "Knight Animation Review Suite",
    description:
      "Added separate idle, run and sword-attack baselines, recovery captures and comparisons for animation timing changes.",
    type: "improvement",
  },
  {
    date: "2026-09-08",
    title: "Detailed Fleets for Every Army",
    type: "improvement",
    description:
      "Compare all nine detailed ships in the Model Lab: Knight cannon ships, Crossbowman ballista ships and Paladin sacred vessels. Each tier has its own silhouette, with player sail prints, sailing animation and the same hex footprint.",
    readMore: "/lab/models",
  },
  {
    date: "2026-09-07",
    title: "Lighter Game Loading",
    description:
      "Game entry downloads less unused data. Construction and production panels load when opened, keeping more work out of startup.",
    type: "improvement",
  },
  {
    date: "2026-09-07",
    title: "Recover After Client Updates",
    description: "An outdated client refreshes once if a game module is no longer available after an update.",
    type: "fix",
  },
  {
    date: "2026-09-07",
    title: "A Glimpse Beneath",
    description:
      "Preview Ethereal’s flat, textured floor under fixed moonlight in the World Biome Lab, with tile selection, armies and buildings. Dark unexplored tiles carry visible hints of its flowing energy and dissolve in uneven wisps as explorers advance.",
    type: "feature",
  },
  {
    date: "2026-09-07",
    title: "Reliable Identity RPC",
    description:
      "Wallet initialization uses Alchemy’s mainnet RPC, restoring client startup after the previous endpoint stopped serving requests.",
    type: "fix",
  },
  {
    date: "2026-09-07",
    title: "Clearer Terrain and Ocean",
    description:
      "Rocky deserts and sand dunes have distinct surface patterns, ocean swells rise and fall, fog is dark charcoal, and subtle hex borders gain extra contrast on grass.",
    type: "fix",
  },
  {
    date: "2026-09-07",
    title: "Distinct Biomes and Exploration",
    description:
      "Biomes gain distinct ground, vegetation, and water. Newly explored hexes clear from the explorer’s entry edge in 300 ms; replay the transition from any direction in the Biome Lab.",
    type: "improvement",
  },
  {
    date: "2026-09-06",
    title: "Clearer Terrain And Daylight",
    type: "improvement",
    description:
      "See hex boundaries across terrain and darker frontier fog, with balanced daylight, flowing lava and charred vegetation. Armies stay grounded, vegetation stays stable, and buildings cast shorter shadows. Phantom units no longer appear inside structures.",
  },
  {
    date: "2026-09-06",
    title: "Lighter World Rendering",
    type: "improvement",
    description: "Removed redundant screen passes while preserving world detail and selection overlays.",
  },
  {
    date: "2026-09-06",
    title: "Lighter Terrain Placement",
    type: "improvement",
    description: "Reduced terrain sampling work when positioning armies and buildings on world tiles.",
  },
  {
    date: "2026-09-06",
    title: "Choose Your Frame Limit",
    type: "improvement",
    description:
      "Choose Uncapped or a 60 FPS limit in landing and in-game settings, with the same visual detail in both modes.",
  },
  {
    date: "2026-09-06",
    title: "Lighter World Loading",
    type: "improvement",
    description: "Reduced loading delays when entering a game, including terrain and building preparation.",
  },
  {
    date: "2026-09-06",
    title: "Lighter World Rendering",
    type: "improvement",
    description: "Improved rendering efficiency when viewing and panning the world map.",
  },
  {
    date: "2026-09-06",
    title: "Labs in the Sidebar",
    type: "improvement",
    description:
      "Open the Biome Lab and Local Lab from their tree and castle icons in the left sidebar, or from the menu on mobile.",
  },
  {
    date: "2026-09-06",
    title: "Game Lighting in Labs",
    type: "improvement",
    description:
      "Biome and local labs use game lighting and tone mapping, with a day-cycle slider to compare terrain, armies and buildings at different times of day.",
  },
  {
    date: "2026-09-06",
    title: "World and Local Labs",
    type: "feature",
    description:
      "Test fog, tile selection, rotating armies, and placed buildings in the Biome Lab. The Local Lab previews settlement layouts. Spectate opens directly into the game loading flow.",
  },
  {
    date: "2026-09-06",
    title: "Mist Follows the Ground",
    description:
      "Unexplored tiles use warm, drifting ground mist. Known ground stays visible while panning, page edges blend into the mist, and minimap camera following recovers after a client refresh.",
    type: "fix",
  },
  {
    date: "2026-09-06",
    title: "Smooth Fog and Biome Lab",
    description:
      "Unloaded world terrain stays under one mist layer and reveals as pages arrive. Open BIOME LAB from the landing page to explore biome previews and visual settings.",
    type: "improvement",
  },
  {
    date: "2026-09-06",
    title: "Smoother World Entry and Exploration",
    description:
      "Enter the world through one loading screen. Terrain loads across your visible view with a margin beyond it, adapting as you pan, zoom, or resize. Ready pages appear progressively with their fog while nearby terrain stays visible. Small plants sway from their roots, and switching between world and local views keeps foliage intact.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-09-06",
    title: "Closer Settlements, Richer Ground",
    description:
      "Local view opens closer to your settlement, with building details at the screen edge and production status updated from live game state. Opening a local link selects the correct realm. Close forests gain canopy shadows and circling birds, sand and snow show wind ripples, and clear fog and reduced motion settings also apply to local ambience.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-09-05",
    title: "Clearer World, Faster Entry",
    description:
      "Enter the world without the stalled loading handoff. Explore brighter biomes, moving coastlines, and clearer fog borders; choose soft mist or reduced ambient motion in Settings. World panels leave the center of the map open.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-09-05",
    title: "Reliable Terrain Updates",
    description:
      "Terrain, props and fog stay together as the map updates, nearby ground appears sooner while panning, and roads and settlement terrain refresh when structures change.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-09-04",
    title: "Switch Wallets After Sign-Out",
    description: "Sign out now disconnects the wallet so you can sign in with another one.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-09-04",
    title: "Anonymous Spectating Restored",
    description:
      "Spectate from your active games works again without signing in, and world-loading failures no longer send you to sign-in.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-09-03",
    title: "Cleaner Map Labels",
    description:
      "Army and settlement labels now share one map renderer, stay tied to their entities, and simplify as you zoom out.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-09-03",
    title: "Biomes Stay Ready",
    description:
      "Detailed biome terrain now stays prepared while you pan around the world, and newly visible ground loads first instead of waiting behind old map work.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-09-03",
    title: "Biome-Colored Horizon",
    description:
      "Distant explored land now keeps the same biome colors as the minimap instead of falling back to generic ground, without adding terrain models or draw calls.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-09-03",
    title: "Textured Realm Terrain",
    description:
      "Realm interiors now show their shaded procedural biome ground without the obsolete flat-color hex surface covering it.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-09-03",
    title: "Smoother World Loading",
    description:
      "Army and structure graphics now warm up against the active renderer before a terrain chunk appears, preventing stalled chunk retries and reducing the first large rendering hitch.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-09-03",
    title: "Faster First Map",
    description:
      "A fresh browser profile now opens the map on WebGL2 immediately while WebGPU is verified in the background for the next visit, avoiding a long black screen on drivers that delay renderer startup.",
    type: "fix",
  },
  {
    date: "2026-09-03",
    title: "Quieter Selection",
    description:
      "Selecting a structure or army no longer rings every hex you own. Only the selection and its legal targets are emphasised; ownership is shown by colour, as it always was on the strategic markers.",
    type: "improvement",
  },
  {
    date: "2026-09-03",
    title: "Direct Realm Links",
    description:
      "A link to a realm's local view now opens that realm, signed in or spectating: the world map boots first and hands off to the local scene instead of stranding you on the map.",
    type: "fix",
  },
  {
    date: "2026-09-03",
    title: "Top Bar Popovers",
    description:
      "The leaderboard, what's new, transactions and settings (with the keyboard shortcuts inside) now open as popovers under their top-bar buttons, and a finished game shows a pill where the timer was instead of covering the map. Each popover closes on Escape or a click outside; the floating windows are gone.",
    type: "improvement",
  },
  {
    date: "2026-09-03",
    title: "Identity Chip",
    description:
      "The top-left chip now says who you are in this game: spectating (and as whom), not signed in with view-only access, connecting while your gameplay account is prepared, or your name with realms, rank and points. Sign-in, the leaderboard and Play for a spectator who owns a realm live in its popover, so no sign-in modal blocks the map any more.",
    type: "improvement",
  },
  {
    date: "2026-09-03",
    title: "Strategic Map View",
    description:
      "Zooming all the way out now shows the whole explored world as real terrain: the biome map underlies every zoom level, so there is no void beyond the detailed pages. Names show for your own, allied and top-ten holdings at mid zoom and for everyone up close. The icon-only strategic map (ownership markers over the biome map) is finished but parked behind a future map-mode key.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-09-02",
    title: "Continuous Map Zoom",
    description:
      "The world map and local view now zoom smoothly with the mouse wheel to any height. The Close, Medium and Far presets and the Enable Map Zoom setting are gone, and zooming all the way out shows the whole explored world as a biome map with no terrain edge.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-09-02",
    title: "Licensed Icy Sky Dragon",
    description:
      "Replaced the temporary Sky Dragon test model with a licensed icy dragon, preserving procedural walking, flight, reactions, and targeted fire breath with clearer textures and a production-safe source.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-09-01",
    title: "Terrain-Aware Movement Trails",
    description:
      "Added lightweight dust puffs behind moving ground armies, with stronger trails on dry land, softer trails through grass and forest, and no dust over snow, water, or beneath flying units.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-09-01",
    title: "Organic Coastal Water",
    description:
      "Improved oceans with sub-hex shorelines, shallow turquoise margins, deeper offshore color, moving wave highlights, beach foam, boat wakes, and idle ripples.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-09-01",
    title: "Living Landscape Edges",
    description:
      "Added grassy road verges, wetland shoreline growth, close-up ferns, reeds and wildflowers, and settlement footprints that respond to each structure's type and level.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-09-01",
    title: "Settlement Regrowth Zones",
    description:
      "Improved land around settlements with disturbed soil, cleared mature growth, pioneer shrubs and birch, and natural rings of stumps and fallen timber.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-09-01",
    title: "Living Road Networks",
    description:
      "Added natural roads between nearby structures under the same owner, with routes that avoid water and clear vegetation while blending into the surrounding landscape.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-08-31",
    title: "More Natural Forest Landscapes",
    description:
      "Improved forests with mature groves, regenerating edges and clearings, layered canopy, understory and deadfall, better-spaced crowns, and ground cover that responds to the canopy above.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-09-01",
    title: "Secure Match Chat",
    description:
      "Blitz chat now opens only for signed-in match participants, with private presence and protected direct messages.",
    type: "improvement",
    gameSlug: "blitz",
  },
  {
    date: "2026-08-30",
    title: "Exact Blitz Results",
    description:
      "Blitz reviews now show the exact final rank and chest entitlement recorded by the game, with LORDS and MMR settled safely on Starknet mainnet.",
    type: "improvement",
    gameSlug: "blitz",
  },
  {
    date: "2026-08-28",
    title: "Clearer World Loading",
    description:
      "World entry now shows real sync progress and waits for biome terrain before revealing the map, while slow loads expose the stage that is still working.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-28",
    title: "Faster Exploration Reveal",
    description:
      "Explored terrain and fog now update as one streamed action, so newly discovered tiles appear immediately and reveal smoothly.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-28",
    title: "Independent Game Entry",
    description:
      "Game lists, settlement, and spectating now load directly from Herald, keeping entry available when the legacy indexer is offline.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-28",
    title: "Reliable Realm Building",
    description:
      "Building actions now prevent duplicate placements while one is submitting, and the in-game connection banner follows the active gameplay account.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-27",
    title: "Smooth Sky Dragon Rendering",
    description:
      "Improved Sky Dragon frame rates by removing their costly animated real-time shadows while preserving the complete model, textures, and procedural motion.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-27",
    title: "Opaque Sky Dragon Materials",
    description:
      "Fixed Sky Dragon body, limb, eye, and wing materials so their textures render completely instead of appearing patchy or transparent.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-27",
    title: "Sky Dragon Flight Travel",
    description:
      "Improved Sky Dragons so they stand directly on the terrain while resting, take off for army movement, remain airborne along the route, and land at their destination.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-27",
    title: "Swappable Mount Models",
    description:
      "Added mount appearance and rig selection to the animation Gym, with live asset and skeleton diagnostics for reviewing horses, warhorses, and dragons safely.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-27",
    title: "Aligned Exploration Fog",
    description: "Fixed exploration fog appearing on the wrong hexes by aligning its mask with the world map.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-26",
    title: "Reliable Realm Entry",
    description:
      "Realm actions now submit in order with automatic nonce recovery, while signed-out visitors stay read-only until they connect an identity.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-26",
    title: "Faster Madara Actions",
    description:
      "Madara actions now submit without a fee-estimation round trip, reducing delays before they reach the chain.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-24",
    title: "Responsive Terrain Exploration",
    description:
      "Fixed delayed biome streaming and misplaced exploration fog so terrain appears as the map moves and mist stays aligned with unexplored hexes.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-24",
    title: "Procedural Naval Combat",
    description:
      "Added fantasy ships that take over when armies enter water, with synchronized wave motion, team pennants, wakes, cannonball broadsides, and impact-driven sinking—all tunable in the animation Gym.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-08-24",
    title: "Swappable Character Rigs",
    description:
      "Added explicit appearance and skeleton adapters so procedural movement, equipment, diagnostics, and ragdolls can drive different compatible fantasy character models without duplicating animation code.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-24",
    title: "Natural Human Footing",
    description:
      "Improved procedural walking and running with human-proportioned step width, forward-tracking knees, and new gait diagnostics that prevent bow-legged movement from reaching battles.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-24",
    title: "Integrated World Gym",
    description:
      "Added a shared biome-and-army test map where 100 procedural units walk across generated terrain with live grounding, collision, renderer, and performance diagnostics.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-08-24",
    title: "Stable Character Footwork",
    description:
      "Fixed boots twisting or facing backward during procedural movement, keeping toes aligned with travel while planted steps and swing transitions remain stable.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-24",
    title: "Living Fog Frontier",
    description:
      "Undiscovered territory now settles beneath softly moving mist, keeping biome ground faintly readable below it with a clearer one-tile frontier near explored land.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Physical Army Reactions",
    description:
      "Armies now separate and react when they meet, while targeted arrows preserve their incoming direction through authoritative Jolt ragdoll handoff. A seven-scenario collision gym and the 100-unit performance lab guard the behavior.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Stable Mounted Characters",
    description:
      "Fixed horses rubber-banding toward their staging origin while loading and stretching during Jolt ragdolls or resets, preserving stable legs through spawn, movement, death, and respawn.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "More Natural Unit Gaits",
    description:
      "Improved walking and running with planted-foot transitions, support-driven weight shifts, distinct run compression and flight, earlier leg recovery, calmer walking clearance, and more natural arm carriage.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "100-Unit Performance Lab",
    description:
      "Added a repeatable 60 FPS walking benchmark with live CPU, GPU, frame-pacing, draw-call, triangle, animation-lane, and display-refresh diagnostics for tuning large procedural armies.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Procedural Armies",
    description:
      "Replaced land-army board models with generated Knights, Archers, Crossbowmen, and mounted Paladins that share the new locomotion, weapon, attack, cosmetic, and ragdoll pipeline.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Exploration Shroud",
    description:
      "Unknown territory now forms a continuous atmospheric shroud that inherits subtle color from discovered biomes and recedes organically when your armies reveal new land.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Living Terrain Detail",
    description:
      "Improved every biome with broader landforms, richer forest layers, moving vegetation, animated coastal water, and terrain detail that adapts smoothly as you zoom.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Textured Living Biomes",
    description:
      "Added seamless ground materials across every biome, with natural grass, sand, soil, forest litter, stone, snow, and scorched-earth detail that follows climate and terrain shape.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Full-Scale Biome Testing",
    description:
      "Expanded procedural terrain verification to a full-screen, 100-page traversal and increased forest abundance while keeping large biome views smooth across both renderers.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-23",
    title: "Organic Biome Density",
    description:
      "Forests, rocks, and ground cover now gather in natural seeded clusters, blend across biome edges, thin on steep ground, and leave breathing room around structures.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-22",
    title: "Living Procedural Biomes",
    description:
      "The world map now flows as continuous terrain with organic forests, coastlines, relief, and structure pads while preserving exact hex interactions.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-08-22",
    title: "Believable Weapon Grips",
    description:
      "Fixed weapon, shield, bow, and crossbow holds with palm-aware sockets, role-specific finger poses, shield clearance, and close-up grip diagnostics for more convincing combat animation.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-22",
    title: "Animation Frame Inspector",
    description:
      "Added deterministic frame capture, five-angle phase atlases, numbered joint and angle overlays, pose diagnostics, contact sheets, and exact timeline scrubbing for validating characters and mounts before live battles.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-22",
    title: "Procedural Melee Combat",
    description:
      "Added grounded and mounted weapon attacks with swappable sword, hammer, axe, and shield cosmetics, target-contact feedback, and the same Jolt ragdoll handoff used by live armies.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-08-22",
    title: "Procedural Archery",
    description:
      "Added organic longbow draw and release motion, visible arrow volleys, moving-target practice controls, and pooled projectile impacts that preserve authoritative combat outcomes.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-08-22",
    title: "Organic Procedural Locomotion",
    description:
      "Improved soldiers, horses, and mounted riders with planted contacts, anatomically correct horse footfalls, terrain-aware balance, natural follow-through, and subtle per-unit gait variation.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-21",
    title: "Procedural Mounted Armies",
    description:
      "Added procedural horses and mounted Paladins with speed-driven gaits, terrain-aware hooves, visible upgrade pieces, composed riders, and shared Jolt ragdolls, plus mixed 100-unit gym benchmarks before promotion into live battles.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Accurate Army Stamina",
    description:
      "Army map labels now use the same current stamina tick as the selected-army panel, keeping both displays in sync.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Faster First Settlement View",
    description:
      "Settlement textures now prepare during idle map time on supported desktops, reducing local-view pauses once the background warmup completes.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Current-Game Leaderboard",
    description:
      "Fixed the in-game Blitz leaderboard so it shows only players registered in the current match, including players who have not scored yet.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Faster World Entry",
    description:
      "The entry screen now clears as soon as the critical map terrain and entities are ready, while remaining map detail continues loading in the background.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Smoother Terrain Travel",
    description:
      "Map travel now reuses terrain already being prepared before drawing a temporary fallback, reducing late terrain swaps during fast pans.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Faster Map Travel",
    description:
      "Map travel now updates only the armies and structures entering or leaving view, instead of rebuilding everything already on screen.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Smoother Map Hover",
    description:
      "Map hover effects now update at most once per frame and skip unchanged tiles, reducing cursor-driven frame work without affecting clicks or selections.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Faster Building Updates",
    description:
      "Building placements and removals now update only the affected local tile, keeping settlements responsive without rebuilding surrounding terrain.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Reliable Terrain Colors",
    description:
      "Terrain color buffers now exist from the first frame, preventing late tint updates from being missed or shared across scenes.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Reliable Session Recovery",
    description:
      "Slow account restoration now stays in progress, while manual account reconnects show a bounded attempt, clear errors, and a safe retry.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Faster Scene Changes",
    description:
      "World and local view setup now runs during the transition fade, reducing the wait before the next scene appears.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Uninterrupted Map Travel",
    description:
      "Routine zooming and terrain updates no longer dim the world, while genuine terrain recovery stays visible as a compact status.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Faster Game Entry",
    description:
      "Game code and assets now begin loading as soon as you enter a play route, reducing waits even when account restoration is slow.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-20",
    title: "Reliable Game Entry",
    description:
      "Game entry now mounts the world once, preventing duplicate startup work and lost readiness while the world loads.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-17",
    title: "Live World Facts",
    description:
      "Army movement, battle previews, terrain, transfers, and game-entry progress now follow live indexed state, preventing stale displays, submissions, and fixed-delay waits.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-16",
    title: "Reliable Battle Results",
    description:
      "Missed crate reveals and combat effects now recover automatically after brief connection interruptions.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-16",
    title: "Instant Building Placement",
    description:
      "New buildings now appear as soon as placement is submitted, while successful army moves stay at their destination and unlock promptly after confirmation.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-16",
    title: "Action-Ready Armies and Chests",
    description:
      "Armies unlock as soon as movement confirms, realm provisioning appears in one step, and relic chests recover their reveal even if the live event connection drops.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-16",
    title: "Faster Reliable World Entry",
    description:
      "Fixed long world-entry warm-up stalls and made returns from Hexception recover dropped map refreshes automatically, without needing a camera or URL nudge.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-16",
    title: "Battery-Friendly Rendering",
    description:
      "Added Quality and Battery modes with identical visuals. Battery mode lowers background frame, animation, shadow, and map-prefetch work while the game is idle, then resumes immediately when you interact.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-16",
    title: "Faster World Rendering",
    description:
      "Improved model loading, distant terrain detail, and map updates so entering, zooming, traveling, and returning to the world use less memory with fewer frame stalls or terrain pop-ins.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-14",
    title: "Live In-Game Rankings",
    description:
      "Fixed the rank pill and leaderboard totals so they update from live game state, while activity history refreshes on demand without background polling.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-14",
    title: "Reliable Map Armies",
    description:
      "Fixed armies so movement, creation, and defeat stay current across the world map without stale units or camera-driven repair fetches.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-14",
    title: "Reliable Map Structures",
    description:
      "Fixed structures so new realms, upgrades, and Hyperstructure sites appear and stay current immediately without leaving and returning to the area.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-13",
    title: "Reliable Map Chests",
    description:
      "Fixed relic chests so discoveries, moves, and removals stay current while you pan around the world map without an extra area fetch.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-08-13",
    title: "Whole-World Live Sync",
    description:
      "Improved map synchronization so offscreen armies, structures, resources, and chests stay current and are ready when you move the camera, including after reconnecting.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-08-13",
    title: "Instant Chest Rewards",
    description:
      "Fixed relic-crate rewards so an open army panel receives the new relic immediately without requiring a refresh or reselect.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-06-05",
    title: "Lighter Structure Sync",
    description:
      "Improved owned-structure sync so bursts of ownership updates share a single backfill pass, reducing repeated data fetches while keeping new realms live.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-06-05",
    title: "Reliable Sync Diagnostics",
    description:
      "Fixed bounded map sync health checks so quiet map areas no longer appear stale just because no tile update arrived, with clearer diagnostics and less redundant subscription churn during connection testing.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-06-05",
    title: "Bounded Map Sync",
    description:
      "Added an opt-in bounded world-map sync path so active map areas can receive live updates without processing the full spatial stream.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-06-05",
    title: "Army Ghost Cleanup",
    description:
      "Fixed army rendering so stale model bodies are cleared when units switch render state during movement, reducing frozen duplicates on the map.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-06-05",
    title: "Compact Realm List",
    description:
      "Fixed the in-game realm list so it shows three rows before scrolling, keeping the production panel visible on laptop screens.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-06-05",
    title: "Map Rendering & Graphics Polish",
    description:
      "Fixed world-map rendering so unit models, chests, and the local hex grid stay visible through live updates, chunk transitions, and camera changes; made graphics presets render more cheaply with your saved quality choice now persisting between sessions; and improved Blitz realm setup so fresh realms provision reliably with a tidier realm list.",
    type: "fix",
    gameSlug: "world",
  },
  {
    date: "2026-05-31",
    title: "Factory Biome Tuning",
    description:
      "Added biome climate tuning to Factory V2 so new games, series, and rotations can preview and adjust terrain seeds before launch.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-05-30",
    title: "Smarter Blitz Suggestions",
    description:
      "Improved Suggested Actions in Blitz so fresh realms start with provision plus level-up, resource hints keep wood, coal, and copper balanced, and build hints autobuild directly when selected.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-29",
    title: "Unified Game Dialogs",
    description:
      "Combat, transfers, market confirmations, and military creation now use consistent draggable windows and shared modal styling across the whole in-game HUD.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-28",
    title: "Combat v3 Ranged Attacks",
    description:
      "Crossbowmen can attack from two hexes with reduced ranged damage, Knights are stronger around structure guards, and structures must still be claimed from an adjacent hex.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-05-27",
    title: "Biome Preview Viewer",
    description:
      "Added a factory biome preview with seed controls so creators can inspect generated terrain before applying world configuration.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-27",
    title: "Biome Climate Controls",
    description:
      "Added factory setup controls for biome climate tuning so new worlds can adjust elevation and moisture generation during configuration.",
    type: "feature",
    gameSlug: "world",
  },
  {
    date: "2026-05-26",
    title: "Unit Creation Ghosts",
    description:
      "Added unit-shaped creation previews so newly submitted armies appear as ghosts on their spawn hex while the world catches up.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-25",
    title: "Explore Arrival Previews",
    description:
      "Added the travel-style destination ghost and pulsing arrival ring to explore commands, making a waiting exploration visible immediately.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-23",
    title: "Map Labels & Hover Details",
    description:
      "Restored compact always-on map labels above armies, realms, camps, and key structures, unified them with the detailed hover cards, and made hover details reliably recover after loading and chunk transitions.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-22",
    title: "Clearer Day & Night Cycle",
    description:
      "Improved world lighting so each day phase is easy to read and nights and storms stay legible, with brighter night tones, stronger fill light, and capped weather darkness.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-19",
    title: "Relic Usability Cues",
    description:
      "Army and structure HUD relic tabs now show a usable-vs-total cue, mark empty tabs as disabled, highlight relics that match the selected entity, and surface activatable army relics directly in the HUD.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-18",
    title: "Smoother Map Streaming",
    description:
      "World-map streaming now holds wider live regions, keeps nearby terrain visible while the next chunk hydrates, recovers stalled chunk switches in-session, and reduces blank pop-in during fast travel.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-13",
    title: "Unconstructed Hyperstructures",
    description:
      "Reserved Hyperstructures now appear directly on the map before construction, and you can build them with a double-click or the Create Here action from tile details.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-13",
    title: "Settle Or Spectate",
    description:
      "Blitz game cards now keep spectating alongside settling, so you can preview open worlds before joining and still jump straight into active matches from your game list.",
    type: "improvement",
    gameSlug: "landing",
  },
  {
    date: "2026-05-12",
    title: "Blitz Realm Provisioning",
    description:
      "Blitz realms now enter with a lighter initial setup and show a dedicated in-world provision action beside realm upgrades once the main phase starts, so delayed economy activation is available exactly when it matters.",
    type: "improvement",
    gameSlug: "world",
  },
  {
    date: "2026-05-12",
    title: "Clearer Tile HUD",
    description:
      "Selected structure and army panels now show tab badges for defenders, production, inventory, and relics so key counts are visible before opening each tab.",
    type: "improvement",
    gameSlug: "eternum",
  },
  {
    date: "2026-05-11",
    title: "Single-Step Blitz Entry",
    description:
      "Blitz entry now stays centered on one settlement action instead of sending players through the older staged setup flow.",
    type: "improvement",
    gameSlug: "landing",
  },
  {
    date: "2026-04-25",
    title: "Sidebar Transfer Bars",
    description:
      "The realm sidebar now shows minimal transfer bars for active live and automated routes, so you can see what is moving between structures at a glance without reopening the transfers panel.",
    type: "improvement",
    gameSlug: "eternum",
  },
  {
    date: "2026-04-16",
    title: "Automation Skip Reasons",
    description:
      "Production automation now shows why a realm was skipped, making inactive buildings, missing inputs, and budget limits easier to diagnose.",
    type: "improvement",
    gameSlug: "eternum",
  },
  {
    date: "2026-04-12",
    title: "Auto-Settle Card Switch",
    description:
      "Blitz registrations now turn on an Auto-settle switch directly on the game card, so the client can prewarm the entry flow, try settling as soon as the countdown ends, and push you into the game automatically unless you switch it off.",
    type: "feature",
    gameSlug: "landing",
  },
  {
    date: "2026-04-12",
    title: "Smoother Army Movement",
    description:
      "Army moves now start as soon as the transaction is submitted and leave a destination ghost that absorbs into the real unit on arrival, so movement stays readable through world-sync delays instead of stalling.",
    type: "improvement",
    gameSlug: "eternum",
  },
  {
    date: "2026-04-11",
    title: "Canonical Landing Routes",
    description:
      "Landing navigation now uses dedicated URLs for Play, Learn, News, and Factory with a unified game-entry handoff, so shared links, reloads, and network switches stay aligned.",
    type: "improvement",
    gameSlug: "landing",
  },
  {
    date: "2026-03-24",
    title: "Live Agora AMM Dashboard",
    description:
      "The Agora AMM trading dashboard now lives in the main shell with live pools, charts, and trade history, resource icons across the flow, and real swap and liquidity transactions against the Agora contracts.",
    type: "feature",
  },
  {
    date: "2026-03-24",
    title: "Research Relic Crafting",
    description:
      "Realm and Village economy panels now support crafting relics directly from research with preflight checks, crafting feedback, and immediate relic inventory refresh.",
    type: "feature",
  },
  {
    date: "2026-03-23",
    title: "Army Spire Traversal",
    description:
      "Armies adjacent to a Spire now get a dedicated Spire action — opening a combat preview against an ethereal defender or a direct travel window into the Ethereal Layer — without forcing the map to switch layers.",
    type: "feature",
  },
  {
    date: "2026-03-20",
    title: "Factory V2 Launch Center",
    description:
      "The landing page now has a full Factory V2 flow for starting a game, checking progress, and recovering pending launches, with Blitz opening first when Factory is idle, calmer progress states, and a layout that holds up much better on mobile.",
    type: "feature",
    gameSlug: "landing",
  },
  {
    date: "2026-03-19",
    title: "Wonder Faith & Devotion",
    description:
      "Wonders now have a dedicated faith detail view and a Faith leaderboard tab ranking wonders by Faith Points, and Realm and Village panels let you devote to a Wonder directly in-game with FP/sec and follower stats.",
    type: "feature",
  },
  {
    date: "2026-02-17",
    title: "Game Review for Ended Worlds",
    description:
      "Ended games now include a dedicated Game Review flow with final rankings, score highlights, and share-ready recap cards so you can revisit each world after it concludes.",
    type: "feature",
  },
  {
    date: "2026-02-05",
    title: "New Landing Experience",
    description:
      "The landing page has been completely redesigned! Browse Live, Upcoming, and Ended games in organized columns, register for games directly from the home screen, and enjoy faster game loading with instant entry that lands you right at your realm.",
    type: "feature",
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
    title: "Prediction Market: Custom Odds",
    description:
      "Create prediction markets with customizable player weights and odds. Select 1-5 players, adjust individual weights, and see real-time percentage chances. The 'None of the above' option is also customizable. Minimum funding reduced to 100 LORDS.",
    type: "feature",
  },
  {
    date: "2026-01-13",
    title: "Transaction Status Center",
    description:
      "A new transaction center is available in the bottom-right corner. Track all your pending, confirmed, and failed transactions in real-time with a status beacon indicator, and click any transaction to view details on Voyager.",
    type: "feature",
  },
  {
    date: "2026-01-09",
    title: "Troop Balance Update",
    description:
      "Paladin stamina has been increased to 120, and mercenary troop bounds have been adjusted to 800-1600 for improved balance.",
    type: "balance",
  },
];

export const latestFeatures = buildLatestFeaturesFeed(allLatestFeatures);
