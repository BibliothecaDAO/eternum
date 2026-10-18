/**
 * The research behind the app's pages (owner, 18 October 2026: "do research on simple and efficient desktop game icons
 * (and then mobile)"): shipped game launchers and menus, what each puts on its first screen, and what makes them simple
 * and efficient; then what the app takes from them. Read from the shipped clients and the sources linked; no
 * screenshot is copied (their art is licensed), the Game UI Database holds them.
 */

export type Reference = {
  game: string;
  platform: "desktop" | "mobile";
  /** What the first screen holds, in a line. */
  screen: string;
  /** Where the one verb sits, and how it looks. */
  verb: string;
  /** How it uses pictures: art, icons, currencies. */
  pictures: string;
  /** The lesson for the app. */
  lesson: string;
};

export const REFERENCES: readonly Reference[] = [
  {
    game: "League of Legends (Riot Client)",
    platform: "desktop",
    screen:
      "A top bar of places (Home, TFT, Clash, Collection, Loot, Store), news over key art below, friends down the right.",
    verb: "PLAY, top left, the brightest thing on screen; it never moves.",
    pictures:
      "Every place an icon with its word; the currencies (RP, Blue Essence) with their icons at the top right beside the profile and its portrait.",
    lesson: "The verb has one fixed place; a currency is its icon and its number, beside the profile.",
  },
  {
    game: "Battle.net",
    platform: "desktop",
    screen: "Games as icon tiles; each game's page is its full-bleed key art with news cards over it.",
    verb: "Play, bottom left of the art, large, with the version beside it.",
    pictures: "Each game is known by its icon in the list and its art on its page: the same art wherever it shows.",
    lesson: "A game's page stands on its own art; the art is how a player tells games apart at a glance.",
  },
  {
    game: "Steam library",
    platform: "desktop",
    screen: "The game's hero art across the top, then its facts (play time, achievements, friends) as cards.",
    verb: "Play, large and green, on the hero's foot.",
    pictures: "Achievements are their own small paintings with a count; friends are portraits.",
    lesson: "Hero art, one verb on it, facts in cards under it, each fact with its picture.",
  },
  {
    game: "Dota 2",
    platform: "desktop",
    screen: "A top bar of icon places, a hero standing on the background art, the player's card and recent games.",
    verb: "PLAY DOTA, bottom right, wide and lit.",
    pictures: "Every hero, item and rank a painting; ranks are medals, never only numbers.",
    lesson: "A rank is a medal: the rating's picture beside its number.",
  },
  {
    game: "Age of Empires IV, Age of Empires II DE",
    platform: "desktop",
    screen: "Full-bleed civilisation art; the menu a column of large words on a dark band.",
    verb: "Single Player and Multiplayer head the column.",
    pictures: "Each civilisation is its emblem and its painting; the lobby's slots show a player's emblem and colour.",
    lesson: "The art carries the mood; text sits on a band darkened for it, never straight on the painting.",
  },
  {
    game: "Heroes of Might and Magic III",
    platform: "desktop",
    screen: "A painted castle menu; the scenario picker a ledger of maps.",
    verb: "Begin, under the ledger.",
    pictures:
      "The ledger's columns are icons (players, size, victory and loss conditions), each read at a glance; resources always with their icon.",
    lesson: "A table earns an icon per column; a resource is never a bare number.",
  },
  {
    game: "Hearthstone",
    platform: "desktop",
    screen: "A box with a few large mode buttons in the middle; friends bottom left, gold and the menu bottom right.",
    verb: "The mode buttons themselves; one tap enters a mode.",
    pictures: "The box is the art; gold is its coin and a number; packs and rewards are drawn as objects.",
    lesson: "Few choices, large; a reward is an object the player can see, not a word.",
  },
  {
    game: "Clash Royale",
    platform: "mobile",
    screen: "The arena's art in the middle, the chest slots under it, a bottom bar of icon tabs.",
    verb: "Battle, large and yellow, at the thumb.",
    pictures: "Chests drawn by tier (each tier its own chest), opened in place; gold and gems with icons at the top.",
    lesson: "A reward's tier is its chest's art; sealed and opened are two pictures of the same chest.",
  },
  {
    game: "Brawl Stars",
    platform: "mobile",
    screen: "The player's brawler in the middle, the event card (mode art and name) beside the verb.",
    verb: "Play, large and yellow, bottom right.",
    pictures: "Each mode its art and icon on its card; currencies with icons across the top.",
    lesson: "A mode is its art and its icon on the card that enters it.",
  },
  {
    game: "Marvel Snap",
    platform: "mobile",
    screen: "The deck and the season's card in the middle, a bottom bar of icon tabs with words.",
    verb: "Play, huge, bottom centre over the tabs.",
    pictures: "Every tab an icon with its word; the season's track a painted card.",
    lesson: "On a phone, places go to a bottom bar of icons with words, and the verb sits over it.",
  },
];

/** What makes them simple and efficient, read across the references. */
export const PRINCIPLES: readonly { rule: string; seen: string }[] = [
  {
    rule: "One verb, in one fixed place, the largest and brightest thing.",
    seen: "League, Battle.net, Brawl Stars, Snap",
  },
  {
    rule: "Every place and every currency is an icon with its word; an icon alone only for a universal tool.",
    seen: "League, Dota, Snap",
  },
  {
    rule: "Each game or mode has its art, used wherever it shows: its tile, its header, its page's background.",
    seen: "Battle.net, Steam, Brawl Stars",
  },
  {
    rule: "Currencies sit at the top right with their icons, beside the profile.",
    seen: "League, Brawl Stars, Clash Royale",
  },
  {
    rule: "A reward is an object: its tier is its art, and opening it changes the picture.",
    seen: "Clash Royale, Hearthstone",
  },
  {
    rule: "Text sits on one kind of panel, darkened over the art; every screen uses the same panel.",
    seen: "Age of Empires, League, Steam",
  },
  {
    rule: "A rank or a resource is its picture and its number, never a bare number.",
    seen: "Dota, Heroes III",
  },
  {
    rule: "Desktop: places across the top, content under them. Phone: places in a bottom bar of icons, the verb over it.",
    seen: "League, Dota; Clash Royale, Snap",
  },
];

/** What the app takes from them, page by page. */
export const TAKEN: readonly { where: string; what: string }[] = [
  {
    where: "Every page",
    what: "Stands on its painting (the age or mode it shows, else the app's landscape), graded dark where panels sit; one panel style, translucent over the art.",
  },
  { where: "Top bar", what: "Places with their icons, LORDS with its icon and the profile's portrait at the right." },
  { where: "Play", what: "Each age its art and its numeral; the lead game's verb the one gold button." },
  {
    where: "Blitz lobby",
    what: "Blitz's art behind it; seats as portraits; the entry's seat, sword and shield as their icons; LORDS with its icon.",
  },
  { where: "Season", what: "Each board under its mode's art; the rating with its medal; LORDS with its icon." },
  { where: "Results", what: "The chest drawn at its tier, sealed then opened; points by kind, each with its icon." },
];

export const SOURCES: readonly { label: string; url: string }[] = [
  { label: "Game UI Database (screens of each game above)", url: "https://www.gameuidatabase.com/" },
  { label: "Hearthstone wiki: Main menu", url: "https://hearthstone.wiki.gg/wiki/Main_menu" },
  { label: "League of Legends wiki: Client", url: "https://wiki.leagueoflegends.com/en-us/Client" },
  {
    label: "Riot: The visual language of Hextech",
    url: "https://nexus.leagueoflegends.com/en-us/2016/12/the-visual-language-of-hextech",
  },
  {
    label: "GameAnalytics: how to make your game UI shine",
    url: "https://www.gameanalytics.com/blog/how-to-make-your-game-ui-shine-and-increase-conversions",
  },
];
