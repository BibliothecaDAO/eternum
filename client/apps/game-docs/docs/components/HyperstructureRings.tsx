import { colors, section } from "./styles";

export const HyperstructureRings = () => {
  return (
    <div style={section.commonCard}>
      <div style={section.commonHeader}>
        <span>Hyperstructure Ring Calculation</span>
      </div>

      <p>The number of Hyperstructure rings is determined by:</p>

      <div
        style={{
          padding: "1.5rem",
          backgroundColor: colors.background.light,
          borderRadius: "0.5rem",
          marginBottom: "1.5rem",
          textAlign: "center",
          color: colors.primary,
          fontWeight: "bold",
          lineHeight: 1.8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: "1.5rem" }}>
          <span style={{ verticalAlign: "middle", marginRight: "0.2em" }}>r =</span>
          <span
            style={{
              display: "inline-block",
              textAlign: "center",
              verticalAlign: "middle",
              marginRight: "0.2em",
              position: "relative",
            }}
          >
            <span
              style={{
                display: "block",
                borderBottom: `1px solid ${colors.primary}`,
                paddingLeft: "0.1em",
                paddingRight: "0.1em",
                marginBottom: "0.1em",
              }}
            >
              √(P/6)
            </span>
          </span>
        </div>
      </div>

      <div style={{ ...section.sectionHeader, fontSize: "1.25rem", marginTop: "1.5rem" }}>
        <span>Where:</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "0.75rem 1.5rem",
          marginBottom: "1.5rem",
          padding: "1rem",
          backgroundColor: colors.background.light,
          borderRadius: "0.5rem",
          fontSize: "1.1rem",
        }}
      >
        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>r</div>
        <div>= Number of Hyperstructure rings</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>P</div>
        <div>= Number of players (Lords) registered to play in the session</div>
      </div>

      <div style={section.legend}>
        <p>
          <em>Note: If <strong>r</strong> is not an integer, then it is rounded up to the nearest integer.</em>
        </p>
      </div>

      <p style={{ marginTop: "2rem" }}>The number of Hyperstructures in a ring is determined by:</p>

      <div
        style={{
          padding: "1.5rem",
          backgroundColor: colors.background.light,
          borderRadius: "0.5rem",
          marginBottom: "1.5rem",
          textAlign: "center",
          color: colors.primary,
          fontWeight: "bold",
          lineHeight: 1.8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: "1.5rem" }}>
          <span style={{ verticalAlign: "middle", marginRight: "0.2em" }}>H =</span>
          <span style={{ verticalAlign: "middle", fontSize: "1.5rem" }}>6r</span>
        </div>
      </div>

      <div style={{ ...section.sectionHeader, fontSize: "1.25rem", marginTop: "1.5rem" }}>
        <span>Where:</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "0.75rem 1.5rem",
          marginBottom: "1.5rem",
          padding: "1rem",
          backgroundColor: colors.background.light,
          borderRadius: "0.5rem",
          fontSize: "1.1rem",
        }}
      >
        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>H</div>
        <div>= Number of Hyperstructures in ring <strong>r</strong></div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>r</div>
        <div>= Ring number (1, 2, 3, etc.)</div>
      </div>
    </div>
  );
}; 