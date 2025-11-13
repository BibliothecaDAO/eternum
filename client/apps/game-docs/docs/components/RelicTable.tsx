import { colors, section, table } from "./styles";

const RELIC_DATA = [
  {
    relic: "Stamina Relic",
    level: 1,
    effect: "Increases stamina regeneration by 50% for 3 Eternum Days.",
    activatedBy: "Army",
    essenceCost: 250,
    discoveryChance: "7.5%",
  },
  {
    relic: "Stamina Relic",
    level: 2,
    effect: "Increases stamina regeneration by 100% for 3 Eternum Days.",
    activatedBy: "Army",
    essenceCost: 500,
    discoveryChance: "4.0%",
  },
  {
    relic: "Damage Relic",
    level: 1,
    effect: "Increases damage by 20% for 3 Eternum Days.",
    activatedBy: "Army",
    essenceCost: 250,
    discoveryChance: "7.5%",
  },
  {
    relic: "Damage Relic",
    level: 2,
    effect: "Increases damage by 40% for 3 Eternum Days.",
    activatedBy: "Army",
    essenceCost: 500,
    discoveryChance: "4.0%",
  },
  {
    relic: "Damage Reduction Relic",
    level: 1,
    effect: "Reduces damage taken by 20% for 3 Eternum Days.",
    activatedBy: "Army",
    essenceCost: 250,
    discoveryChance: "7.5%",
  },
  {
    relic: "Damage Reduction Relic",
    level: 2,
    effect: "Reduces damage taken by 40% for 3 Eternum Days.",
    activatedBy: "Army",
    essenceCost: 500,
    discoveryChance: "4.0%",
  },
  {
    relic: "Exploration Relic",
    level: 1,
    effect: "Instantly explores a one-tile radius.",
    activatedBy: "Army",
    essenceCost: 250,
    discoveryChance: "7.5%",
  },
  {
    relic: "Exploration Relic",
    level: 2,
    effect: "Instantly explores a two-tile radius.",
    activatedBy: "Army",
    essenceCost: 500,
    discoveryChance: "4.0%",
  },
  {
    relic: "Exploration Reward Relic",
    level: 1,
    effect: "Double all exploration rewards for 3 Eternum Days.",
    activatedBy: "Army",
    essenceCost: 250,
    discoveryChance: "7.5%",
  },
  {
    relic: "Exploration Reward Relic",
    level: 2,
    effect: "Triple all exploration rewards for 3 Eternum Days.",
    activatedBy: "Army",
    essenceCost: 500,
    discoveryChance: "4.0%",
  },
  {
    relic: "Structure Damage Reduction Relic",
    level: 1,
    effect: "Reduces damage taken by all guard armies by 15% for 6 Eternum Days.",
    activatedBy: "Realm",
    essenceCost: 250,
    discoveryChance: "7.5%",
  },
  {
    relic: "Structure Damage Reduction Relic",
    level: 2,
    effect: "Reduces damage taken by all guard armies by 30% for 6 Eternum Days.",
    activatedBy: "Realm",
    essenceCost: 500,
    discoveryChance: "4.0%",
  },
  {
    relic: "Production Relic",
    level: 1,
    effect: "Increases resource production rate by 20% for 3 Eternum Days.",
    activatedBy: "Realm",
    essenceCost: 250,
    discoveryChance: "7.5%",
  },
  {
    relic: "Production Relic",
    level: 2,
    effect: "Increases resource production rate by 40% for 3 Eternum Days.",
    activatedBy: "Realm",
    essenceCost: 500,
    discoveryChance: "4.0%",
  },
  {
    relic: "Troop Production Relic",
    level: 1,
    effect: "Increases troop production rate by 20% for 6 Eternum Days.",
    activatedBy: "Realm",
    essenceCost: 250,
    discoveryChance: "6.0%",
  },
  {
    relic: "Troop Production Relic",
    level: 2,
    effect: "Increases troop production rate by 20% for 12 Eternum Days.",
    activatedBy: "Realm",
    essenceCost: 500,
    discoveryChance: "2.0%",
  },
];

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
    color: colors.primary,
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
    color: colors.secondary,
  },
  chanceCell: {
    ...table.cell,
    textAlign: "center" as const,
    color: colors.secondary,
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
              <th style={table.headerCell}>Discovery Chance</th>
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
                <td style={componentStyles.chanceCell}>{relic.discoveryChance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RelicTable;
