import { colors, section } from "../styles";

const varStyle = {
  color: colors.primary,
  fontStyle: "italic" as const,
  fontFamily: "'Source Code Pro', serif",
};

const Sub = ({ children }: { children: React.ReactNode }) => (
  <sub style={{ fontSize: "0.7em", verticalAlign: "sub" }}>{children}</sub>
);

const equationBoxStyle = {
  padding: "1.5rem 1rem",
  backgroundColor: colors.background.light,
  borderRadius: "0.5rem",
  marginBottom: "1.5rem",
  border: `1px solid ${colors.border}`,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const equationTextStyle = {
  fontSize: "1.35rem",
  color: colors.primary,
  fontFamily: "'Source Code Pro', serif",
  fontWeight: 500,
  letterSpacing: "0.02em",
};

export const HyperstructureRings = () => {
  return (
    <div style={section.commonCard}>
      <div style={section.accentedTitle}>Hyperstructure Ring Calculation</div>

      <p>The number of Hyperstructure rings is determined by:</p>

      <div style={equationBoxStyle}>
        <span style={equationTextStyle}>
          <span style={varStyle}>r</span>
          {" = ("}
          <span style={varStyle}>P</span>
          {" / 6)"}
          <sup style={{ fontSize: "0.65em", verticalAlign: "super" }}>{"1/2"}</sup>
        </span>
      </div>

      <p style={{ fontWeight: 600, color: colors.text.light, marginBottom: "0.75rem" }}>Where:</p>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          marginBottom: "1.5rem",
          fontSize: "0.95rem",
          lineHeight: 2,
        }}
      >
        <li>
          <code style={{ color: colors.primary }}>r</code> — Number of Hyperstructure rings
        </li>
        <li>
          <code style={{ color: colors.primary }}>P</code> — Number of players (Lords) registered to play in the session
        </li>
      </ul>

      <div style={section.legend}>
        <p>
          <em>
            Note: If <strong>r</strong> is not an integer, then it is rounded up to the nearest integer.
          </em>
        </p>
      </div>

      <p style={{ marginTop: "1.5rem" }}>The number of Hyperstructures in a ring is determined by:</p>

      <div style={equationBoxStyle}>
        <span style={equationTextStyle}>
          <span style={varStyle}>H</span>
          {" = 6 · "}
          <span style={varStyle}>r</span>
        </span>
      </div>

      <p style={{ fontWeight: 600, color: colors.text.light, marginBottom: "0.75rem" }}>Where:</p>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          marginBottom: "1.5rem",
          fontSize: "0.95rem",
          lineHeight: 2,
        }}
      >
        <li>
          <code style={{ color: colors.primary }}>H</code> — Number of Hyperstructures in ring <strong>r</strong>
        </li>
        <li>
          <code style={{ color: colors.primary }}>r</code> — Ring number (1, 2, 3, etc.)
        </li>
      </ul>
    </div>
  );
};
