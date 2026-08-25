# Realms World Medieval Theme Design Spec

## 1. Document Control
- Product: `realms-world-site`
- Date: February 13, 2026
- Status: Draft (Implementation-ready)
- Branch: `ponderingdemocritus/medievalspec`
- Owner: Design + Frontend

## 2. Objective
Deliver a full landing-page visual theme that feels unmistakably medieval-fantasy while preserving Realms brand marks and core color identity.

Primary outcome:
- Within 3 seconds, users should perceive "mythic strategy gaming ecosystem" rather than generic web3 landing page.

## 3. Constraints and Non-Negotiables
1. Keep existing logos and brand primary color family.
2. Preserve usability and readability on mobile.
3. Support both light/dark theme modes, but optimize landing for dark-first atmosphere.
4. Keep performance budgets stable (no uncontrolled Three.js or animation bloat).
5. Avoid decorative clutter that obscures primary actions (`Explore Ecosystem`, `Enter Realm`, governance/actions).

## 4. Audience and UX Priorities
- Primary audience: gamers evaluating worlds to play.
- Secondary audience: crypto-native users evaluating ecosystem depth and token/governance legitimacy.

Top tasks on landing:
1. Understand what Realms is (agent-native mythic gaming ecosystem).
2. Discover playable games quickly.
3. Trust ecosystem depth (partners, value flow, tokenomics, governance).
4. Convert to exploration actions (games list, individual game pages, ecosystem links).

## 5. Experience Pillars
1. **Mythic Atmosphere**: iron, parchment, ember, sigils, relic lighting.
2. **Strategic Clarity**: metrics and cards remain sharp and scan-friendly.
3. **World Cohesion**: every section feels like the same "realm UI kit."
4. **Motion Discipline**: cinematic, restrained, purposeful.

## 6. Theme System Architecture

### 6.1 Token Strategy
Extend existing semantic variables in `src/index.css` instead of replacing them. Add a parallel medieval token layer mapped into current semantic tokens.

New token groups:
- `--realm-bg-*` (void, smoke, obsidian)
- `--realm-surface-*` (iron, slate, parchment-dark)
- `--realm-accent-*` (ember, brass, arcane-blue)
- `--realm-border-*` (etched, strong, glow)
- `--realm-effect-*` (fog, glow, vignette, rune-line)

### 6.2 Proposed Token Palette (Dark-first)
Suggested values (OKLCH):
- `--realm-bg-void`: `oklch(0.12 0.01 260)`
- `--realm-bg-smoke`: `oklch(0.17 0.015 250)`
- `--realm-surface-iron`: `oklch(0.23 0.01 80)`
- `--realm-surface-slate`: `oklch(0.27 0.012 260)`
- `--realm-accent-ember`: `oklch(0.72 0.14 55)`
- `--realm-accent-brass`: `oklch(0.78 0.10 85)`
- `--realm-accent-arcane`: `oklch(0.65 0.08 260)`
- `--realm-border-etched`: `oklch(0.38 0.04 75)`

Map to current semantic vars where possible:
- `--primary` remains brand gold family.
- `--background`, `--card`, `--border`, `--muted` are shifted toward iron/obsidian surfaces.

### 6.3 Radius and Edge Language
Current `--radius: 0rem` is very hard-edged. Keep angular style but add controlled variation:
- Section frames: `8px`
- Card frames: `10px`
- Buttons/chips: `6px`
- "Sigil" chips: `999px` but with etched border

Implementation path:
- Introduce section/card helper classes; do not globally round everything.

## 7. Typography Spec

### 7.1 Font Roles
- Display (hero only): `Cinzel` (already loaded), heavier weights.
- Heading (section titles): `Cinzel`, tighter tracking.
- Body/UI: `Manrope` (keep readability).
- Mono/data: `Source Code Pro`.

### 7.2 Typographic Rules
1. Use serif only for hierarchy anchors (H1/H2 + selected labels).
2. Keep body and KPI values sans-serif for scan speed.
3. Increase letter-spacing only on overlines/eyebrows.
4. Avoid all-caps for long sentences.

### 7.3 Scale Targets
- Hero H1: `clamp(2.6rem, 8vw, 5.8rem)`
- Section H2: `clamp(2rem, 4vw, 3.4rem)`
- KPI value: `clamp(1.4rem, 2.4vw, 2.2rem)`

## 8. Surface and Ornament Language

### 8.1 Background System
Layered composition for landing:
1. Base: deep void gradient.
2. Mid: radial fog/ember blooms.
3. Foreground: subtle grain/noise overlay at low opacity.
4. Section separators: rune-line gradients, not plain borders.

### 8.2 Decorative Motifs
- Banner overlines for section labels.
- Etched borders with dual-stroke effect.
- Sigil chips for metadata tags (genre/studio/state).
- Avoid medieval clip-art; keep abstract and premium.

## 9. Component-Level Design Spec

## 9.1 `TopBar`
File: `src/components/layout/TopBar.tsx`
- Keep simplified nav (`Games`, `Scroll`) and right rail.
- Restyle container as "iron plaque":
  - layered border, soft glow on hover/scroll state.
- Rail buttons become compact rune tabs with active glow.
- Preserve current behavior and anchors.

## 9.2 `Button`
File: `src/components/ui/button.tsx`
- Add variants:
  - `war`: primary CTA with brass/ember glow.
  - `oath`: outlined, etched-border secondary CTA.
  - `rune`: compact nav/meta action.
- Keep existing touch targets (`h-11` minimum).

## 9.3 `Card`
File: `src/components/ui/card.tsx`
- Introduce medieval card utility classes:
  - `card-relic`: iron panel + edge highlights.
  - `card-parchment-dark`: readable narrative blocks.
- Use layered borders (outer faint + inner etched).

## 9.4 Section Wrappers
Files: `src/components/sections/*.tsx`
- Standardize section scaffold:
  - overline banner
  - H2 + short tactical description
  - snapshot block first
  - content grid second
  - action/footer strip third

## 10. Section-by-Section Visual Direction

### 10.1 Intro / Hero
File: `src/components/sections/IntroSection.tsx`
- Turn hero into "war-room proclamation":
  - banner overline
  - high-contrast main claim
  - framed CTA row
  - relic-stat tiles with icon badges
- Maintain data-driven live metrics.

### 10.2 Agent Native
File: `src/components/sections/AgentNativeSection.tsx`
- Keep `Rollout Snapshot`.
- Visual style: campaign briefing board.
- Pillars become sequential tactical cards (I/II/III markers).

### 10.3 Ecosystem Atlas
File: `src/components/sections/EcosystemAtlasSection.tsx`
- Keep `Atlas Snapshot`.
- Game cards: stronger framed image windows + metadata sigils.
- "View Full Ecosystem" CTA styled as command button.

### 10.4 Partners
File: `src/components/sections/PartnersSection.tsx`
- Keep `Capability Map`.
- Role cards use faction-style emblems/labels.
- Ensure logos remain visually dominant and unaltered.

### 10.5 Value Flow
File: `src/components/sections/ValueFlowSection.tsx`
- Keep flow graph but theme surrounding UI as "ledger of tribute."
- Snapshot + source cards adopt unified border/surface language.

### 10.6 Tokenomics
File: `src/components/sections/TokenomicsSection.tsx`
- Keep `Supply Snapshot` structure.
- Style split card as treasury parchment + seal accents.

### 10.7 Treasury
File: `src/components/sections/TreasurySection.tsx`
- Keep `Governance Pulse`.
- Visualize governance as "council chamber" cards:
  - proposal status icons become heraldic markers.

### 10.8 Footer
File: `src/components/sections/FooterSection.tsx`
- Convert to "guild hall footer":
  - grouped columns with clearer priority
  - maintain utility links and status line
  - keep `Game Coverage` metric

## 11. Three.js Direction
File: `src/components/RealmSceneBackground.tsx`

Current Mobius centerpiece remains but should be art-directed as a relic:
1. Material shifts toward forged metal + ember edge fresnel.
2. Particle field becomes ash/ember drift (warmer palette bias).
3. Add subtle rune-ring plane behind centerpiece (very low opacity).
4. Respect `prefers-reduced-motion`; keep existing reduced-motion behavior.

Performance guardrails:
- Keep particle counts close to current bounds.
- No additional high-poly meshes without measurable value.

## 12. Motion Spec
- Entry motion duration: `350-700ms`.
- Section stagger: `60-120ms`.
- Hover elevation: `translateY(-2px)` max.
- Avoid perpetual attention loops except ambient background effects.
- Ensure all decorative motion is disabled/reduced under reduced-motion preference.

## 13. Accessibility and Readability
1. Text contrast target: WCAG AA minimum (`4.5:1`) for body.
2. Decorative overlays must not lower text legibility.
3. Maintain keyboard focus rings on all interactive controls.
4. Keep minimum touch size (`44x44`) for mobile actions.
5. Do not encode status with color alone (pair with text/icon).

## 14. Performance Budget
1. Avoid adding large texture assets for ornamental surfaces.
2. Prefer CSS gradients/noise over heavy PNG overlays.
3. Keep lazy section loading strategy in `src/routes/index.tsx`.
4. Track bundle impact after theme pass:
  - no significant regression in core landing chunks
  - watch `three-vendor` growth carefully

## 15. Implementation Plan (Phased)

### Phase 1: Theme Foundation
Files:
- `src/index.css`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- optional new: `src/components/ui/theme-primitives.tsx`

Tasks:
1. Add medieval token layer and section utility classes.
2. Add button/card variants.
3. Introduce reusable visual primitives (`section banner`, `sigil chip`, `etched panel`).

### Phase 2: Landing Application
Files:
- `src/components/layout/TopBar.tsx`
- `src/components/sections/*.tsx`

Tasks:
1. Apply new primitives consistently across all sections.
2. Remove duplicate one-off class patterns.
3. Keep current information hierarchy from latest UX pass.

### Phase 3: Atmosphere + 3D Polish
Files:
- `src/components/RealmSceneBackground.tsx`
- section-level decorative wrappers

Tasks:
1. Art-direct Mobius scene to match medieval palette.
2. Tune ambient effects and reduce visual noise.
3. Validate reduced-motion paths.

### Phase 4: Hardening
Tasks:
1. Mobile polish and spacing QA.
2. Contrast/focus accessibility QA.
3. Performance and bundle regression review.

## 16. Validation Checklist
Run after each implementation phase:
1. `node --test tests/agent-native-overhaul.test.mjs`
2. `node --test tests/mobile-fixes.test.mjs tests/seo-mobile-readiness.test.mjs`
3. `pnpm lint`
4. `pnpm build`

Manual QA:
1. Desktop: 1440px and 1920px visual pass.
2. Mobile: 375px and 430px visual pass.
3. Dark/light mode readability.
4. Reduced-motion behavior check.

## 17. Definition of Done
1. Landing feels coherently medieval-fantasy across all sections.
2. Core actions and metrics remain easier to scan than pre-theme baseline.
3. No regressions in navigation, anchors, mobile layout, and key tests.
4. Performance remains within acceptable range after style overhaul.

## 18. Open Decisions Needed
1. Confirm whether to keep `Cinzel` as primary heading font or switch to a new medieval display family.
2. Decide whether to keep light mode parity or intentionally de-emphasize it for landing.
3. Confirm how aggressive ornamental borders should be (minimal, medium, high).
4. Approve final atmospheric direction:
  - `Iron + Ember` (recommended)
  - `Parchment + Gold`
  - `Arcane Blue + Steel`
