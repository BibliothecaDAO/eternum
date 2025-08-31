import { colors, section } from "./styles";

export const DamageCalculation = () => {
  return (
    <div style={section.commonCard}>
      <div style={section.commonHeader}>
        <span>Combat Damage Calculation</span>
      </div>

      <p>The damage dealt by an army during combat is calculated as follows:</p>

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
          <span style={{ verticalAlign: "middle", marginRight: "0.2em" }}>D<sub>x</sub> =</span>
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
              (K × N × (T<sub>x</sub> ÷ T<sub>y</sub>))
              <span
                style={{
                  display: "inline-block",
                  marginLeft: "0.1em",
                  verticalAlign: "middle",
                  fontSize: "0.95em",
                }}
              >
                ÷ C<sup>z</sup>
              </span>
            </span>
            <span
              style={{
                display: "block",
                paddingTop: "0.1em",
                fontSize: "0.95em",
              }}
            >
              × B × S × T
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
        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>D<sub>x</sub></div>
        <div>= Damage of army x</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>K</div>
        <div>= Global damage modifier = 2</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>
          T<sub style={{ fontSize: "0.6em" }}>x</sub>
        </div>
        <div>= Tier of army x</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>
          T<sub style={{ fontSize: "0.6em" }}>y</sub>
        </div>
        <div>= Tier of army y</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>C</div>
        <div>= Total number of troops (x + y)</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>z</div>
        <div>= Damage scaling coefficient = 0.2</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>B</div>
        <div>= Biome damage modifier</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>S</div>
        <div>= Stamina penalty modifier</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>T</div>
        <div>= Battle timer penalty modifier</div>
      </div>

      <div style={section.legend}>
        <p>
          The damage scaling coefficient (z = 0.2) is designed to reduce damage in larger conflicts so that larger
          battles require more combat rounds to resolve. The global damage modifier (K = 2) provides a baseline multiplier
          for all combat interactions.
        </p>
      </div>
    </div>
  );
};
