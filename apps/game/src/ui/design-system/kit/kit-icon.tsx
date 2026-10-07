import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourcesIds } from "@bibliothecadao/types";

/**
 * The handoff's icon codes (frontier-mobile-ui/handoff.html, Icons) drawn with the art that exists today. A code the
 * art pass redraws changes here and nowhere else.
 */
const ICONS = {
  Es: `/images/resources/${ResourcesIds.Essence}.png`,
  La: `/images/resources/${ResourcesIds.Labor}.png`,
  Wh: `/images/resources/${ResourcesIds.Wheat}.png`,
  Tr: `/images/resources/${ResourcesIds.Knight}.png`,
  Lo: `/images/resources/${ResourcesIds.Lords}.png`,
  St: "/image-icons/ui-lightning.png",
  Hg: "/image-icons/hourglass.png",
  Ey: "/image-icons/ui-eye.png",
  Bt: "/image-icons/ui-footprints.png",
  At: "/image-icons/military.png",
  Sk: "/image-icons/ui-skull.png",
  Ch: "/image-icons/ui-chest.png",
  Cp: "/image-icons/ui-camp.png",
  Rf: "/images/buildings/construction/essence-rift.png",
  Fr: "/images/frontier/sites/fallen-realm.svg",
  Sh: "/images/frontier/sites/shrine.svg",
  Wl: "/images/frontier/sites/well.svg",
  Fl: "/image-icons/ui-flag.png",
  Mp: "/image-icons/world.png",
  Cs: "/image-icons/house.png",
  Rs: "/image-icons/ui-flask.png",
  Ct: "/image-icons/ui-message.png",
  Mn: "/image-icons/ui-menu.png",
  Fm: "/images/buildings/construction/farm.png",
  Wk: "/images/buildings/construction/castleZero.png",
  Bs: "/images/buildings/construction/barracks.png",
  Ht: "/images/buildings/construction/workers_hut.png",
  Hx: "/image-icons/ui-hexagon.png",
  Pp: "/image-icons/ui-person.png",
  Ok: "/image-icons/ui-check.png",
  Lk: "/image-icons/ui-lock.png",
  Tp: "/image-icons/trophy.png",
  Hm: "/image-icons/leave.png",
  // The four Aspect marks wait for the art pass; the attribute glyphs stand in (Homecoming wears Support's).
  Ba: "/images/frontier/attributes/battle.svg",
  Lg: "/images/frontier/attributes/logistics.svg",
  Sc: "/images/frontier/attributes/scouting.svg",
  Su: "/images/frontier/attributes/support.svg",
  // The four training buildings wait for their art; the attribute each trains stands in.
  Wa: "/images/frontier/attributes/battle.svg",
  Sy: "/images/frontier/attributes/logistics.svg",
  Ld: "/images/frontier/attributes/scouting.svg",
  He: "/images/frontier/attributes/support.svg",
  // The six sides wait for their art; the building or the store each lifts stands in.
  Fi: "/images/buildings/construction/farm.png",
  Gr: "/image-icons/ui-layers.png",
  To: "/images/buildings/construction/castleZero.png",
  So: "/image-icons/ui-layers.png",
  Dr: "/images/buildings/construction/barracks.png",
  Ra: "/image-icons/ui-backpack.png",
  // The seal (a choice final for the season) waits for its art.
  Fx: "/image-icons/ui-star.png",
  // Army slots and a store's limit wait for their new icons; these stand in.
  Sl: "/image-icons/ui-people.png",
  Sg: "/image-icons/ui-gauge.png",
  // The kit's clock and the guide's mark wait for the art pass; these stand in.
  Cl: "/image-icons/ui-calendar.png",
  Gd: "/image-icons/question.png",
  Of: "/image-icons/ui-network-off.png",
  Cv: "/image-icons/ui-chevron-down.png",
  Sp: "/image-icons/ui-refresh.png",
  // The app's own codes (app handoff, Icons): play, and watch (a spyglass, never the explore eye).
  Pl: "/image-icons/ui-play.png",
  Wc: "/image-icons/ui-telescope.png",
  Dc: "/image-icons/discord.png",
  Em: "/image-icons/ui-mail.png",
  Ed: "/image-icons/ui-edit.png",
  Pf: "/image-icons/ui-person.png",
  Dv: "/image-icons/ui-monitor.png",
  Dp: "/image-icons/portal.png",
  Xs: "/image-icons/ui-share.png",
  Bl: "/image-icons/ui-bell.png",
  Wt: "/image-icons/ui-backpack.png",
  Xo: "/image-icons/leave.png",
  Pc: "/image-icons/latest-updates.png",
  Dk: "/image-icons/ui-book.png",
  Ar: "/image-icons/ui-arrow-right.png",
  In: "/image-icons/ui-download.png",
  Up: "/image-icons/ui-refresh.png",
} as const;

export type IconCode = keyof typeof ICONS;

/** Codes drawn turned: the chevron that says a row opens points right. */
const TURNS: Partial<Record<IconCode, number>> = { Cv: -90 };

/** An icon by its code; decorative, since the control around it carries the word. */
export const KitIcon = ({ code, size = 20, className }: { code: IconCode; size?: number; className?: string }) => (
  <img
    src={ICONS[code]}
    alt=""
    aria-hidden
    width={size}
    height={size}
    draggable={false}
    className={cn("inline-block shrink-0 object-contain", className)}
    style={TURNS[code] ? { rotate: `${TURNS[code]}deg` } : undefined}
  />
);
