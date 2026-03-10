import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const stylesPath = resolve(currentDir, "../styles.css");
const buttonPath = resolve(currentDir, "../components/ui/button.tsx");
const styles = readFileSync(stylesPath, "utf8");
const buttonSource = readFileSync(buttonPath, "utf8");

describe("account portal theme", () => {
  it("uses the realms-world-site font stack", () => {
    expect(styles).toContain("family=Cinzel");
    expect(styles).toContain("family=MedievalSharp");
    expect(styles).toContain("family=Rajdhani");
    expect(styles).toContain("--font-sans: Rajdhani, sans-serif;");
    expect(styles).toContain("--font-serif: MedievalSharp, serif;");
    expect(styles).toContain("--font-display: Cinzel, serif;");
  });

  it("defines the realms-world-site atmosphere tokens", () => {
    expect(styles).toContain("--realm-bg-void");
    expect(styles).toContain("--realm-surface-iron");
    expect(styles).toContain("--realm-accent-ember");
    expect(styles).toContain("--realm-accent-brass");
    expect(styles).toContain("--realm-border-etched");
  });

  it("gives outline buttons an etched panel treatment", () => {
    expect(buttonSource).toContain("border-[color:var(--realm-border-etched)]");
    expect(buttonSource).toContain("bg-card/80");
    expect(buttonSource).toContain(
      "hover:border-[color:var(--realm-accent-brass)]",
    );
  });
});
