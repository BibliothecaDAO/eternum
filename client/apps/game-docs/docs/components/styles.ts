// Common styles for documentation components
// Realms visual theme — dark mode, inspired by the Realms design language

// Fonts
export const fonts = {
  body: "'Exo 2', sans-serif",
  display: "'MedievalSharp', serif",
  heading: "'Cinzel', serif",
  mono: "'Source Code Pro', monospace",
};

// Colors — Realms palette
export const colors = {
  primary: "#c9a960", // brass accent
  secondary: "#c4874a", // ember accent
  border: "rgba(201, 169, 96, 0.18)", // etched border
  borderDark: "rgba(201, 169, 96, 0.28)", // strong border
  arcane: "#8088b8", // cool accent
  background: {
    void: "#050709",
    smoke: "#070b0d",
    light: "rgba(16, 20, 23, 0.54)", // iron tint
    medium: "rgba(7, 10, 12, 0.82)", // iron
    dark: "rgba(22, 27, 32, 0.86)", // slate
    header: "rgba(22, 27, 32, 0.92)", // slate header
  },
  text: {
    light: "#ece0bd",
    muted: "rgba(236, 224, 189, 0.72)",
  },
  modifiers: {
    positive: "#69db7c",
    negative: "#ff6b6b",
  },
  resource: {
    military: "#c9a960",
    food: "#c4874a",
    labor: "#8088b8",
    transport: "#a89060",
    default: "#c9a960",
  },
};

// Table styles
export const table = {
  container: {
    overflowX: "auto" as const,
    borderRadius: "8px",
    backgroundColor: colors.background.medium,
    border: `1px solid ${colors.border}`,
    marginBottom: "1.5rem",
    boxShadow: "inset 0 1px 0 rgba(201, 169, 96, 0.08), 0 18px 36px rgba(0, 0, 0, 0.28)",
    fontFamily: fonts.body,
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
    padding: "0.6rem 0.5rem",
    backgroundColor: colors.background.header,
    color: colors.primary,
    fontWeight: 700,
    textAlign: "left" as const,
    borderBottom: `1px solid ${colors.borderDark}`,
    fontFamily: fonts.body,
    fontSize: "0.85rem",
    letterSpacing: "0",
  },
  cell: {
    padding: "0.5rem",
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.background.light,
    verticalAlign: "middle" as const,
    color: colors.text.light,
  },
  resourceCell: {
    padding: "0.5rem",
    borderBottom: `1px solid ${colors.border}`,
    backgroundColor: colors.background.light,
    verticalAlign: "middle" as const,
    whiteSpace: "nowrap" as const,
    minWidth: "180px",
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
    tableLayout: "fixed" as const,
    marginBottom: "1.5rem",
    backgroundColor: colors.background.medium,
    border: `1px solid ${colors.border}`,
    borderRadius: "8px",
    overflow: "hidden",
  },
  tableHeaderCell: {
    textAlign: "left" as const,
    padding: "0.75rem 0.5rem",
    color: colors.primary,
    fontSize: "0.85rem",
    fontWeight: 700,
    fontFamily: fonts.body,
    letterSpacing: "0",
  },
  tableFirstColumn: {
    width: "30%",
    paddingLeft: "0.75rem",
  },
  /* Context-aware first column options - use as needed without changing existing tables */
  tableFirstColumnNarrow: {
    width: "20%",
    paddingLeft: "0.75rem",
    minWidth: "100px",
  },
  tableFirstColumnMedium: {
    width: "25%",
    paddingLeft: "0.75rem",
    minWidth: "140px",
  },
  tableCell: {
    padding: "0.75rem 0.5rem",
    color: colors.text.light,
    fontSize: "0.95rem",
    borderBottom: `1px solid rgba(201, 169, 96, 0.13)`,
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
    fontSize: "0.75rem",
    fontWeight: "bold",
    backgroundColor: `rgba(201, 169, 96, 0.12)`,
    color: colors.primary,
    fontFamily: fonts.heading,
    letterSpacing: "0",
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
    borderRadius: "8px",
    backgroundColor: colors.background.light,
    fontFamily: fonts.body,
  },
  title: {
    fontWeight: 800,
    fontSize: "1.45rem",
    marginBottom: "1.5rem",
    fontFamily: fonts.display,
    letterSpacing: "0",
    color: colors.text.light,
  },
  subtitle: {
    fontWeight: 500,
    fontSize: "1rem",
    color: colors.text.muted,
    marginBottom: "0.75rem",
    marginTop: "1.5rem",
    fontFamily: fonts.body,
  },
  accentedTitle: {
    fontWeight: 500,
    fontSize: "1rem",
    color: colors.text.muted,
    marginBottom: "1rem",
    fontFamily: fonts.body,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "1.5rem",
  },
  legend: {
    backgroundColor: "rgba(7, 10, 12, 0.72)",
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
    borderTop: `1px solid rgba(201, 169, 96, 0.18)`,
  },
  commonCard: {
    padding: "1.5rem",
    borderRadius: "8px",
    backgroundColor: colors.background.medium,
    border: `1px solid ${colors.border}`,
    marginBottom: "2rem",
    boxShadow: "inset 0 1px 0 rgba(201, 169, 96, 0.08), 0 18px 36px rgba(0, 0, 0, 0.25)",
    fontFamily: fonts.body,
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
    fontFamily: fonts.heading,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: "0.75rem",
    fontSize: "0.9rem",
    fontFamily: fonts.heading,
  },
  sectionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "0.75rem",
    marginBottom: "1rem",
  },
  sectionContent: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "1.5rem",
  },
  fullWidthHeader: {
    gridColumn: "1 / -1",
    fontWeight: 600,
    color: colors.primary,
    fontSize: "0.85rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontFamily: fonts.heading,
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
    backgroundColor: "rgba(201, 169, 96, 0.12)",
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
    fontFamily: fonts.heading,
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
    fontFamily: fonts.heading,
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
    fontFamily: fonts.heading,
  },
  totalStyle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: colors.secondary,
  },
};

// Important note styles
export const importantNote = {
  container: {
    padding: "1.5rem",
    marginBottom: "1.5rem",
    backgroundColor: colors.background.medium,
    borderRadius: "8px",
    borderLeft: `4px solid ${colors.secondary}`,
    border: `1px solid ${colors.border}`,
    boxShadow: "inset 0 1px 0 rgba(201, 169, 96, 0.08), 0 18px 36px rgba(0, 0, 0, 0.25)",
    fontFamily: fonts.body,
  },
  title: {
    fontSize: "1.1rem",
    marginTop: 0,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: "0.75rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontFamily: fonts.heading,
  },
  content: {
    color: colors.text.light,
    marginTop: 0,
    marginBottom: 0,
  },
};

// Troop styles
export const troop = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "1.25rem",
  },
  card: {
    padding: "1.25rem",
    borderRadius: "8px",
    backgroundColor: colors.background.light,
    border: `1px solid ${colors.border}`,
    transition: "transform 0.2s, box-shadow 0.2s",
    fontFamily: fonts.body,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "1.25rem",
    color: colors.primary,
    fontWeight: 600,
    fontSize: "1.1rem",
    paddingBottom: "0.75rem",
    borderBottom: `1px solid ${colors.borderDark}`,
    fontFamily: fonts.heading,
  },
  limitsCard: {
    padding: "1rem",
    borderRadius: "8px",
    backgroundColor: colors.background.medium,
    border: `1px solid ${colors.border}`,
    marginBottom: "1.5rem",
    fontFamily: fonts.body,
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
