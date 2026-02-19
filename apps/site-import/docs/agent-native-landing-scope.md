# Scope: Agent-Native Games Messaging on Landing Page

## 1. Document Control
- Product: `realms-world-site`
- Date: February 12, 2026
- Status: Draft (Scoping)
- Branch: `ponderingdemocritus/agentlp`

## 2. Goal
Update the landing page to clearly communicate that Realms World is launching an agent that can play all games, and position the ecosystem as agent-native.

## 3. Current State (Code Reality)
- Homepage composition is in `src/routes/index.tsx` and currently renders:
  - `IntroSection`
  - `GamesSection`
  - `PartnersSection`
  - `ValueFlowSection`
  - `TokenomicsSection`
  - `TreasurySection`
- Hero copy is in `src/components/sections/IntroSection.tsx`.
- Featured game carousel is in `src/components/sections/GamesSection.tsx`.
- Homepage section nav items are defined in `src/components/layout/TopBar.tsx`.
- Games metadata is centralized in `src/data/games.ts`.

## 4. Scope Options

### Option A: Copy-Only (Fastest)
Change only homepage messaging to include agent-native positioning.

Deliverables:
1. Update hero headline/subheadline in `src/components/sections/IntroSection.tsx`.
2. Update homepage meta description in `src/routes/index.tsx`.

Effort:
- ~0.5 day including QA.

Pros:
- Lowest risk, fastest ship.

Limits:
- No dedicated section explaining what the agent does.
- No per-game “agent-ready” visibility.

### Option B: Recommended Landing Refresh
Add dedicated “Agent-Native Games” section and wire it into homepage navigation.

Deliverables:
1. Add new section component, e.g. `src/components/sections/AgentNativeSection.tsx`.
2. Insert section in `src/routes/index.tsx` (likely between hero and featured games).
3. Add section anchor in `src/components/layout/TopBar.tsx` for homepage nav.
4. Add CTA(s), e.g.:
  - `Try the Agent` (if route exists)
  - `Join Waitlist` (if external form exists)
5. Refresh SEO copy in `src/routes/index.tsx`.

Effort:
- ~1 to 2 days including responsive polish and QA.

Pros:
- Clear value narrative.
- Stronger launch messaging.

Limits:
- Still no per-game agent status in listing/details.

### Option C: Full Agent-Native Surface (Landing + Games IA)
Extend Option B with structured agent-support metadata across game surfaces.

Deliverables:
1. Add field to `Game` type in `src/data/games.ts`, for example:
   - `agentSupport: "live" | "launching" | "planned"`
2. Annotate each game entry with agent support state.
3. Show badge on:
   - `src/components/sections/GamesSection.tsx`
   - `src/routes/games/index.tsx`
   - `src/components/game/GameDetails.tsx`
4. Optional: Add filter “Agent-ready”.

Effort:
- ~2 to 3 days including data updates and QA.

Pros:
- End-to-end clarity.
- Future-proof for phased game enablement.

Limits:
- Requires high-confidence status data per game.

## 5. Recommended Slice to Start
Start with **Option B**:
1. It is enough to launch the message credibly.
2. It avoids blocking on precise per-game status data.
3. Option C can follow without reworking core landing structure.

## 6. Proposed Content Blocks (Option B)
Section: `Agent-Native Games`

Content pattern:
1. Claim: “One agent, every game in the Realms ecosystem.”
2. How it works: short 3-step explanation (discover game -> execute actions -> optimize play).
3. Launch state: “Launching soon” language with specific CTA.
4. Trust framing: transparent note that coverage expands over time if needed.

## 7. Dependencies / Inputs Needed
Before implementation, confirm:
1. Final launch copy (headline + subheadline + legal-safe claim language).
2. Agent name/brand label.
3. CTA destination:
   - URL/route for product page, or
   - Waitlist form URL.
4. Asset availability:
   - Agent visual (image/video/demo) or use text-first layout.
5. Whether claim is strictly “all games at launch” or “all games over rollout.”

## 8. Risks and Mitigations
1. Risk: Overstating “plays all games” before full support.
   - Mitigation: Use precise launch wording and visible rollout note.
2. Risk: Added visual media increases page weight.
   - Mitigation: Keep new section lightweight and lazy-load heavy media.
3. Risk: Inconsistent game count messaging.
   - Mitigation: Replace hardcoded “Active Games: 6” in `IntroSection` with derived value from `games` data.

## 9. Acceptance Criteria (Option B Baseline)
1. Homepage includes a clear `Agent-Native Games` section.
2. Section appears in homepage navigation and scrolls correctly.
3. Hero/SEO copy reflects agent launch messaging.
4. Mobile layout remains readable and functional.
5. No regression in existing routes: `/`, `/games`, `/games/:slug`.

## 10. Implementation Checklist (When Approved)
1. Implement section and route insertion.
2. Update top navigation section map.
3. Update hero and meta copy.
4. Run checks:
   - `pnpm lint`
   - `pnpm build`
   - `node --test tests/mobile-fixes.test.mjs tests/seo-mobile-readiness.test.mjs`
