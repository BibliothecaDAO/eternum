import { cn } from "@/ui/design-system/atoms/lib/utils";

import { orderEmblem } from "./order-emblem";

/**
 * The Aspects wear their Orders' sigils, in their colours (the owner, 8 October 2026): Rage for Battle, Skill for
 * Logistics and for the guide (the Aspect of Skill speaks it), Detection for Scouting, Enlightenment, the Aspect of
 * Light, for Homecoming. By the Orders' ids as the game numbers them.
 */
const ASPECT_SIGILS = {
  rage: orderEmblem(3).art,
  skill: orderEmblem(9).art,
  detection: orderEmblem(8).art,
  light: orderEmblem(16).art,
};

/** An icon of the kit's gilded family, Icons 2 (asset-sources/icons/kit; `pnpm icons:kit:build`). */
const kit = (slug: string) => `/image-icons/kit/${slug}.png`;

/**
 * The handoff's icon codes (frontier-mobile-ui/handoff.html, Icons): the gilded family where its master exists, the
 * art that exists today elsewhere (the building renders and attribute glyphs wait for their masters, Discord keeps
 * its brand mark). A code the art pass redraws changes here and nowhere else.
 */
const ICONS = {
  Es: kit("essence"),
  La: kit("labor"),
  Wh: kit("wheat"),
  Tr: kit("troops"),
  Lo: kit("lords-coin"),
  St: kit("ui-lightning"),
  Hg: kit("hourglass"),
  Ey: kit("ui-eye"),
  Bt: kit("ui-footprints"),
  At: kit("attack"),
  Sk: kit("ui-skull"),
  Ch: kit("ui-chest"),
  Cp: kit("ui-camp"),
  Rf: kit("rift"),
  Fr: kit("fr-site-ruin"),
  Sh: kit("sh-site-shrine"),
  Wl: kit("wl-site-well"),
  Fl: kit("ui-flag"),
  Mp: kit("map"),
  Cs: kit("realm-home"),
  Rs: kit("ui-flask"),
  Ct: kit("ui-message"),
  Mn: kit("ui-menu"),
  Fm: "/images/buildings/construction/farm.png",
  Wk: "/images/buildings/construction/castleZero.png",
  Bs: "/images/buildings/construction/barracks.png",
  Ht: "/images/buildings/construction/workers_hut.png",
  Hx: kit("ui-hexagon"),
  Pp: kit("ui-person"),
  Ok: kit("ui-check"),
  Lk: kit("ui-lock"),
  Tp: kit("trophy"),
  Hm: kit("exit"),
  // The four army attributes, each its Aspect's sigil.
  Ba: ASPECT_SIGILS.rage,
  Lg: ASPECT_SIGILS.skill,
  Sc: ASPECT_SIGILS.detection,
  Su: ASPECT_SIGILS.light,
  // The four training buildings wait for their paintings; the sigil of the attribute each trains stands in.
  Wa: ASPECT_SIGILS.rage,
  Sy: ASPECT_SIGILS.skill,
  Ld: ASPECT_SIGILS.detection,
  He: ASPECT_SIGILS.light,
  // The six research sides.
  Fi: kit("fields"),
  Gr: kit("granary"),
  To: kit("tools"),
  So: kit("storehouse"),
  Dr: kit("drill"),
  Ra: kit("rations"),
  // The seal: a choice final for the season.
  Fx: kit("final-seal"),
  Sl: kit("army-slots"),
  Sg: kit("store-limit"),
  Cl: kit("game-clock"),
  // The guide's mark: the Aspect of Skill's sigil.
  Gd: ASPECT_SIGILS.skill,
  Of: kit("ui-network-off"),
  Cv: kit("ui-chevron-down"),
  Bk: kit("back"),
  Sp: kit("ui-refresh"),
  // The app's own codes (app handoff, Icons): play, and watch (a spyglass, never the explore eye).
  Pl: kit("ui-play"),
  Wc: kit("ui-telescope"),
  Dc: "/image-icons/discord.png",
  Em: kit("ui-mail"),
  Ed: kit("ui-edit"),
  Pf: kit("ui-person"),
  Dv: kit("ui-monitor"),
  Dp: kit("ethereal-portal"),
  Xs: kit("ui-share"),
  Bl: kit("ui-bell"),
  Wt: kit("ui-backpack"),
  Xo: kit("exit"),
  Pc: kit("scroll"),
  Dk: kit("ui-book"),
  Ar: kit("ui-arrow-right"),
  In: kit("ui-download"),
  Up: kit("ui-refresh"),
  // The Blitz rating's six tiers, highest first (the game's own: Storm Lord, Warlord, Conqueror, Marauder, Raider,
  // Scrapper).
  R1: kit("mmr-storm-lord"),
  R2: kit("mmr-warlord"),
  R3: kit("mmr-conqueror"),
  R4: kit("mmr-marauder"),
  R5: kit("mmr-raider"),
  R6: kit("mmr-scrapper"),
  // Music outside a match: on, and off.
  Mu: kit("ui-music"),
  Mt: kit("ui-mute"),
} as const;

export type IconCode = keyof typeof ICONS;

/** Codes drawn turned: the chevron that says a row opens points right. */
const TURNS: Partial<Record<IconCode, number>> = { Cv: -90 };

/**
 * An icon by its code, in a square of its size whatever its art's shape (the page's img rule would otherwise let a
 * tall sigil grow past its row); decorative, since the control around it carries the word.
 */
export const KitIcon = ({ code, size = 20, className }: { code: IconCode; size?: number; className?: string }) => (
  <img
    src={ICONS[code]}
    alt=""
    aria-hidden
    width={size}
    height={size}
    draggable={false}
    className={cn("inline-block aspect-square shrink-0 object-contain", className)}
    style={TURNS[code] ? { rotate: `${TURNS[code]}deg` } : undefined}
  />
);
