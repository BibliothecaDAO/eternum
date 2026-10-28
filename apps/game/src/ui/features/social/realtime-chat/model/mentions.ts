/**
 * Chat mentions, kept as the plain text a player types: "@" and a player's name. A message carries no new field; a
 * reader finds a mention by matching the names it knows. Names may hold spaces ("Ser Ada"), so a mention is found by
 * the names, never by a word pattern.
 */

/** A name ends where a character a name may hold stops (letters, digits, "_" and "-"); a space may go on to a longer one. */
const NAME_CHARACTER = /[A-Za-z0-9_-]/;

/** An "@" starts a mention at the message's start or after a space, never inside a word ("ada@realms.test"). */
const startsMention = (text: string, at: number): boolean => text[at] === "@" && (at === 0 || /\s/.test(text[at - 1]!));

/** The "@" the caret is typing a mention after, and what is typed since: null when the caret is in no mention. */
export const typedMention = (text: string, caret: number): { at: number; query: string } | null => {
  const at = text.lastIndexOf("@", caret - 1);
  if (at < 0 || !startsMention(text, at)) return null;
  const query = text.slice(at + 1, caret);
  return query.includes("\n") ? null : { at, query };
};

/** The names a typed mention may become: those starting with it, ignoring case, in name order, six at most. */
export const mentionChoices = (names: readonly string[], query: string): string[] => {
  const typed = query.toLowerCase();
  return names
    .filter((name) => name.toLowerCase().startsWith(typed))
    .toSorted((a, b) => a.localeCompare(b))
    .slice(0, 6);
};

/** The text with the mention typed from `at` to the caret written as `@name` and a space, and the caret after it. */
export const insertMention = (text: string, at: number, caret: number, name: string) => {
  const rest = text.slice(caret);
  const mention = `@${name}${rest.startsWith(" ") ? "" : " "}`;
  return { text: text.slice(0, at) + mention + rest, caret: at + mention.length + (rest.startsWith(" ") ? 1 : 0) };
};

type MessagePart =
  | { type: "text"; text: string }
  | { type: "mention"; text: string; name: string }
  | { type: "link"; url: URL };

/** The longest known name written at `from` (ignoring case), whole: what follows it is no character a name holds. */
const nameAt = (text: string, from: number, names: readonly string[]): string | null => {
  let found: string | null = null;
  for (const name of names) {
    if (found !== null && name.length <= found.length) continue;
    if (text.slice(from, from + name.length).toLowerCase() !== name.toLowerCase()) continue;
    const next = text[from + name.length];
    if (next === undefined || !NAME_CHARACTER.test(next)) found = name;
  }
  return found;
};

/**
 * A message's text as it reads: mentions of a known name, links, and the words between. Numbers stay words: "1,200
 * knights" is never a place.
 */
export const messageParts = (content: string, names: readonly string[]): MessagePart[] => {
  const parts: MessagePart[] = [];
  let words = "";
  const flush = () => {
    if (words) parts.push(...linkParts(words));
    words = "";
  };
  for (let index = 0; index < content.length; ) {
    const name = startsMention(content, index) ? nameAt(content, index + 1, names) : null;
    if (name === null) {
      words += content[index];
      index += 1;
      continue;
    }
    flush();
    parts.push({ type: "mention", text: content.slice(index, index + name.length + 1), name });
    index += name.length + 1;
  }
  flush();
  return parts;
};

/** A web address as written: http(s), up to a space; the punctuation that ends a sentence stays outside it. */
const LINK = /https?:\/\/[^\s<>"']+?(?=[.,;:!?)\]]*(?:\s|$))/gi;

const parsedUrl = (text: string): URL | null => {
  try {
    return new URL(text);
  } catch {
    return null;
  }
};

const linkParts = (text: string): MessagePart[] => {
  const parts: MessagePart[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const url = parsedUrl(match[0]);
    if (!url) continue;
    if (match.index > last) parts.push({ type: "text", text: text.slice(last, match.index) });
    parts.push({ type: "link", url });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
};

/** Whether a message's parts mention this name. */
export const mentions = (parts: readonly MessagePart[], name: string | null): boolean =>
  name !== null && parts.some((part) => part.type === "mention" && part.name.toLowerCase() === name.toLowerCase());
