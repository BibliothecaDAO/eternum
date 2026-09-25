import { TreasureChest } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { orders, ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";
import { depthArt, DEPTH_ART } from "../depth-art";
import { formatAmount } from "../frontier-format";
import { FlagGlyph, MedalGlyph } from "../glyphs";
import { SITE_ART } from "../sites/site-art";
import { wholeLords, wholeResource } from "./standings";

type Entry = HeraldFrontierLeaderboardEntry;

const LORDS_ICON = `/images/resources/${ResourcesIds.Lords}.png`;
const ESSENCE_ICON = `/images/resources/${ResourcesIds.Essence}.png`;
const LABOR_ICON = `/images/resources/${ResourcesIds.Labor}.png`;
const ICON = "size-5 shrink-0 object-contain";

/** A realm's Order as its emblem, the avatar that makes a row read as a realm; an Order the game lacks is loud. */
const orderEmblem = (order: number): { art: string; name: string } => {
  const known = orders.find(({ orderId }) => orderId === order);
  if (!known) throw new Error(`No Order ${order}`);
  return { art: `/images/orders/${known.orderName.toLowerCase()}.png`, name: known.fullOrderName };
};

const isMedalPlace = (rank: number): rank is 1 | 2 | 3 => rank >= 1 && rank <= 3;

/**
 * Frontier's season standings as a table, wherever they show: the in-game board and the shell's game standings. Its
 * columns are icons over numbers, in Frontier's palette without its scoped classes, so the shell draws it the same.
 * `useName` resolves a player's name in the caller's identity path; with `onVisit`, another realm's name opens it.
 */
export const SeasonTable = ({
  rows,
  useName,
  onVisit,
}: {
  rows: readonly { entry: Entry; own: boolean }[];
  useName: (address: string) => string | null;
  onVisit?: (entry: Entry) => void;
}) => (
  <>
    <TableHeader />
    <ol className="min-h-0 space-y-1 overflow-y-auto overscroll-contain">
      {rows.map(({ entry, own }) => (
        <TableRow key={entry.address} entry={entry} own={own} useName={useName} onVisit={own ? undefined : onVisit} />
      ))}
    </ol>
  </>
);

// Desktop widens the sites column for the camp / rift / fallen split beside the total.
const COLUMNS =
  "grid grid-cols-[2rem_1fr_3rem_2.5rem_3.5rem_2rem] items-center gap-1.5 lg:grid-cols-[2rem_1fr_6rem_2.5rem_4rem_2rem]";

/** The columns as mockup 8's icons: sites cleared, chests, LORDS won, deepest depth. */
const TableHeader = () => (
  <div className={cn(COLUMNS, "px-2 text-[#a2926f]")} aria-hidden>
    <span className="text-center font-[Lexend] text-[13px] font-extrabold">#</span>
    <span />
    <FlagGlyph className={cn(ICON, "justify-self-end")} />
    <TreasureChest className={cn(ICON, "justify-self-end")} />
    <img src={LORDS_ICON} alt="" className={cn(ICON, "justify-self-end")} />
    <img src={DEPTH_ART[1]} alt="" className={cn(ICON, "justify-self-center opacity-70")} />
  </div>
);

/**
 * One realm: its place (a medal on the podium, warmly tinted), its Order's emblem and name (tap to visit the realm,
 * read-only), sites cleared (tap for the split and what the season paid), chests, LORDS and the deepest depth's
 * portal. The player's own row carries the selected card's gold border wherever it sits.
 */
const TableRow = ({
  entry,
  own,
  useName,
  onVisit,
}: {
  entry: Entry;
  own: boolean;
  useName: (address: string) => string | null;
  onVisit?: (entry: Entry) => void;
}) => {
  const name = useName(entry.address) ?? "—";
  const [open, setOpen] = useState(false);
  const { sites_cleared: sites } = entry;
  const depth = depthArt(entry.deepest_depth);
  const emblem = orderEmblem(entry.order);

  return (
    <li
      className={cn(
        "rounded-xl border-2 px-2 py-1 text-[15px] tabular-nums text-[#eadfc8]",
        isMedalPlace(entry.rank) && "bg-[linear-gradient(90deg,rgba(246,172,29,0.16),rgba(246,172,29,0.03))]",
        // .frontier-card's selected border, spelled out: the shell draws this table outside the Frontier scope.
        own ? "border-[#f6ac1d] shadow-[0_0_18px_rgba(246,172,29,0.45)]" : "border-transparent",
      )}
    >
      <div className={COLUMNS}>
        {isMedalPlace(entry.rank) ? (
          <MedalGlyph place={entry.rank} className="size-8 justify-self-center" />
        ) : (
          <span className="text-center font-[Lexend] font-extrabold text-[#a2926f]">{entry.rank}</span>
        )}
        <span className="flex min-w-0 items-center gap-2">
          <img src={emblem.art} alt={emblem.name} className="size-7 shrink-0 rounded-full object-contain" />
          {onVisit ? (
            <button
              type="button"
              aria-label={`Visit ${name}'s realm`}
              onClick={() => onVisit(entry)}
              className="min-h-11 min-w-0 truncate text-left font-[Lexend] font-extrabold hover:text-[#f6ac1d] lg:min-h-8"
            >
              {name}
            </button>
          ) : (
            <span className="min-w-0 truncate font-[Lexend] font-extrabold">{name}</span>
          )}
        </span>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${sites.total} sites cleared`}
          onClick={() => setOpen(!open)}
          className="min-h-11 text-right font-bold underline decoration-[#46351c] underline-offset-4 lg:min-h-8"
        >
          {sites.total}
          <span className="hidden text-[13px] text-[#a2926f] lg:inline">
            {" "}
            {sites.camps}·{sites.rifts}·{sites.fallen_realms}
          </span>
        </button>
        <span className="text-right" aria-label={`${entry.chests_earned} chests`}>
          {entry.chests_earned}
        </span>
        <span className="text-right font-bold text-[#f6ac1d]" aria-label={`${wholeLords(entry.rewards.lords)} LORDS`}>
          {formatAmount(wholeLords(entry.rewards.lords))}
        </span>
        {depth ? (
          <img src={depth} alt={`Ethereal ${entry.deepest_depth}`} className={cn(ICON, "size-6 justify-self-center")} />
        ) : (
          <span aria-label="Surface" />
        )}
      </div>
      {open && <RowDetail entry={entry} />}
    </li>
  );
};

/** What a realm's season adds up to beyond the columns: its sites by kind, and the Essence and labor it earned. */
const RowDetail = ({ entry }: { entry: Entry }) => {
  const { sites_cleared: sites, rewards } = entry;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pb-1 pl-[2.375rem] text-[13px] text-[#eadfc8]">
      <Count art={SITE_ART.Camp} label="Camps" value={sites.camps} />
      <Count art={SITE_ART.Rift} label="Rifts" value={sites.rifts} />
      <Count art={SITE_ART.FallenRealm} label="Fallen realms" value={sites.fallen_realms} />
      <Count art={ESSENCE_ICON} label="Essence earned" value={wholeResource(rewards.essence)} gain />
      <Count art={LABOR_ICON} label="Labor earned" value={wholeResource(rewards.labor)} gain />
    </div>
  );
};

const Count = ({ art, label, value, gain = false }: { art: string; label: string; value: number; gain?: boolean }) => (
  <span aria-label={`${label} ${value}`} className="flex items-center gap-1 tabular-nums">
    <img src={art} alt="" className="size-6 object-contain" />
    {gain ? `+${formatAmount(value)}` : formatAmount(value)}
  </span>
);
