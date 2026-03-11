import { colors, section } from "./styles";

const varStyle = {
  color: colors.primary,
  fontStyle: "italic" as const,
  fontFamily: "'Source Code Pro', serif",
};

const Fraction = ({ top, bottom }: { top: React.ReactNode; bottom: React.ReactNode }) => (
  <span
    style={{
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "center",
      verticalAlign: "middle",
      margin: "0 0.15em",
      lineHeight: 1.2,
    }}
  >
    <span style={{ borderBottom: `1.5px solid ${colors.primary}`, padding: "0 0.2em 0.1em" }}>{top}</span>
    <span style={{ padding: "0.1em 0.2em 0" }}>{bottom}</span>
  </span>
);

const Sub = ({ children }: { children: React.ReactNode }) => (
  <sub style={{ fontSize: "0.7em", verticalAlign: "sub" }}>{children}</sub>
);

const Sup = ({ children }: { children: React.ReactNode }) => (
  <sup style={{ fontSize: "0.7em", verticalAlign: "super" }}>{children}</sup>
);

export const DamageCalculation = () => {
  return (
    <div style={section.commonCard}>
      <div style={section.accentedTitle}>Combat Damage Calculation</div>

      <p>The damage dealt by an army during combat is calculated as follows:</p>

      <div
        style={{
          padding: "1.5rem 1rem",
          backgroundColor: colors.background.light,
          borderRadius: "0.5rem",
          marginBottom: "1.5rem",
          border: `1px solid ${colors.border}`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "1.35rem",
            color: colors.primary,
            fontFamily: "'Source Code Pro', serif",
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          <span style={varStyle}>D</span>
          <Sub>x</Sub>
          {" = "}
          <span style={varStyle}>K</span>
          {" · "}
          <Fraction
            top={
              <>
                <span style={varStyle}>T</span>
                <Sub>x</Sub>
              </>
            }
            bottom={
              <>
                <span style={varStyle}>T</span>
                <Sub>y</Sub>
              </>
            }
          />
          {" · "}
          <span style={varStyle}>x</span>
          {" · "}
          <span style={varStyle}>C</span>
          <Sup>
            −<span style={varStyle}>z</span>
          </Sup>
          {" · "}
          <span style={varStyle}>B</span>
          {" · "}
          <span style={varStyle}>S</span>
          {" · "}
          <span style={varStyle}>T</span>
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
          <code style={{ color: colors.primary }}>
            D<sub>x</sub>
          </code>{" "}
          — Damage dealt by army <em>x</em>
        </li>
        <li>
          <code style={{ color: colors.primary }}>K</code> — Global damage modifier = 2
        </li>
        <li>
          <code style={{ color: colors.primary }}>
            T<sub>x</sub> / T<sub>y</sub>
          </code>{" "}
          — Tier ratio (attacker tier ÷ defender tier)
        </li>
        <li>
          <code style={{ color: colors.primary }}>x</code> — Number of troops in army <em>x</em>
        </li>
        <li>
          <code style={{ color: colors.primary }}>
            C<sup>−z</sup>
          </code>{" "}
          — Scaling factor where C = total troops (x + y), z = 0.2
        </li>
        <li>
          <code style={{ color: colors.primary }}>B</code> — Biome damage modifier
        </li>
        <li>
          <code style={{ color: colors.primary }}>S</code> — Stamina penalty modifier
        </li>
        <li>
          <code style={{ color: colors.primary }}>T</code> — Battle timer penalty modifier
        </li>
      </ul>

      <div style={section.legend}>
        <p>
          The damage scaling coefficient (z = 0.2) reduces damage in larger conflicts so that bigger battles require
          more combat rounds to resolve. The global damage modifier (K = 2) provides a baseline multiplier for all
          combat interactions.
        </p>
      </div>
    </div>
  );
};
