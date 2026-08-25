import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const stylesPath = resolve(currentDir, "../styles.css");
const buttonPath = resolve(currentDir, "../components/ui/button.tsx");
const homepagePath = resolve(
  currentDir,
  "../components/modules/homepage/homepage.tsx",
);
const indexRoutePath = resolve(currentDir, "../routes/index.tsx");
const proposalListPath = resolve(currentDir, "../routes/proposal.list.tsx");
const delegateProfilePath = resolve(
  currentDir,
  "../routes/delegate.profile.tsx",
);
const proposalDetailPath = resolve(currentDir, "../routes/proposal.$id.tsx");
const velordsIndexPath = resolve(currentDir, "../routes/velords.index.tsx");
const claimsPath = resolve(
  currentDir,
  "../components/modules/realms/claims.tsx",
);
const appSidebarPath = resolve(
  currentDir,
  "../components/layout/app-sidebar.tsx",
);
const delegateListPath = resolve(currentDir, "../routes/delegate.list.tsx");
const comingSoonPath = resolve(currentDir, "../routes/coming-soon.index.tsx");
const markdownRendererPath = resolve(
  currentDir,
  "../components/ui/markdown-renderer.tsx",
);
const styles = readFileSync(stylesPath, "utf8");
const buttonSource = readFileSync(buttonPath, "utf8");
const homepageSource = readFileSync(homepagePath, "utf8");
const indexRouteSource = readFileSync(indexRoutePath, "utf8");
const proposalListSource = readFileSync(proposalListPath, "utf8");
const delegateProfileSource = readFileSync(delegateProfilePath, "utf8");
const proposalDetailSource = readFileSync(proposalDetailPath, "utf8");
const velordsIndexSource = readFileSync(velordsIndexPath, "utf8");
const claimsSource = readFileSync(claimsPath, "utf8");
const appSidebarSource = readFileSync(appSidebarPath, "utf8");
const delegateListSource = readFileSync(delegateListPath, "utf8");
const comingSoonSource = readFileSync(comingSoonPath, "utf8");
const markdownRendererSource = readFileSync(markdownRendererPath, "utf8");

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
    expect(buttonSource).toContain("border-realm-etched");
    expect(buttonSource).toContain("bg-card/80");
    expect(buttonSource).toContain(
      "hover:border-[color:var(--realm-accent-brass)]",
    );
  });

  it("uses brass accents instead of white edge highlights", () => {
    expect(styles).not.toContain("white 10%");
    expect(styles).not.toContain("white 8%");
    expect(styles).not.toContain("white 7%");
    expect(styles).toContain("var(--realm-accent-brass)");
  });

  it("maps semantic borders onto the realm gold palette", () => {
    expect(styles).toContain("--border: oklch(0.52 0.04 75);");
    expect(styles).toContain("--border: oklch(0.38 0.04 75);");
    expect(styles).toContain("border-color: var(--border);");
  });

  it("uses flat backgrounds instead of gradients", () => {
    expect(styles).not.toContain("radial-gradient(");
    expect(styles).not.toContain("background-image:");
    expect(styles).not.toContain("background: linear-gradient(");
  });

  it("points marketplace CTAs at market.realms.world", () => {
    expect(homepageSource).toContain('href="https://market.realms.world');
    expect(homepageSource).not.toContain("empire.realms.world/trade/realms");
  });

  it("keeps the dashboard title inline instead of inside a framed panel", () => {
    expect(indexRouteSource).not.toContain("realm-panel mb-4 rounded-3xl");
    expect(indexRouteSource).toContain('className="mb-3 flex flex-wrap');
  });

  it("keeps homepage spacing tight and consistent", () => {
    expect(homepageSource).not.toContain('className="space-y-8"');
    expect(homepageSource).not.toContain('className="grid grid-cols-1 gap-8');
    expect(homepageSource).not.toContain(
      'CardContent className="p-12 text-center"',
    );
    expect(homepageSource).toContain('className="space-y-6"');
  });

  it("uses the shared page title treatment on primary portal screens", () => {
    expect(indexRouteSource).toContain("realm-page-title");
    expect(velordsIndexSource).toContain("PageHeader");
    expect(proposalListSource).toContain("realm-page-title");
    expect(proposalDetailSource).toContain("realm-page-title");
    expect(delegateProfileSource).toContain("realm-page-title");
    expect(claimsSource).toContain("realm-page-title");
  });

  it("defines a shared card title utility", () => {
    expect(styles).toContain(".realm-card-title");
    expect(styles).toContain("font-size: 1.125rem;");
  });

  it("tokenizes heading tracking values", () => {
    expect(styles).toContain("--tracking-page");
    expect(styles).toContain("--tracking-card");
    expect(styles).toContain("--tracking-eyebrow");
  });

  it("uses shared page shell primitives on outlier pages", () => {
    expect(comingSoonSource).not.toContain("bg-gradient-to-r");
    expect(delegateListSource).not.toContain("bg-background top-0");
  });

  it("uses shared components for the veLords header and stat cards", () => {
    expect(velordsIndexSource).toContain("PageHeader");
    expect(velordsIndexSource).toContain("MetricCard");
  });

  it("uses shared prose heading classes in markdown", () => {
    expect(markdownRendererSource).toContain("realm-prose-h1");
    expect(markdownRendererSource).toContain("realm-prose-h2");
  });

  it("uses one dark surface value across header, sidebar, and panels", () => {
    expect(styles).toContain("--card: oklch(0.16 0.006 260);");
    expect(styles).toContain("--popover: oklch(0.16 0.006 260);");
    expect(styles).toContain("--sidebar: oklch(0.16 0.006 260);");
  });

  it("keeps gold limited to structural text roles", () => {
    expect(styles).toContain(".realm-card-title");
    expect(styles).toContain("color: var(--primary);");
    expect(styles).toContain(".realm-prose-h1");
    expect(styles).toContain("color: var(--foreground);");
  });

  it("uses the cleaned sidebar destination map", () => {
    expect(appSidebarSource).not.toContain('title: "Claims"');
    expect(appSidebarSource).toContain("https://market.realms.world");
    expect(appSidebarSource).toContain('url: "https://realms.world"');
    expect(appSidebarSource).toContain('url: "https://blitz.realms.world"');
    expect(appSidebarSource).toContain('url: "https://docs.realms.world"');
  });
});
