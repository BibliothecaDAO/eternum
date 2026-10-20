import { ResourcesIds } from "@bibliothecadao/types";
import ResourceIcon from "../ResourceIcon";
import { colors, section, table } from "../styles";
import { blitzMaterials, blitzRecipes, byTroopTier, nameOf, type Recipe, TROOPS } from "./blitz-resources";

const styles = {
  section: section.wrapper,
  subtitle: section.subtitle,
  tableWrapper: { ...table.container, overflowX: "hidden" as const },
  table: table.table,
  resourceHeader: { ...table.headerCell, width: "22%", whiteSpace: "nowrap" as const },
  inputHeader: { ...table.headerCell, width: "57%", whiteSpace: "nowrap" as const },
  outputHeader: { ...table.headerCell, width: "21%", whiteSpace: "nowrap" as const },
  resourceCell: { ...table.resourceCell, width: "22%", minWidth: "unset", verticalAlign: "middle" as const },
  resourceCellInner: { display: "flex" as const, alignItems: "center" as const, gap: "0.35rem" },
  productionCell: { ...table.cell, color: colors.primary },
  resourceGroup: { display: "flex", flexWrap: "wrap" as const, gap: "0.25rem", alignItems: "center" },
  resourceItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.2rem 0.35rem",
    backgroundColor: colors.background.dark,
    borderRadius: "0.35rem",
    fontSize: "0.75rem",
    whiteSpace: "nowrap" as const,
    minWidth: "fit-content",
    border: `1px solid ${colors.border}`,
  },
};

const Amount = ({ id, amount }: { id: number; amount: number }) => (
  <div style={styles.resourceItem}>
    <ResourceIcon id={id} name={nameOf(id)} size="md" />
    {amount}
  </div>
);

const RecipeTable = ({ title, firstColumn, recipes }: { title: string; firstColumn: string; recipes: Recipe[] }) => (
  <div style={styles.section}>
    <div style={styles.subtitle}>{title}</div>
    <div style={styles.tableWrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.resourceHeader}>{firstColumn}</th>
            <th style={styles.inputHeader}>Input Materials (units/s)</th>
            <th style={styles.outputHeader}>Output (units/s)</th>
          </tr>
        </thead>
        <tbody>
          {recipes.map((recipe) => (
            <tr key={recipe.id}>
              <td style={styles.resourceCell}>
                <div style={styles.resourceCellInner}>
                  <ResourceIcon id={recipe.id} name={nameOf(recipe.id)} size="md" />
                  {nameOf(recipe.id)}
                </div>
              </td>
              <td style={styles.productionCell}>
                <div style={styles.resourceGroup}>
                  {recipe.inputs.map((input) => (
                    <Amount key={input.resource} id={input.resource} amount={input.amount} />
                  ))}
                </div>
              </td>
              <td style={styles.productionCell}>
                <Amount id={recipe.id} amount={recipe.output} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/** The materials, rarest last. */
export const BlitzStandardResourceProduction = () => (
  <RecipeTable
    title="Standard Mode Production"
    firstColumn="Resource"
    recipes={blitzMaterials().map((id) => blitzRecipes().find((recipe) => recipe.id === id)!)}
  />
);

/** The troops, tier by tier: Knight, Crossbowman and Paladin within each. */
export const BlitzStandardTroopProduction = () => (
  <RecipeTable
    title="Standard Troop Production"
    firstColumn="Troop Type"
    recipes={blitzRecipes()
      .filter((recipe) => TROOPS.has(recipe.id))
      .toSorted((a, b) => byTroopTier(a.id, b.id))}
  />
);

export const BlitzDonkeyProduction = () => (
  <RecipeTable
    title="Donkey Production"
    firstColumn="Resource"
    recipes={blitzRecipes().filter((recipe) => recipe.id === ResourcesIds.Donkey)}
  />
);
