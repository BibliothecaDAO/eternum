import { NAME_MAX_LENGTH, nameRuleViolation } from "./account-rules";

/**
 * Chat mentions as players write them: "@" and a player's name, plain text in the message. This is the one reading of
 * where a mention is and what names it may be; the client draws and suggests mentions by it, and the chat server finds
 * whom to notify by it.
 */

/** A character a name may hold, but for the space: a name ends where these stop, and a space may go on to a longer one. */
export const NAME_CHARACTER = /[A-Za-z0-9_-]/;

/** An "@" starts a mention at the message's start or after a space, never inside a word ("ada@realms.test"). */
export const startsMention = (text: string, at: number): boolean =>
  text[at] === "@" && (at === 0 || /\s/.test(text[at - 1]!));

/** The mentions in one message the server notifies, at most: more is a roll call, not a conversation. */
export const MENTIONS_PER_MESSAGE = 5;

/**
 * The names each mention in a message may be, longest first, for its first MENTIONS_PER_MESSAGE mentions: every
 * stretch after the "@" that the name rules allow and that ends where the next character is no name character. Which
 * one it is depends on the names known: the longest of them that is a player's name.
 */
export const mentionCandidates = (content: string): string[][] => {
  const mentions: string[][] = [];
  for (let at = 0; at < content.length && mentions.length < MENTIONS_PER_MESSAGE; at += 1) {
    if (!startsMention(content, at)) continue;
    const names: string[] = [];
    for (let end = at + 2; end <= Math.min(content.length, at + 1 + NAME_MAX_LENGTH); end += 1) {
      const next = content[end];
      const name = content.slice(at + 1, end);
      if ((next === undefined || !NAME_CHARACTER.test(next)) && nameRuleViolation(name) === null) names.unshift(name);
    }
    if (names.length > 0) mentions.push(names);
  }
  return mentions;
};
