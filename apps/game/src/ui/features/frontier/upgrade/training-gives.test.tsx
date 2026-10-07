import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TrainingGives } from "./training-gives";

describe("a training building's next tier", () => {
  it("gives its attribute's effect, the XP it saves every army, and the next army's starting tier", () => {
    const markup = renderToStaticMarkup(
      <TrainingGives mark="Ba" attribute="Battle" effect="+10% → +30%" xpSaved={300} tier={2} armyArt="/army.png" />,
    );
    expect(markup).toContain('aria-label="Battle +10% → +30%"');
    expect(markup).toContain('aria-label="XP 300"');
    expect(markup).toContain('aria-label="Uncommon"');
    expect(markup).toContain('aria-label="Rare"');
  });

  it("chooses the Scouts' lodge's kind instead of showing the next army", () => {
    const markup = renderToStaticMarkup(
      <TrainingGives
        mark="Sc"
        attribute="Scouting"
        effect="+10%"
        xpSaved={100}
        tier={1}
        armyArt="/army.png"
        kinds={<span>kinds</span>}
      />,
    );
    expect(markup).toContain("kinds");
    expect(markup).not.toContain('aria-label="Uncommon"');
  });
});
