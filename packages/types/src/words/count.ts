/**
 * The words module's one plural rule. A file of its own, importing nothing, so the game's tables (relics.ts) can count
 * with it without importing the nouns that read those tables.
 */
const exact = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const CARDINAL = new Intl.PluralRules("en-US");

/**
 * A count with its noun, exact, the noun in its right number: "1 slot", "0 slots", "3 armies". The plural is the
 * noun plus "s" unless given ("army", "armies"). A noun can carry its verb, so the sentence agrees too: formatCount(n,
 * "slot is", "slots are") reads "1 slot is", "2 slots are". The one plural rule: no caller picks a noun's number.
 */
export const formatCount = (count: number, singular: string, plural = `${singular}s`): string =>
  `${exact.format(count)} ${CARDINAL.select(count) === "one" ? singular : plural}`;
