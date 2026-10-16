import { ETERNUM_CONFIG } from "@/utils/config";
import { ResourcesIds } from "@bibliothecadao/types";
import ResourceIcon from "../ResourceIcon";
import { colors, section, table } from "../styles";
import { blitzMaterials, byTroopTier, nameOf, TROOPS } from "./blitz-resources";

const styles = {
  resourcesGroup: { display: "flex", flexWrap: "wrap" as const, gap: "0.5rem", alignItems: "center" },
  resourceItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.3rem",
    padding: "0.25rem 0.5rem",
    backgroundColor: colors.background.dark,
    borderRadius: "0.35rem",
    fontSize: "0.75rem",
    whiteSpace: "nowrap" as const,
    minWidth: "fit-content",
    border: `1px solid ${colors.border}`,
  },
  weight: { marginLeft: "auto", color: colors.text.muted, fontSize: "0.7rem", fontWeight: 500 },
  categoryHeader: {
    ...table.cell,
    color: colors.text.light,
    fontWeight: 500,
    padding: "0.75rem 0.5rem",
    whiteSpace: "nowrap" as const,
  },
};

/** What each Blitz material weighs on a donkey, from the Blitz config (grams there, kilograms here). */
export const BlitzWeightTable = () => {
  const gramsOf: Record<number, number> = ETERNUM_CONFIG("blitz").resources.resourceWeightsGrams;
  const categories = [
    { name: "Resources", ids: blitzMaterials() },
    { name: "Food", ids: [ResourcesIds.Wheat] },
    { name: "Transport", ids: [ResourcesIds.Donkey] },
    { name: "Military Units", ids: [...TROOPS].toSorted(byTroopTier) },
    { name: "Special", ids: [ResourcesIds.Essence] },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>Material Weights</div>
      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Category</th>
              <th style={table.headerCell}>Resources</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.name}>
                <td style={styles.categoryHeader}>{category.name}</td>
                <td style={table.cell}>
                  <div style={styles.resourcesGroup}>
                    {category.ids.map((id) => (
                      <div key={id} style={styles.resourceItem}>
                        <ResourceIcon id={id} name={nameOf(id)} size="md" />
                        <span style={{ color: colors.text.light }}>{nameOf(id)}</span>
                        <span style={styles.weight}>{(gramsOf[id] / 1000).toFixed(1)} kg</span>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
