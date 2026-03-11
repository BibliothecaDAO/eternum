# Eternum S2 Detailed Task Dispatch

Date: 2026-03-11
Scope: Frontend and config only (contracts assumed complete)

## Raschel (Frontend Systems + Lobby + Non-Map S2 Features)

1. Refactor game mode system to support explicit `s2` mode in `client/apps/game/src/config/game-modes/index.ts`.
2. Replace current Blitz boolean-only mode detection with a mode discriminator from world config/metadata.
3. Add S2 labels/rules/assets config object in parallel to Blitz config.
4. Update world availability logic in `client/apps/game/src/hooks/use-world-availability.ts` to be mode-aware instead of Blitz-only SQL fields.
5. Remove hard `s1_eternum-*` assumptions where possible in lobby queries.
6. Split registration flow in `client/apps/game/src/hooks/use-world-registration.ts`: Blitz path vs S2 path.
7. Split entry flow in `client/apps/game/src/ui/features/landing/components/game-entry-modal.tsx`: Blitz systems vs S2 systems.
8. Ensure S2 entry path never calls `blitz_*` contracts/selectors.
9. Add S2 preset to factory admin in `client/apps/game/src/ui/features/admin/pages/factory.tsx`.
10. Extend world-config builder in `client/apps/game/src/ui/features/admin/services/world-config-builder.ts` for S2 defaults (duration, spacing, registration knobs, etc).
11. Update deployer config writer in `config/deployer/config.ts` and provider call surface if S2 mode payload differs from Blitz bool.
12. Extend structure type UI for S2 structures (Spire, Camp, Essence Rift, Holy Site, Bitcoin Mine) in minimap/panels/tooltips.
13. Build Faith UX surfaces: faith leaderboard, devotion actions, wonder detail view, FP wallet visibility.
14. Build village and army UX surfaces: militia timer, raid immunity timer, army strength and deployment cap indicators.
15. Build agent UX updates: agent type badges, local messaging UI, essence messaging cost preview.
16. Build exploration reward UX: subtle tile indicator for unclaimed rewards plus collect/bypass action state.
17. Validate that realm resource construction remains metadata-driven and no UI regression on that rule.
18. Own integration QA for all non-map S2 features plus Blitz regression sanity.

## Loaf (Map Layer Owner)

1. Introduce layer-aware coordinate types (`col,row,alt`) in `packages/types/src/types/common.ts` and dependent interfaces.
2. Add layer parameter support to URLs in `packages/core/src/systems/position.ts`.
3. Update navigation stack to preserve and switch layer in `client/apps/game/src/three/utils/navigation.ts` and `client/apps/game/src/three/utils/location-manager.ts`.
4. Update client map state stores for layer-awareness in `client/apps/game/src/hooks/store/use-three-store.ts`.
5. Replace default `DEFAULT_COORD_ALT=false` assumptions in map-critical read and write paths.
6. Make Torii map fetches layer-aware in `client/apps/game/src/dojo/queries.ts`.
7. Ensure scene rendering in `client/apps/game/src/three/scenes/worldmap.tsx` correctly handles base layer vs Ethereal layer.
8. Implement spire interaction transitions (base -> ethereal -> base) with proper camera and selection continuity.
9. Implement cross-layer occupancy conflict UX hook when destination tile is occupied.
10. Add layer state cues in map HUD and minimap and ensure selection and action paths are consistent per layer.
11. Validate pathing and movement costs shown correctly per layer rule set.
12. Run a performance pass focused on chunk loading and layer switching.
13. Write and adjust tests for layer parsing, URL sync, and map query branching.
14. Own map-layer integration QA in both desktop and mobile viewports.

## Ermakow (Visual Artist)

1. Define S2 visual direction pack: Ethereal Plains mood, color language, lighting references, marker hierarchy.
2. Deliver Spire visual kit: icon, label, map marker variants, interaction state assets.
3. Deliver Camp visual kit (distinct from Village), including map and panel iconography.
4. Deliver Essence Rift visual kit aligned to S2 style.
5. Deliver Holy Site visual kit with readability at minimap scale.
6. Deliver Bitcoin Mine visual kit, including satoshi visual motif.
7. Produce Ethereal-layer-specific minimap treatment and map symbol system.
8. Produce layer transition FX frames and guides for frontend implementation.
9. Produce Faith UI art assets: leaderboard accents, devotion and wonder motifs, badge system.
10. Produce agent class markers (Basic, Advanced, Ethereal) with clear readability tiers.
11. Create subtle exploration reward indicator assets with low-noise presentation.
12. Provide final export pack with naming conventions and usage notes for frontend integration.
13. Run visual QA pass on desktop and mobile and deliver revision set.
14. Sign off consistency pass so Blitz visuals remain unchanged and S2 visuals are clearly distinct.

## Notes

- Confirmed S2 rule included in planning: each realm can construct only resources from its NFT metadata (S0/S1 behavior).
- Contracts are assumed complete; tasks above are for client integration, UX, visuals, and config/admin tooling.
