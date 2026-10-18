import {
  formatAmount,
  formatCharge,
  formatExact,
  formatOrdinal,
  formatPercent,
  formatPoints,
  formatRate,
} from "@/ui/design-system/kit/amount";
import { siteName } from "@/three/map-plates/site-name";
import {
  formatAgo,
  formatClockTime,
  formatCountdown,
  formatDuration,
  formatMoment,
  formatWait,
} from "@/ui/design-system/kit/time";
import { VOICE_RULES } from "@/ui/design-system/kit/voice";
import {
  AGES,
  ageLine,
  guardSlotName,
  inTime,
  makesAnHour,
  rankName,
  resourceName,
  structureName,
  TROOP_NAMES,
} from "@/ui/design-system/kit/words";
import {
  formatProductionPerHour,
  formatTimeRemaining,
} from "@/ui/features/economy/resources/entity-resource-table/utils";
import { formatGameClockDuration } from "@/ui/features/world/containers/top-header/game-clock-policy";
import { getRelativeTimeString } from "@/ui/utils/time-utils";
import { currencyFormat, currencyIntlFormat, formatArrivalTime, formatNumber } from "@/ui/utils/utils";
import { formatTime } from "@bibliothecadao/eternum";
import {
  GUARD_SLOT_ORDER,
  GuardSlot,
  RealmLevels,
  RESOURCE_PRECISION,
  resources,
  ResourcesIds,
  StructureType,
} from "@bibliothecadao/types";
import type { ReactNode } from "react";

/**
 * The words sheet (`/lab/kit/words`): each rule of the words module (kit/words, amount, time, voice, site-name) beside
 * what today's code writes for the same input, every difference marked. The rules are the module's own functions, and
 * today's strings are today's functions, called live.
 */
export const WordsLab = () => (
  <div className="h-full overflow-auto bg-[#14110e] px-8 py-6 text-[14px] leading-5 text-[#eee3cc]">
    <h1 className="text-[20px] font-bold">Words</h1>
    <p className="mt-1 max-w-[70ch] text-[#b9ab8e]">
      One way to write every word, number, time and name a player reads. Left, the rule; right, what today&apos;s code
      writes for the same input. <Differs>Amber</Differs> marks where today differs from the rule.
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
    <div className="mt-3">{children}</div>
  </section>
);

const Differs = ({ children }: { children: ReactNode }) => <span className="text-amber-300">{children}</span>;

/** A table: the first columns are the input and the rule, the rest today's ways, each marked where it differs. */
const Compare = ({
  head,
  rows,
  ruleColumns = 1,
}: {
  head: string[];
  rows: { input: string; cells: string[] }[];
  ruleColumns?: number;
}) => (
  <table className="border-collapse font-mono text-[13px]">
    <thead>
      <tr className="text-left text-[#b9ab8e]">
        {head.map((cell, index) => (
          <th
            key={cell}
            className={`border-b border-white/15 px-3 py-1 font-normal ${index === ruleColumns ? "border-r border-r-white/15" : ""}`}
          >
            {cell}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map(({ input, cells }) => (
        <tr key={input} className="border-b border-white/5">
          <td className="px-3 py-1 text-[#b9ab8e]">{input}</td>
          {cells.map((cell, index) => {
            const rule = index < ruleColumns;
            const differs = !rule && !cells.slice(0, ruleColumns).includes(cell);
            return (
              <td
                key={`${index}`}
                className={`px-3 py-1 ${rule ? "font-semibold" : ""} ${index === ruleColumns - 1 ? "border-r border-white/15" : ""}`}
              >
                {differs ? <Differs>{shown(cell)}</Differs> : shown(cell)}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  </table>
);

/** A string as it is: its spaces at the ends shown, an empty one named. */
const shown = (text: string) => (text === "" ? "(empty)" : text.replace(/^ | $/g, "␣"));

const Voice = () => (
  <Section
    title="Voice"
    note="How every string is worded. The words inventory finds each rule's word wherever a player reads it."
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

const AMOUNTS = [undefined, 0, 0.05, 7, 1_498, 9_999, 12_400, 1_234_567];
const RATES = [12.4, 2.5, 0.5, 0.01, -0.25];

const Numbers = () => (
  <Section
    title="Numbers"
    note="Written for en-US whatever the device's language. Exact to 9,999, then compact (12.4K, 1.2M). Unknown is a dash. Today's toLocaleString() follows the device: a German one writes 1.498."
  >
    <Compare
      head={[
        "Amount",
        "formatAmount",
        "formatExact",
        "formatCharge",
        "currencyFormat(·, 2)",
        "currencyIntlFormat",
        "formatNumber(·, 2)",
        "toLocaleString()",
      ]}
      ruleColumns={3}
      rows={AMOUNTS.map((value) => ({
        input: String(value),
        cells: [
          formatAmount(value),
          formatExact(value),
          formatCharge(value),
          currencyFormat(value === undefined ? undefined : value * RESOURCE_PRECISION, 2),
          currencyIntlFormat(value ?? 0),
          formatNumber(value ?? 0, 2),
          (value ?? 0).toLocaleString(),
        ],
      }))}
    />
    <div className="mt-4 flex flex-wrap gap-8">
      <Compare
        head={["A second", "formatRate", "formatProductionPerHour", "makesAnHour (Frontier)"]}
        rows={RATES.map((perSecond) => ({
          input: String(perSecond),
          cells: [
            formatRate(perSecond),
            formatProductionPerHour(perSecond),
            makesAnHour(formatAmount(perSecond * 3600), "wheat"),
          ],
        }))}
      />
      <Compare
        head={["Fraction", "formatPercent", "signed", "today: (x × 100).toFixed(0)%"]}
        ruleColumns={2}
        rows={[0.45, 0.025, 0.1, -0.05].map((fraction) => ({
          input: String(fraction),
          cells: [
            formatPercent(fraction),
            formatPercent(fraction, { signed: true }),
            `${(fraction * 100).toFixed(0)}%`,
          ],
        }))}
      />
      <Compare
        head={["Place / points", "formatOrdinal", "formatPoints", "today: Rank #"]}
        ruleColumns={2}
        rows={[1, 2, 3, 11, 22].map((place) => ({
          input: String(place),
          cells: [formatOrdinal(place), formatPoints(place === 1 ? 1 : place * 1_250), `Rank #${place}`],
        }))}
      />
    </div>
  </Section>
);

const DURATIONS = [0.2, 24, 75, 754, 3_599, 3_600, 5_040, 26_040, 30 * 3_600];
const NOW = Math.floor(Date.now() / 1000);
const AGES_AGO = [3, 24, 300, 3 * 3_600, 2 * 86_400];

const Times = () => (
  <Section
    title="Times"
    note="A wait reads to the second under ten minutes (formatWait), a countdown as a clock (formatCountdown), a duration in hours and minutes and never days (a Frontier day runs 8 to 24 hours); a moment is the device's local 24-hour clock. Time still left never reads 0."
  >
    <Compare
      head={[
        "Seconds",
        "formatWait",
        "formatCountdown",
        "formatDuration",
        "in …",
        "formatTime (core)",
        "formatTimeRemaining",
        "formatGameClockDuration",
      ]}
      ruleColumns={4}
      rows={DURATIONS.map((seconds) => ({
        input: String(seconds),
        cells: [
          formatWait(seconds),
          formatCountdown(seconds),
          formatDuration(seconds),
          inTime(formatWait(seconds)),
          formatTime(seconds),
          formatTimeRemaining(seconds),
          formatGameClockDuration(seconds),
        ],
      }))}
    />
    <div className="mt-4 flex flex-wrap gap-8">
      <Compare
        head={["Seconds ago", "formatAgo", "getRelativeTimeString"]}
        rows={AGES_AGO.map((ago) => ({
          input: String(ago),
          cells: [formatAgo(NOW - ago, NOW), getRelativeTimeString(new Date((NOW - ago) * 1000))],
        }))}
      />
      <Compare
        head={["Moment", "formatClockTime", "formatMoment", "formatArrivalTime", "toLocaleTimeString()"]}
        ruleColumns={2}
        rows={[NOW + 600, NOW + 2 * 86_400].map((at) => ({
          input: at === NOW + 600 ? "in 10 min" : "in 2 days",
          cells: [
            formatClockTime(at),
            formatMoment(at, NOW),
            formatArrivalTime(new Date(at * 1000)),
            new Date(at * 1000).toLocaleTimeString(),
          ],
        }))}
      />
    </div>
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
  <Section
    title="Nouns"
    note="Read from the game's own tables through one function each. Today a screen names a resource three ways: its table's trait, its enum key, or a fallback of its own."
  >
    <div className="flex flex-wrap gap-8">
      <Compare
        head={["Resource", "resourceName", ".trait", "ResourcesIds[id]"]}
        rows={SHOWN_RESOURCES.map((id) => ({
          input: String(id),
          cells: [resourceName(id), resources.find((resource) => resource.id === id)?.trait ?? "", ResourcesIds[id]],
        }))}
      />
      <Compare
        head={["Structure", "structureName", "StructureType[type]"]}
        rows={[
          [StructureType.Realm],
          [StructureType.Camp],
          [StructureType.Mine, 1],
          [StructureType.Mine, 2],
          [StructureType.Hyperstructure],
          [StructureType.Rift],
          [StructureType.Stragglers],
        ].map(([type, kind]) => ({
          input: `${type}${kind ? ` · kind ${kind}` : ""}`,
          cells: [structureName(type, kind), StructureType[type]],
        }))}
      />
      <Compare
        head={["Level / slot", "rankName / guardSlotName", "not: Level n / slot key"]}
        rows={[
          ...[RealmLevels.Settlement, RealmLevels.City, RealmLevels.Kingdom, RealmLevels.Empire].map((level) => ({
            input: `level ${level}`,
            cells: [rankName(level), `Level ${level + 1}`],
          })),
          ...GUARD_SLOT_ORDER.map((slot) => ({ input: `slot ${slot}`, cells: [guardSlotName(slot), GuardSlot[slot]] })),
        ]}
      />
      <div>
        <p className="text-[#b9ab8e]">Troops</p>
        <p className="mt-1 font-semibold">{TROOP_NAMES.join(" · ")}, each T1 to T3: Knight T2</p>
        <p className="mt-4 text-[#b9ab8e]">The three ages</p>
        {(Object.keys(AGES) as (keyof typeof AGES)[]).map((game) => (
          <p key={game} className="mt-1 font-semibold">
            {ageLine(game)}
          </p>
        ))}
      </div>
    </div>
  </Section>
);

const PLACE_IDS = [129, 130, 131, 132, 4_097, 4_098, 7 * 2 ** 32 + 103, 7 * 2 ** 32 + 104, 9 * 2 ** 32 + 11, 12_345];

const Names = () => (
  <Section
    title="Names"
    note="A nameless camp or rift takes a lore name read off its id (shell's siteName): the same on every client, one short word, never the id. An army without a given name is called Army today."
  >
    <Compare
      head={["Entity id", "siteName", "today"]}
      rows={PLACE_IDS.map((id) => ({ input: String(id), cells: [siteName(id), `Camp`] }))}
    />
  </Section>
);
