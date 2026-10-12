import { Link } from "react-router-dom";

import { COMMUNITY } from "../community";
import { FOOTER_WORDS } from "../words";

type FooterLink = { word: string; to: string };

/** Where realms.world's own sites live: the DAO, the token and trading stay there. */
const REALMS_WORLD = "https://realms.world";
const MARKETPLACE = "https://market.realms.world";

const COLUMNS: readonly { title: string; links: readonly FooterLink[] }[] = [
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

/**
 * The desktop's footer at the end of a page that scrolls: what the rail does not already hold. The community, Realms'
 * own sites and the legal pages live here and nowhere else on the page.
 */
export const AppFooter = () => (
  <footer data-band="footer" className="mt-16 border-t border-kit-line pt-10">
    <div className="grid grid-cols-3 gap-8">
      {COLUMNS.map((column) => (
        <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2">
          <b className="mb-1 font-ui text-[14px] tracking-[.06em] text-kit-gold">{column.title}</b>
          {column.links.map((link) => (
            <FooterAnchor key={link.to} link={link} />
          ))}
        </nav>
      ))}
    </div>
    <p className="mt-10 border-t border-kit-line py-5 text-[13px] text-kit-muted">{FOOTER_WORDS.owner}</p>
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
