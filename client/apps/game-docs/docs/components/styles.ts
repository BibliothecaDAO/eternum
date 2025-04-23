// Common styles for documentation components
// These styles are extracted from the various component files to create a centralized styling system

// Colors
export const colors = {
  primary: "#f0b060",
  secondary: "#dfc296",
  border: "#4d3923",
  borderDark: "#6d4923",
  background: {
    light: "rgba(30, 20, 10, 0.3)",
    medium: "rgba(40, 30, 20, 0.5)",
    dark: "rgba(40, 30, 20, 0.7)",
    header: "rgba(60, 40, 20, 0.5)",
  },
  text: {
    light: "#f9fafb",
    muted: "#dfc296",
  },
  modifiers: {
    positive: "#69db7c",
    negative: "#ff6b6b",
  },
  resource: {
    military: "#d4af37", // Darker gold
    food: "#f0b060", // Amber gold
    labor: "#c0c0c0", // Silver gray
    transport: "#a67c00", // Bronze gold
    default: "#dfc296", // Light gold
  },
};

// Table styles
export const table = {
  container: {
    overflowX: "auto" as const,
    borderRadius: "0.75rem",
    backgroundColor: colors.background.medium,
    borderBottom: `1px solid ${colors.border}`,
    borderLeft: `1px solid ${colors.border}`,
    marginBottom: "1.5rem",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  },
  wrapper: {
    overflowX: "auto" as const,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "0.85rem",
  },
  tableHead: {
    backgroundColor: colors.background.dark,
  },
  headerCell: {
    padding: "0.5rem",
    backgroundColor: colors.background.header,
    color: colors.primary,
    fontWeight: "bold",
    textAlign: "left" as const,
    borderBottom: `1px solid ${colors.borderDark}`,
  },
  cell: {
    padding: "0.5rem",
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.background.light,
    verticalAlign: "middle" as const,
  },
  resourceCell: {
    padding: "0.5rem",
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.background.light,
    verticalAlign: "middle" as const,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  weightCell: {
    padding: "0.5rem",
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.background.light,
    verticalAlign: "middle" as const,
    color: colors.secondary,
  },
  compareTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
    marginBottom: "1.5rem",
  },
  tableHeaderCell: {
    textAlign: "left" as const,
    padding: "0.75rem 0.5rem",
    color: colors.primary,
    fontSize: "0.9rem",
    fontWeight: "bold",
  },
  tableFirstColumn: {
    width: "30%",
    paddingLeft: "0",
  },
  tableCell: {
    padding: "0.75rem 0.5rem",
    color: colors.secondary,
    fontSize: "0.95rem",
    borderBottom: `1px solid rgba(109, 73, 35, 0.3)`,
  },
  tableRow: {
    transition: "background-color 0.2s",
  },
  tableTierCell: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    color: colors.text.light,
  },
  tierBadge: {
    display: "inline-block",
    padding: "0.25rem 0.5rem",
    borderRadius: "0.25rem",
    fontSize: "0.8rem",
    fontWeight: "bold",
    backgroundColor: `rgba(240, 176, 96, 0.1)`,
    color: colors.primary,
  },
};

// Section and card styles
export const section = {
  wrapper: {
    marginBottom: "2rem",
  },
  card: {
    border: `1px solid ${colors.border}`,
    padding: "1rem",
    borderRadius: "0.5rem",
    backgroundColor: colors.background.light,
  },
  title: {
    fontWeight: "bold",
    fontSize: "1.25rem",
    marginBottom: "1.5rem",
  },
  subtitle: {
    fontWeight: "bold",
    fontSize: "0.9rem",
    color: colors.primary,
    marginBottom: "0.75rem",
    marginTop: "1.5rem",
  },
  accentedTitle: {
    fontWeight: "bold",
    fontSize: "1.2rem",
    color: colors.primary,
    marginBottom: "1.5rem",
    borderLeft: `3px solid ${colors.primary}`,
    paddingLeft: "0.75rem",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "1.5rem",
  },
  legend: {
    backgroundColor: "rgba(30, 20, 10, 0.4)",
    padding: "1rem 1.5rem",
    borderRadius: "0.5rem",
    marginTop: "1rem",
    fontStyle: "italic" as const,
    fontSize: "0.9rem",
    color: colors.text.light,
    opacity: 0.85,
  },
  divider: {
    margin: "1.25rem 0",
    borderTop: `1px solid rgba(109, 73, 35, 0.5)`,
  },
  commonCard: {
    padding: "1.5rem",
    borderRadius: "0.75rem",
    backgroundColor: colors.background.medium,
    borderBottom: `1px solid ${colors.border}`,
    borderLeft: `1px solid ${colors.border}`,
    marginBottom: "2rem",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  },
  commonHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: "1.5rem",
    fontSize: "1.1rem",
    paddingBottom: "0.75rem",
    borderBottom: `1px solid ${colors.borderDark}`,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: "0.75rem",
    fontSize: "0.9rem",
  },
  sectionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "0.75rem",
    marginBottom: "1rem",
  },
  sectionContent: {
    display: "grid",
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    gap: "1.5rem",
    "@media (min-width: 768px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
  },
  fullWidthHeader: {
    gridColumn: "1 / -1",
    fontWeight: 600,
    color: "#e5c687",
    fontSize: "0.85rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
};

// Icon styles
export const icon = {
  wrapper: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    width: "2rem",
    height: "2rem",
    borderRadius: "50%",
    backgroundColor: "rgba(240, 176, 96, 0.1)",
    marginRight: "0.5rem",
  },
  biome: {
    display: "inline-block",
    width: "1.5rem",
    textAlign: "center" as const,
  },
};

// Modifier styles
export const modifiers = {
  positive: {
    color: colors.modifiers.positive,
    fontWeight: "bold",
  },
  negative: {
    color: colors.modifiers.negative,
    fontWeight: "bold",
  },
  neutral: {
    color: colors.secondary,
    fontWeight: "bold",
  },
};

// Stats styles
export const stats = {
  item: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.25rem",
  },
  label: {
    fontSize: "0.75rem",
    color: colors.text.light,
    opacity: 0.85,
  },
  value: {
    color: colors.secondary,
    fontSize: "0.95rem",
    fontWeight: 500,
  },
};

// Resource item styles
export const resource = {
  noteStyle: {
    fontSize: "0.75rem",
    color: colors.text.light,
    opacity: 0.85,
    marginTop: "0.5rem",
    fontStyle: "italic",
  },
  gridStyle: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  itemStyle: {
    display: "flex",
    alignItems: "center",
    padding: "0.5rem",
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.background.light,
    borderRadius: "0.5rem",
    transition: "all 0.2s",
    position: "relative" as "relative",
    overflow: "hidden",
  },
  hoverStyle: {
    backgroundColor: colors.background.medium,
  },
  nameStyle: {
    fontWeight: 500,
    color: colors.text.light,
    fontSize: "0.85rem",
  },
  amountStyle: {
    fontSize: "1rem",
    fontWeight: "bold",
    color: colors.secondary,
  },
  indicatorStyle: {
    position: "absolute" as "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "3px",
    backgroundColor: colors.primary,
    opacity: 0.7,
  },
  labelStyle: {
    position: "absolute" as "absolute",
    top: "0.25rem",
    right: "0.5rem",
    fontSize: "0.65rem",
    fontWeight: 600,
    color: colors.secondary,
    textTransform: "uppercase" as "uppercase",
    letterSpacing: "0.05em",
  },
  summaryContainerStyle: {
    marginTop: "2rem",
    borderTop: `1px solid ${colors.borderDark}`,
    paddingTop: "1.5rem",
  },
  summaryTitleStyle: {
    fontWeight: "bold",
    fontSize: "0.9rem",
    color: colors.primary,
    marginBottom: "0.75rem",
  },
  summaryGridStyle: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "1rem",
  },
  summaryCategoryStyle: {
    padding: "0.75rem",
    backgroundColor: colors.background.light,
    borderRadius: "0.5rem",
    borderBottom: `1px solid ${colors.border}`,
  },
  categoryTitleStyle: {
    fontSize: "0.85rem",
    fontWeight: 600,
    marginBottom: "0.5rem",
    display: "flex",
    alignItems: "center",
    color: colors.primary,
  },
  totalStyle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: colors.secondary,
  },
};

// Troop styles
export const troop = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(1, minmax(0, 1fr))",
    gap: "1.25rem",
    "@media (min-width: 640px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "@media (min-width: 1024px)": {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
  },
  card: {
    padding: "1.25rem",
    borderRadius: "0.75rem",
    backgroundColor: colors.background.light,
    borderBottom: `1px solid ${colors.border}`,
    borderLeft: `1px solid ${colors.border}`,
    transition: "transform 0.2s, box-shadow 0.2s",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "1.25rem",
    color: colors.secondary,
    fontWeight: 600,
    fontSize: "1.1rem",
    paddingBottom: "0.75rem",
    borderBottom: `1px solid ${colors.borderDark}`,
  },
  limitsCard: {
    padding: "1rem",
    borderRadius: "0.5rem",
    backgroundColor: colors.background.medium,
    borderBottom: `1px solid ${colors.border}`,
    borderLeft: `1px solid ${colors.border}`,
    marginBottom: "1.5rem",
  },
};

// Formatter for numbers
export const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat().format(Math.round(amount * 100) / 100);
};

// Helper function to format numbers with commas (used in StartingResources)
export const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
