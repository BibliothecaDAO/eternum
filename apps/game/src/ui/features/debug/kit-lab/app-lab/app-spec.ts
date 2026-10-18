/**
 * The app's spec, one line per page (owner, 18 October 2026: "the spec first"): what it is for and its one primary action,
 * read from the shell's code (its comments are the spec; the written spec 01–14 is lost), with what the sheet proposes
 * to keep, merge or cut. Fourteen addresses today, twelve kinds of page; nine after the merges.
 */
type SpecPage = {
  page: string;
  route: string;
  job: string;
  primary: string;
  verdict: "keep" | "merge" | "cut";
  why?: string;
};

export const APP_SPEC: readonly SpecPage[] = [
  {
    page: "Play",
    route: "/",
    job: "What the player can do now, then each age's next and finished games.",
    primary: "The lead game's verb: Resume, Enter, Join, Play free, Results.",
    verdict: "keep",
    why: "The index, the first visit's landing and the most-used page.",
  },
  {
    page: "Blitz lobby",
    route: "/blitz/:id",
    job: "One Blitz before it starts: its clock, who is in, the paid entry, the chat.",
    primary: "Pay and join; then Enter when the game opens.",
    verdict: "keep",
  },
  {
    page: "Season",
    route: "/season",
    job: "Where the player stands this season: Frontier's board and Blitz's rating with its prize.",
    primary: "Read the boards; Claim the prize once the season ends.",
    verdict: "keep",
  },
  {
    page: "Results",
    route: "/results/:id",
    job: "How a finished game ended for the player: the outcome, the board, the rating and the chest.",
    primary: "Continue; Open while a chest is sealed.",
    verdict: "keep",
  },
  {
    page: "You",
    route: "/profile",
    job: "The player's card and finished games, then the ways to Settings, How to play and What's new.",
    primary: "None while signed in (its rows); Sign in when signed out.",
    verdict: "keep",
    why: "Takes in another player's page: the same card and games.",
  },
  {
    page: "A player",
    route: "/p/:address",
    job: "Another player's card and finished games, opened from a board.",
    primary: "None (open a game's Results).",
    verdict: "merge",
    why: "The same page as You, for someone else: one profile page, own or another's.",
  },
  {
    page: "Settings",
    route: "/profile/settings",
    job: "Every setting on one page: account, payout wallet, notifications, music, devices, Sign out.",
    primary: "Link the payout wallet (the page's real job: it pays Blitz entries and prizes).",
    verdict: "keep",
  },
  {
    page: "What's new",
    route: "/scroll",
    job: "The Scroll's posts and the latest changes, newest first.",
    primary: "Open a post.",
    verdict: "keep",
    why: "Takes in the post: on a desktop the list and the post read side by side.",
  },
  {
    page: "A post",
    route: "/scroll/:post",
    job: "One post in a reading column, with the Scroll's other posts beside it.",
    primary: "Read; Newer and Older.",
    verdict: "merge",
    why: "The list's reading pane on a desktop: one News page with the post open.",
  },
  {
    page: "Terms, Privacy, Credits",
    route: "/terms, /privacy, /credits",
    job: "Plain reading with numbered sections, from the footer.",
    primary: "Read.",
    verdict: "merge",
    why: "Three pages of one kind: one Legal page with its three documents as tabs.",
  },
  {
    page: "Sign in",
    route: "/sign-in",
    job: "Discord or an emailed code, then a new account's name and portrait; back to where the player was.",
    primary: "Continue with Discord, or Send code.",
    verdict: "keep",
  },
  {
    page: "Nothing here",
    route: "* (and a missing game, player or post)",
    job: "Says the address leads nowhere and offers Play.",
    primary: "Play.",
    verdict: "cut",
    why: "A state, not a page: the sheet's empty state inside whichever page found nothing.",
  },
];
