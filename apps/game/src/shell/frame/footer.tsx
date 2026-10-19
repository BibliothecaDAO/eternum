import { AppLink } from "@/ui/design-system/kit/app-elements";
import { FOOTER_WORDS } from "@/ui/design-system/kit/words";

import { COMMUNITY } from "../community";

type FooterLink = { word: string; to: string };

/** Where realms.world lives: the DAO and the token stay there; its marketplace is a place in the bar. */
const REALMS_WORLD = "https://realms.world";

const COLUMNS: readonly { title: string; links: readonly FooterLink[] }[] = [
  { title: FOOTER_WORDS.community, links: COMMUNITY.map((place) => ({ word: place.name, to: place.href })) },
  {
    title: FOOTER_WORDS.realms,
    links: [{ word: "realms.world", to: REALMS_WORLD }],
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
 * The footer at the end of What's new and the pages read from it: what the places do not hold. The community, Realms'
 * own sites and the legal pages live here and nowhere else; a phone stacks its columns.
 */
export const AppFooter = () => (
  <footer data-band="footer" className="mt-10 border-t border-kit-line pt-8 lg:mt-16 lg:pt-10">
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
      {COLUMNS.map((column) => (
        <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2">
          <b className="mb-1 font-ui text-sm text-kit-gold">{column.title}</b>
          {column.links.map((link) => (
            <AppLink
              key={link.to}
              to={link.to}
              className="flex min-h-8 items-center font-ui text-sm text-kit-cream hover:text-kit-gold2"
            >
              {link.word}
            </AppLink>
          ))}
        </nav>
      ))}
    </div>
    <p className="mt-10 border-t border-kit-line py-5 text-sm text-kit-muted">{FOOTER_WORDS.owner}</p>
  </footer>
);
