import { isRealmsSite } from "@/config/app-address";
import { Icon } from "@/ui/design-system/icon";

import { messageParts } from "../../model/mentions";

/**
 * A message's words as they read: a mention of a player in the accent (the reader's own in gold), a link as its site and
 * path, pressable, one off Realms' own sites marked as leaving, and the rest as written.
 */
export const MessageText = ({
  content,
  names,
  me,
  onLink,
}: {
  content: string;
  /** The players a mention may name. */
  names: readonly string[];
  /** The reader's own name, lit where it is mentioned. */
  me: string | null;
  onLink: (url: URL) => void;
}) =>
  messageParts(content, names).map((part, index) =>
    part.type === "text" ? (
      <span key={index}>{part.text}</span>
    ) : part.type === "mention" ? (
      <span key={index} data-mention={part.name} className={part.name === me ? "text-hud-gold" : "text-hud-accent"}>
        {part.text}
      </span>
    ) : (
      <a
        key={index}
        href={part.url.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => {
          event.preventDefault();
          onLink(part.url);
        }}
        className="break-all text-hud-accent underline underline-offset-2"
      >
        {linkWords(part.url)}
        {!isRealmsSite(part.url) && (
          <Icon name="external-link" size={14} className="ml-0.5 inline-block align-[-2px]" alt="" />
        )}
      </a>
    ),
  );

/** A link as a reader reads it: its site and where on it, without the protocol or a leading www. */
const linkWords = (url: URL) =>
  `${url.host.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}${url.search}`;
