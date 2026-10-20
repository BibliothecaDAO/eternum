import {
  AGES,
  ageLine,
  armyName,
  formatAgo,
  formatAmount,
  formatCharge,
  formatCount,
  formatClockTime,
  formatCountdown,
  formatDuration,
  formatExact,
  formatFigure,
  formatGameClock,
  formatMoment,
  formatOrdinal,
  formatPercent,
  formatPoints,
  formatRate,
  formatWait,
  GUARD_SLOT_ORDER,
  guardSlotName,
  RealmLevels,
  rankName,
  readTypedNumber,
  resourceName,
  ResourcesIds,
  siteName,
  StructureType,
  structureName,
  TROOP_NAMES,
  VOICE_RULES,
} from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { inTime } from "@/ui/design-system/kit/words";

/**
 * The words sheet (`/lab/kit/words`): every rule of the words module (@bibliothecadao/types' words; the client's
 * phrases in kit/words.ts) written out on sample inputs by the module's own functions. Every screen and core's story
 * text write through these; `pnpm words:check` fails any that writes on its own.
 */
export const WordsLab = () => (
  <div className="h-full overflow-auto bg-[#14110e] px-8 py-6 text-[14px] leading-5 text-[#eee3cc]">
    <h1 className="text-[20px] font-bold">Words</h1>
    <p className="mt-1 max-w-[70ch] text-[#b9ab8e]">
      One way to write every word, number, time and name a player reads: each rule on sample inputs, as every screen and
      the story text write it.
    </p>
    <Voice />
    <Numbers />
    <Times />
    <Nouns />
    <Names />
  </div>
);

const Section = ({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) => (
  <section className="mt-8">
    <h2 className="text-[16px] font-semibold">{title}</h2>
    {note && <p className="mt-1 max-w-[80ch] text-[#b9ab8e]">{note}</p>}
    <div className="mt-3 flex flex-wrap gap-8">{children}</div>
  </section>
);

/** A rule's table: an input per row, and what each of the rule's functions writes for it. */
const Rule = ({ head, rows }: { head: string[]; rows: { input: string; cells: string[] }[] }) => (
  <table className="border-collapse font-mono text-[13px]">
    <thead>
      <tr className="text-left text-[#b9ab8e]">
        {head.map((cell) => (
          <th key={cell} className="border-b border-white/15 px-3 py-1 font-normal">
            {cell}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map(({ input, cells }) => (
        <tr key={input} className="border-b border-white/5">
          <td className="px-3 py-1 text-[#b9ab8e]">{input}</td>
          {cells.map((cell, index) => (
            <td key={`${index}`} className="px-3 py-1 font-semibold">
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

const Voice = () => (
  <Section
    title="Voice"
    note="How every string is worded. pnpm words:check finds each rule's word wherever a player reads it."
  >
    <table className="border-collapse">
      <thead>
        <tr className="text-left text-[#b9ab8e]">
          {["Rule", "Write", "Not", "But"].map((cell) => (
            <th key={cell} className="border-b border-white/15 px-3 py-1 font-normal">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {VOICE_RULES.map(({ rule, instead, bad, good }) => (
          <tr key={rule} className="border-b border-white/5 align-top">
            <td className="px-3 py-1 font-semibold">{rule}</td>
            <td className="max-w-[40ch] px-3 py-1 text-[#b9ab8e]">{instead}</td>
            <td className="px-3 py-1 text-red-300 line-through">{bad}</td>
            <td className="px-3 py-1 text-emerald-300">{good}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </Section>
);

const AMOUNTS = [undefined, 0, 0.05, 2.5, 7, 28.15, 1_498, 9_999, 12_400, 1_234_567];

const Numbers = () => (
  <Section
    title="Numbers"
    note="Written for en-US whatever the device's language. An amount is exact to 9,999, then compact (12.4K, 1.2M), and under a unit reads <1; a count is whole and exact; a price, a cost or anything a trade moves is a charge, rounded: whole from one, compact past 9,999, two figures under one (0.05), never nothing. An amount field shows what was typed, exact. Unknown is a dash."
  >
    <Rule
      head={["Amount", "formatAmount", "formatExact", "formatCharge"]}
      rows={AMOUNTS.map((value) => ({
        input: String(value),
        cells: [formatAmount(value), formatExact(value), formatCharge(value)],
      }))}
    />
    <Rule
      head={["Value", "formatRate (a second)", "formatFigure"]}
      rows={[12.4, 2.5, 0.5, 0.01, -0.25].map((value) => ({
        input: String(value),
        cells: [formatRate(value), formatFigure(value, { signed: true })],
      }))}
    />
    <Rule
      head={["Fraction", "formatPercent", "signed"]}
      rows={[0.45, 0.025, 0.1, -0.05].map((fraction) => ({
        input: String(fraction),
        cells: [formatPercent(fraction), formatPercent(fraction, { signed: true })],
      }))}
    />
    <Rule
      head={["Typed", "readTypedNumber", "whole"]}
      rows={["1,250.5", "0.25 LORDS", "12,400", "-3", "abc"].map((typed) => ({
        input: typed,
        cells: [String(readTypedNumber(typed)), String(readTypedNumber(typed, { whole: true }))],
      }))}
    />
    <Rule
      head={["Place", "formatOrdinal", "formatPoints"]}
      rows={[1, 2, 3, 11, 22].map((place) => ({
        input: String(place),
        cells: [formatOrdinal(place), formatPoints(place === 1 ? 1 : place * 1_250)],
      }))}
    />
    <Rule
      head={["Count", "formatCount slot", "army, armies", "with its verb"]}
      rows={[0, 1, 3, 12_500].map((count) => ({
        input: String(count),
        cells: [
          formatCount(count, "field army slot"),
          formatCount(count, "army", "armies"),
          `Your ${formatCount(count, "slot is", "slots are")} in use`,
        ],
      }))}
    />
  </Section>
);

const DURATIONS = [0.2, 24, 75, 754, 3_599, 3_600, 5_040, 26_040, 30 * 3_600, 3 * 86_400 + 4 * 3_600];
const NOW = Math.floor(Date.now() / 1000);

const Times = () => (
  <Section
    title="Times"
    note="A wait reads to the second under ten minutes, a countdown as a clock, a duration in days, hours and minutes (Frontier's in hours: its days run 8 to 24 hours); a moment is the device's local 24-hour clock. Time still left never reads 0."
  >
    <Rule
      head={["Seconds", "formatWait", "formatCountdown", "formatGameClock", "formatDuration", "Frontier", "in …"]}
      rows={DURATIONS.map((seconds) => ({
        input: String(seconds),
        cells: [
          formatWait(seconds),
          formatCountdown(seconds),
          formatGameClock(seconds),
          formatDuration(seconds),
          formatDuration(seconds, { days: false }),
          inTime(formatWait(seconds)),
        ],
      }))}
    />
    <Rule
      head={["Seconds ago", "formatAgo"]}
      rows={[3, 24, 300, 3 * 3_600, 2 * 86_400].map((ago) => ({
        input: String(ago),
        cells: [formatAgo(NOW - ago, NOW)],
      }))}
    />
    <Rule
      head={["Moment", "formatClockTime", "formatMoment"]}
      rows={[NOW + 600, NOW + 2 * 86_400].map((at) => ({
        input: at === NOW + 600 ? "in 10 min" : "in 2 days",
        cells: [formatClockTime(at), formatMoment(at, NOW)],
      }))}
    />
  </Section>
);

const SHOWN_RESOURCES = [
  ResourcesIds.Wheat,
  ResourcesIds.Labor,
  ResourcesIds.AncientFragment,
  ResourcesIds.Lords,
  ResourcesIds.Essence,
  ResourcesIds.Knight,
  ResourcesIds.CrossbowmanT2,
  ResourcesIds.PaladinT3,
  ResourcesIds.ColdIron,
  ResourcesIds.StaminaRelic1,
];

const Nouns = () => (
  <Section title="Nouns" note="Read from the game's own tables through one function each.">
    <Rule
      head={["Resource", "resourceName"]}
      rows={SHOWN_RESOURCES.map((id) => ({ input: String(id), cells: [resourceName(id)] }))}
    />
    <Rule
      head={["Structure", "structureName"]}
      rows={[
        [StructureType.Realm],
        [StructureType.Camp],
        [StructureType.Mine, 1],
        [StructureType.Mine, 2],
        [StructureType.Hyperstructure],
        [StructureType.Rift],
        [StructureType.Beasts],
      ].map(([type, kind]) => ({
        input: `${type}${kind ? ` · kind ${kind}` : ""}`,
        cells: [structureName(type, kind)],
      }))}
    />
    <Rule
      head={["Level / slot", "rankName / guardSlotName"]}
      rows={[
        ...[RealmLevels.Settlement, RealmLevels.City, RealmLevels.Kingdom, RealmLevels.Empire].map((level) => ({
          input: `level ${level}`,
          cells: [rankName(level)],
        })),
        ...GUARD_SLOT_ORDER.map((slot) => ({ input: `slot ${slot}`, cells: [guardSlotName(slot)] })),
      ]}
    />
    <div>
      <p className="text-[#b9ab8e]">Troops</p>
      <p className="mt-1 font-semibold">{TROOP_NAMES.join(" · ")}, each T1 to T3: Knight T1</p>
      <p className="mt-4 text-[#b9ab8e]">The three ages</p>
      {(Object.keys(AGES) as (keyof typeof AGES)[]).map((game) => (
        <p key={game} className="mt-1 font-semibold">
          {ageLine(game)}
        </p>
      ))}
    </div>
  </Section>
);

const IDS = [129, 130, 131, 132, 4_097, 4_098, 7 * 2 ** 32 + 103, 7 * 2 ** 32 + 104, 9 * 2 ** 32 + 11, 12_345];

const Names = () => (
  <Section
    title="Names"
    note="Read off an entity's id, the same on every client, never the id itself: a nameless camp or rift is a place, one word; an army without a given name is a band, two words, never a place."
  >
    <Rule
      head={["Entity id", "siteName", "armyName"]}
      rows={IDS.map((id) => ({ input: String(id), cells: [siteName(id), armyName(id)] }))}
    />
  </Section>
);
