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
          <span style={{ verticalAlign: "middle", marginRight: "0.2em" }}>D =</span>
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
              3.5N
              <span
                style={{
                  display: "inline-block",
                  marginLeft: "0.1em",
                  verticalAlign: "middle",
                  fontSize: "0.95em",
                }}
              >
                (
                <span
                  style={{
                    display: "inline-block",
                    textAlign: "center",
                    verticalAlign: "middle",
                    margin: "0 0.05em",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      borderBottom: `1px solid ${colors.primary}`,
                      paddingBottom: "0.1em",
                      fontSize: "0.95em",
                    }}
                  >
                    T<sub style={{ fontSize: "0.7em" }}>x</sub>
                  </span>
                  <span
                    style={{
                      display: "block",
                      paddingTop: "0.1em",
                      fontSize: "0.95em",
                    }}
                  >
                    T<sub style={{ fontSize: "0.7em" }}>y</sub>
                  </span>
                </span>
                )
              </span>
            </span>
            <span
              style={{
                display: "block",
                fontSize: "0.95em",
                paddingTop: "0.1em",
              }}
            >
              C
              <sup style={{ fontSize: "0.7em", position: "relative", top: "-0.5em" }}>
                β<sub style={{ fontSize: "0.8em" }}>eff</sub>
              </sup>
            </span>
          </span>
          <span style={{ verticalAlign: "middle", fontSize: "0.95em" }}>
            · B<sub style={{ fontSize: "0.7em" }}>s</sub> · B<sub style={{ fontSize: "0.7em" }}>b</sub>
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
        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>D</div>
        <div>= Damage inflicted (troop casualties caused to enemy army)</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>N</div>
        <div>= Number of troops in the attacking army</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>
          T<sub style={{ fontSize: "0.6em" }}>x</sub>
        </div>
        <div>= Tier strength value of attacking army (T1 = 1, T2 = 2.5, T3 = 7)</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>
          T<sub style={{ fontSize: "0.6em" }}>y</sub>
        </div>
        <div>= Tier strength value of defending army</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>C</div>
        <div>= Combined total troops involved in combat (attacker + defender)</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>
          β<sub style={{ fontSize: "0.6em" }}>eff</sub>
        </div>
        <div>
          = Damage scaling coefficient<sup>*</sup>
        </div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>
          B<sub style={{ fontSize: "0.6em" }}>s</sub>
        </div>
        <div>= Stamina bonus multiplier</div>

        <div style={{ color: colors.primary, fontWeight: "bold", fontSize: "1.5rem" }}>
          B<sub style={{ fontSize: "0.6em" }}>b</sub>
        </div>
        <div>= Biome bonus multiplier</div>
      </div>

      <div style={section.legend}>
        <p>
          <sup>*</sup> The damage scaling coefficient is designed to reduce damage in larger conflicts so that larger
          battles require more combat rounds to resolve.
        </p>
      </div>
    </div>
  );
};
