import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { AppLink } from "@/ui/design-system/kit/app-elements";
import { FOOTER_WORDS, PROFILE_WORDS, WORDS } from "@/ui/design-system/kit/words";

import { COMMUNITY, HOW_TO_PLAY, MARKET } from "../community";
import { WHATS_NEW_PATH } from "./tabs";

/** A link of the footer: its word, where it leads, and a social's official mark before its word. */
type FooterLink = { word: string; to: string; icon?: IconMeaning };

/** Where realms.world lives: the DAO and the token stay there; its marketplace is You's row and the footer's. */
const REALMS_WORLD = "https://realms.world";

const COLUMNS: readonly { title: string; links: readonly FooterLink[] }[] = [
  {
    title: FOOTER_WORDS.community,
    links: COMMUNITY.map((place) => ({ word: place.name, to: place.href, icon: place.icon })),
  },
  {
    title: FOOTER_WORDS.realms,
    // What You's rows hold: signed out, You is Connect, so the footer is where a new visitor finds them.
    links: [
      { word: WORDS.whatsNew, to: WHATS_NEW_PATH },
      { word: PROFILE_WORDS.howToPlay, to: HOW_TO_PLAY },
      { word: WORDS.market, to: MARKET },
      { word: "realms.world", to: REALMS_WORLD },
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
 * The footer at the end of every page of the app (not a full-screen step): what the places do not hold. The community
 * with each social's mark, What's new, How to play, the marketplace, Realms' own site and the legal pages; a phone stacks
 * its columns.
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
              className="flex min-h-8 items-center gap-2 font-ui text-sm text-kit-cream hover:text-kit-gold2"
            >
              {link.icon && <Icon name={link.icon} size={18} />}
              {link.word}
            </AppLink>
          ))}
        </nav>
      ))}
    </div>
    <p className="mt-10 border-t border-kit-line py-5 text-sm text-kit-muted">{FOOTER_WORDS.owner}</p>
  </footer>
);
