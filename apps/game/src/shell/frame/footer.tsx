import { Link } from "react-router-dom";

import { COMMUNITY } from "../community";
import { DOCS } from "../learn/guides";
import { SCROLL_PATH } from "../learn/posts";
import { AGES } from "../play/ages";
import { FOOTER_WORDS, LEARN_WORDS, LORE_LINE, WORDS } from "../words";
import { Kbd } from "./kbd";

type FooterLink = { word: string; to: string };

/** Where realms.world's own sites live: the DAO, the token and trading stay there. */
const REALMS_WORLD = "https://realms.world";
const MARKETPLACE = "https://market.realms.world";

const COLUMNS: readonly { title: string; links: readonly FooterLink[] }[] = [
  { title: WORDS.play, links: AGES.map((age) => ({ word: age.name, to: age.page })) },
  {
    title: WORDS.learn,
    links: [
      { word: FOOTER_WORDS.guides, to: "/learn" },
      { word: LEARN_WORDS.scroll, to: SCROLL_PATH },
      { word: FOOTER_WORDS.gameDocs, to: DOCS },
    ],
  },
  { title: FOOTER_WORDS.community, links: COMMUNITY.map((place) => ({ word: place.name, to: place.href })) },
  {
    title: FOOTER_WORDS.realms,
    links: [
      { word: "realms.world", to: REALMS_WORLD },
      { word: FOOTER_WORDS.marketplace, to: MARKETPLACE },
    ],
  },
  {
    title: FOOTER_WORDS.legal,
    links: [
      { word: FOOTER_WORDS.terms, to: "/terms" },
      { word: FOOTER_WORDS.privacy, to: "/privacy" },
      { word: FOOTER_WORDS.credits, to: "/credits" },
    ],
  },
];

/** The desktop's footer at the end of a page that scrolls: the mark and the lore line, the app's links, the keys. */
export const AppFooter = () => (
  <footer data-band="footer" className="mt-16 border-t border-kit-line pt-10">
    <div className="grid grid-cols-[1.4fr_repeat(5,1fr)] gap-8">
      <div className="flex flex-col gap-3">
        <img src="/images/logos/realms-lockup-stacked.svg" alt="Realms" className="w-16" />
        <p className="text-[14px] text-kit-muted">{LORE_LINE}</p>
      </div>
      {COLUMNS.map((column) => (
        <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2">
          <b className="mb-1 font-ui text-[14px] tracking-[.06em] text-kit-gold">{column.title}</b>
          {column.links.map((link) => (
            <FooterAnchor key={link.to} link={link} />
          ))}
        </nav>
      ))}
    </div>
    <div className="mt-10 flex items-center gap-3 border-t border-kit-line py-5 text-[13px] text-kit-muted">
      <span>{FOOTER_WORDS.owner}</span>
      <span className="ml-auto flex items-center gap-1.5">
        <Kbd keyName="1" />–<Kbd keyName="4" /> {FOOTER_WORDS.places} · <Kbd keyName="Esc" /> {FOOTER_WORDS.back}
      </span>
    </div>
  </footer>
);

/** The app's own pages open in place; other sites in a new tab. */
const FooterAnchor = ({ link }: { link: FooterLink }) => {
  const className = "text-[14px] text-kit-cream hover:text-kit-gold2";
  return link.to.startsWith("/") ? (
    <Link to={link.to} className={className}>
      {link.word}
    </Link>
  ) : (
    <a href={link.to} target="_blank" rel="noopener noreferrer" className={className}>
      {link.word}
    </a>
  );
};
