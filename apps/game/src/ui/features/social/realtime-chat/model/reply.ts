/** What a reply carries of the message it answers, in its metadata: enough to quote it without loading it. */
interface ReplyTo {
  id: string;
  playerId: string;
  excerpt: string;
}

/** How much of the answered message a reply quotes. */
const EXCERPT_CHARACTERS = 80;

/** The metadata a reply is sent with. */
export const replyMetadata = (answered: { id: string; playerId: string; content: string }) => ({
  replyTo: { id: answered.id, playerId: answered.playerId, excerpt: answered.content.slice(0, EXCERPT_CHARACTERS) },
});

/** The message a message answers, from its metadata; none when it answers nothing or the metadata is not a reply's. */
export const replyOf = (metadata: Readonly<Record<string, unknown>> | undefined): ReplyTo | null => {
  const reply = metadata?.replyTo;
  if (typeof reply !== "object" || reply === null) return null;
  const { id, playerId, excerpt } = reply as Record<string, unknown>;
  return typeof id === "string" && typeof playerId === "string" && typeof excerpt === "string"
    ? { id, playerId, excerpt }
    : null;
};
