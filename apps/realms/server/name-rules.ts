/**
 * The display-name rules (value-plane design §3): 3–20 characters, letters,
 * numbers, spaces, - or _, no leading or trailing space. Pure — the database
 * hook in auth.ts is the one writer-side chokepoint that applies them.
 */
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]{1,18}[A-Za-z0-9]$/;

export const nameRuleViolation = (name: string): string | null => {
  if (name.length < 3 || name.length > 20) return "3 to 20 characters";
  if (!NAME_PATTERN.test(name)) return "letters, numbers, spaces, - or _; no leading or trailing space";
  return null;
};

/**
 * A display name to offer a new player, from their Discord name or their email's local part: disallowed characters
 * dropped, cut to the rules' length. Null when nothing valid is left; the player can always type their own.
 */
export const suggestedNameOf = (source: string): string | null => {
  const candidate = source
    .replace(/[^A-Za-z0-9 _-]/g, "")
    .slice(0, 20)
    .replace(/^[ _-]+|[ _-]+$/g, "");
  return nameRuleViolation(candidate) === null ? candidate : null;
};
