import { describe, expect, test } from "bun:test";
import { assertGeneratedConfigArtifactCurrent, renderResolvedConfigJson } from "./environment";

describe("generated config artifacts", () => {
  test("renders bigint values deterministically and rejects hand edits", () => {
    const rendered = renderResolvedConfigJson({ season: { startMainAt: 12n } } as never);

    expect(rendered).toContain('"startMainAt": "12"');
    expect(() => assertGeneratedConfigArtifactCurrent("config.json", rendered, rendered)).not.toThrow();
    expect(() =>
      assertGeneratedConfigArtifactCurrent("config.json", rendered, rendered.replace('"12"', '"13"')),
    ).toThrow("generated config artifact is stale or hand-edited");
  });
});
