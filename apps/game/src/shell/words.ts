/**
 * The app's words outside a match, each spelled once (words.html; the Frontier glossary stays the authority for game
 * words). A screen never types one of these itself: it names the constant.
 */
export const WORDS = {
  play: "Play",
  season: "Season",
  learn: "Learn",
  profile: "Profile",
  signIn: "Sign in",
  /** The back arrow is wordless; this names it for assistive technology. */
  back: "Back",
  dev: "Dev",
} as const;
