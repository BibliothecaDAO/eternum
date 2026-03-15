# Eternum S2 Detailed Task Dispatch

Date: 2026-03-11 Scope: Frontend and config only (contracts are source of truth)

## Raschel (Frontend Systems + Lobby + Non-Map S2 Features)

1. Refactor game mode system to keep canonical `eternum`/`blitz` ids and layer S2 presentation config under `eternum` in
   `client/apps/game/src/config/game-modes/index.ts`.
2. Keep mode detection contract-aligned: resolve mode from world config `blitz_mode_on` only.
3. Add S2 labels/rules/assets config object under `eternum` while preserving Blitz behavior.
4. Update world availability logic in `client/apps/game/src/hooks/use-world-availability.ts` to query `blitz_mode_on`
   first, then run mode-specific world-config query.
5. Remove hard `s1_eternum-*` assumptions where possible in lobby queries.
6. Split registration flow in `client/apps/game/src/hooks/use-world-registration.ts`: Blitz (`obtain_entry_token` +
   `register`) vs season (`realm_systems.create`).
7. Split entry flow in `client/apps/game/src/ui/features/landing/components/game-entry-modal.tsx`: Blitz systems vs
   season systems.
8. Ensure season entry path never calls `blitz_*` selectors and adds preflight UX for spire settlement, season pass, and
   season timing prerequisites.
9. Add S2 preset to factory admin in `client/apps/game/src/ui/features/admin/pages/factory.tsx`.
10. Extend world-config builder in `client/apps/game/src/ui/features/admin/services/world-config-builder.ts` for S2
    defaults (duration, spacing, registration knobs, etc).
11. Keep deployer/provider mode config payload on `blitz_mode_on` bool; do not introduce alternate mode payload.
12. Extend structure/entity UI for season-relevant entities (Spire occupier interaction, Mine/Essence Rift label
    mapping, Holy Site, Bitcoin Mine), while keeping Camp discovery Blitz-only.
13. Build Faith UX surfaces: faith leaderboard, devotion actions, wonder detail view, FP wallet visibility.
14. Build village and army UX surfaces: militia timer, raid immunity timer, army strength and deployment cap indicators.
15. Build agent UX updates: troop type/tier badges and metadata; defer local messaging and essence messaging cost
    preview until contracts exist.
16. Build exploration reward UX: subtle tile indicator for unclaimed rewards plus collect/bypass action state.
17. Validate that realm resource construction remains metadata-driven and no UI regression on that rule.
18. Own integration QA for all non-map S2 features plus Blitz regression sanity.
19. Build season pass inventory UI for connected wallet using configured `season_pass_address`.
20. Decode and display season pass metadata (realm identity and allowed resources) for each pass before settlement.
21. Implement per-pass settlement picker (`side/layer/point`) with contract-aligned bounds/preflight validation and
    transaction error handling.
22. Build village pass inventory flow and settlement action via
    `village_systems.create(village_pass_token_id, realm_id, direction)`.
23. Implement casino-style village resource reveal animation that resolves from post-tx on-chain village resource state.
24. Treat village pass "buy" as external acquisition; gate in-game flow on ownership/availability only.

## Loaf (Map Layer Owner)

1. Introduce layer-aware coordinate types (`col,row,alt`) in `packages/types/src/types/common.ts` and dependent
   interfaces.
2. Add layer parameter support to URLs in `packages/core/src/systems/position.ts`.
3. Update navigation stack to preserve and switch layer in `client/apps/game/src/three/utils/navigation.ts` and
   `client/apps/game/src/three/utils/location-manager.ts`.
4. Update client map state stores for layer-awareness in `client/apps/game/src/hooks/store/use-three-store.ts`.
5. Replace default `DEFAULT_COORD_ALT=false` assumptions in map-critical read and write paths.
6. Make Torii map fetches layer-aware in `client/apps/game/src/dojo/queries.ts`.
7. Ensure scene rendering in `client/apps/game/src/three/scenes/worldmap.tsx` correctly handles base layer vs Ethereal
   layer.
8. Implement spire interaction transitions (base -> ethereal -> base) with proper camera and selection continuity.
9. Implement cross-layer occupancy conflict UX with pre-check and revert handling for `toggle_alternate` destination
   occupancy failures.
10. Add layer state cues in map HUD and minimap and ensure selection and action paths are consistent per layer.
11. Validate pathing/movement and cross-layer battle affordances against contract layer rules.
12. Run a performance pass focused on chunk loading and layer switching.
13. Write and adjust tests for layer parsing, URL sync, and map query branching.
14. Own map-layer integration QA in both desktop and mobile viewports.
15. Add map overlays/previews for realm settlement slot selection (`side/layer/point`) and resulting target coordinate.
16. Add map overlays/previews for village direction-slot selection relative to connected realms.

## Ermakow (Visual Artist)

1. Define S2 visual direction pack: Ethereal Plains mood, color language, lighting references, marker hierarchy.
2. Deliver Spire visual kit: icon, label, map marker variants, interaction state assets.
3. Deliver Camp visual kit (distinct from Village) for Blitz-only discovery contexts.
4. Deliver Mine/Essence Rift visual kit with mode-aware naming treatment.
5. Deliver Holy Site visual kit with readability at minimap scale.
6. Deliver Bitcoin Mine visual kit, including satoshi visual motif.
7. Produce Ethereal-layer-specific minimap treatment and map symbol system.
8. Produce layer transition FX frames and guides for frontend implementation.
9. Produce Faith UI art assets: leaderboard accents, devotion and wonder motifs, badge system.
10. Produce agent type/tier markers aligned to troop type+tier readability needs.
11. Create subtle exploration reward indicator assets with low-noise presentation.
12. Provide final export pack with naming conventions and usage notes for frontend integration.
13. Run visual QA pass on desktop and mobile and deliver revision set.
14. Sign off consistency pass so Blitz visuals remain unchanged and S2 visuals are clearly distinct.
15. Deliver season pass card/metadata presentation assets (inventory and selection states).
16. Deliver village resource reveal sequence assets for the casino-style post-settlement reveal.

## Notes

- Confirmed S2 rule included in planning: each realm can construct only resources from its NFT metadata (S0/S1
  behavior).
- Contracts are source of truth; tasks above are for client integration, UX, visuals, and config/admin tooling.
- Contract alignment anchors for this plan: mode comes from `blitz_mode_on`; season entry uses `realm_systems.create`;
  Spire is a tile occupier interaction point (not structure category); Camp is Blitz-only discovery; Mine naming/reward
  differs by mode.
- Additional alignment anchors: settlement uses `side/layer/point`; village settlement consumes village pass ownership;
  village resource is randomized on creation and revealed from post-tx state; village pass purchase is external to game
  systems.
