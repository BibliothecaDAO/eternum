import {
  RELIC_COST_PER_LEVEL,
  RELIC_PACKS,
  RELICS,
  RelicRecipientType,
  relicName,
  LUCKY_CHEST_PERCENT,
} from "@bibliothecadao/types";
import { colors, section, table } from "../styles";

// Every row reads the game's own relic table: its name, level, effect and recipient, and the Essence an activation costs.
const RELIC_DATA = RELICS.map((relic) => ({
  relic: relic.name.replace(/ (I|II)$/, ""),
  level: relic.level,
  effect: relic.effect,
  activatedBy: relic.recipientType === RelicRecipientType.Explorer ? "Army" : "Realm",
  essenceCost: RELIC_COST_PER_LEVEL[relic.level],
}));

// Component styles
const componentStyles = {
  levelBadge: {
    display: "inline-block",
    padding: "0.25rem 0.5rem",
    borderRadius: "0.25rem",
    fontSize: "0.8rem",
    fontWeight: "bold",
    backgroundColor: "rgba(240, 176, 96, 0.1)",
    color: colors.primary,
    minWidth: "2rem",
    textAlign: "center" as const,
  },
  relicNameCell: {
    ...table.cell,
    fontWeight: 500,
    color: colors.text.light,
  },
  effectCell: {
    ...table.cell,
    maxWidth: "300px",
    lineHeight: "1.4",
  },
  activatedByCell: {
    ...table.cell,
    textAlign: "center" as const,
    fontWeight: 500,
  },
  essenceCell: {
    ...table.cell,
    textAlign: "center" as const,
    color: colors.text.light,
  },
};

const RelicTable = () => {
  return (
    <div style={section.wrapper}>
      <div style={section.subtitle}>Relic Types and Effects</div>
      <div style={table.wrapper}>
        <table style={table.table}>
          <thead>
            <tr>
              <th style={table.headerCell}>Relic</th>
              <th style={table.headerCell}>Level</th>
              <th style={table.headerCell}>Effect</th>
              <th style={table.headerCell}>Activated By</th>
              <th style={table.headerCell}>Essence Cost</th>
            </tr>
          </thead>
          <tbody>
            {RELIC_DATA.map((relic, index) => (
              <tr key={`${relic.relic}-${relic.level}-${index}`}>
                <td style={componentStyles.relicNameCell}>{relic.relic}</td>
                <td style={table.cell}>
                  <span style={componentStyles.levelBadge}>{relic.level}</span>
                </td>
                <td style={componentStyles.effectCell}>{relic.effect}</td>
                <td style={componentStyles.activatedByCell}>{relic.activatedBy}</td>
                <td style={componentStyles.essenceCell}>{relic.essenceCost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** The four packs a Relic Crate can hold, with their chances, from the game's own pack table. */
export const RelicPackTable = () => (
  <div style={section.wrapper}>
    <div style={section.subtitle}>Relic Crate Packs</div>
    <div style={table.wrapper}>
      <table style={table.table}>
        <thead>
          <tr>
            <th style={table.headerCell}>Pack</th>
            <th style={table.headerCell}>Relics</th>
            <th style={table.headerCell}>Chance</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(RELIC_PACKS).map(([pack, { oddsPercent, relics }]) => (
            <tr key={pack}>
              <td style={componentStyles.relicNameCell}>{pack}</td>
              <td style={componentStyles.effectCell}>
                {relics.map((id) => relicName(id).replace(/ I$/, "")).join(", ")}
              </td>
              <td style={table.cell}>{oddsPercent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p>One crate in five is lucky: its whole pack is level 2.</p>
  </div>
);

export default RelicTable;
