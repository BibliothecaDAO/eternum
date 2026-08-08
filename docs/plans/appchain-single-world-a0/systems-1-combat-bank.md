# A0 systems slice 1 — alt_movement, artificer, bank, bitcoin_mine, combat

Facts: troop_management.cairo live code = lines 1-932 (rest commented tests); troop_movement.cairo holds 8
dojo::contract modules (movement, movement_util, + 6 discovery systems). Universal caveat: ownership checks are
caller-address-based → do NOT separate games; every multi-entity fn needs assert(a.game_id == b.game_id).

Ambient accessors (all → WORLD*CONFIG_ID singleton): SeasonConfigImpl::get, WorldConfigUtilImpl::get/set_member,
TickImpl::get_tick_interval/get_bitcoin_phase_interval, CombatConfigImpl::troop*\*, WorldRecordImpl::get/set_member,
AgentCountImpl (AgentConfig/Count/LifetimeCount), PlayerRegisteredPointsImpl::register_points (writes SeasonPrize),
CoordImpl::center (map_center_offset), assert_caller_is_admin.

Key per-fn results (full detail in agent report — high-confidence summary):

alt*movement.toggle_alternate (:30): DERIVABLE; 3 coord TileOpt reads (:43,:48,:56) — cross-game aliasing;
IMapImpl::occupy writes. artificer.burn_research_for_relic (:38): DERIVABLE; VRF Source::Nonce(owner) per-address —
correlated draws across games same block. bank.create_banks (:43): MUST_PASS; writes 6 FIXED ids REGIONAL_BANK*\*\_ID
(:53-56); assert banks.len()==6; AddressName keyed bank id (:75); mercenary seed from constant bank id → identical mercs
every game. Second game overwrites first's banks. liquidity.add (:57)/remove (:135): Market keyed resource_type ONLY
(global AMM); Liquidity (player,resource_type) fungible across games; remove with entity_id==0 exits to wallet via
bridge — VALUE EXTRACTION cross-game; bank identity only category check. swap.buy (:52)/sell (:143): global Market
mutation; no same-game assert bank vs structure; cross-game donkey transfer. bitcoin_mine.contribute_labor (:41):
BitcoinPhaseLabor keyed wall-clock phase_id only — shared prize pool/denominator. claim_phase_reward (:131):
PERMISSIONLESS, caller-supplied mine_ids array, rollover loop mutates future phases. get_current_phase (:271): ambient
clock read (= the clock bug class). get_mine_contribution: global denominator. bitcoin_mine discovery find_treasure
(:34): MUST_PASS; ITroopMovementUtilSystems interface carries Tile BY VALUE + configs as args — no callee can derive
game. Interface must gain game_id (prereq for all 7 discovery contracts). troop_battle.attack_explorer_vs_explorer
(:92): DERIVABLE + same-game assert needed; coord-only range (is_explorer_battle_in_range :76-87); is_adjacent_to_spire
loops 6 neighbor TileOpt reads (utils/map.cairo:195-206); cross-game theft via troop_to_troop_instant.
attack_explorer_vs_guard (:376): battle_claim rewrites StructureOwner + writes SeasonPrize[WORLD_CONFIG_ID]
(utils/structure.cairo:202-260). attack_guard_vs_explorer (:661): defender-ownership assert COMMENTED OUT (:677-680) —
only coord range separates targets; battle_claim reachable (:815). troop_management: guard_add (:100) internal-caller
bypass via dns (must not bypass game guard); explorer_create (:229) uuid mint :255 + coord spawn-occupancy check
(:268-270) — game B blocks game A spawns; explorer_guard_swap (:594) same-structure assert DELIBERATELY DISABLED
(:622-628 "do not re-enable") — caller-address-only tie. troop_movement.explorer_move (:78): most leak-prone — 4 coord
TileOpt sites (:102,:128,:197,:280), occupy/explore writes, register_points→SeasonPrize singleton write (:167),
BiomeDiscovered (caller,biome) global, VRF Source::Salt(tile.to_seed()) coord-derived → correlated discoveries across
games (:150,:173), blitz_mode_on branch. explorer_extract_reward (:365): tile.reward_extracted coord-keyed one-shot —
game A burns game B's reward. movement_util.find_treasure (:521): MUST_PASS; StructureReservation read by Coord (:570);
7 dns dispatches. hyperstructure_discovery (:742): HyperstructureGlobals[WORLD_CONFIG_ID].created_count feeds
probability; CoordImpl::center singleton. mine/holysite/camp discovery: MUST_PASS, uuid + coord occupancy; camp = blitz
path (:933), holysite season-only (:882). agent_discovery (:966): AgentCount/LifetimeCount world-global caps — one game
exhausts, all starve. relic_chest_discovery (:1020): reads AND writes WorldRecord.relic_record singleton cadence timer
(:1046,:1052); always returns (false, None) quirk (:1054). troop_raid.raid_explorer_vs_guard (:76): singleton
blitz_mode_on hard-disables raids (:87-88) — flag must be per-game row for modes to coexist; biome by raw (alt,x,y) —
biome seed world-level; VillageRaidImmunity village_id-only.

Riskiest ranked: liquidity.remove/add; swap.buy/sell; bitcoin claim_phase_reward; explorer_move; extract_reward;
create_banks; attack_guard_vs_explorer; attack_explorer_vs_explorer; explorer_guard_swap; relic_chest cadence; agent
caps; hyperstructure discovery probability; raid mode-gate; explorer_create spawn; get_current_phase.

Interface work item: add game_id to ITroopMovementUtilSystems::find_treasure signature (+ Tile/TileOpt keys) —
prerequisite for the discovery fan-out (troop_movement.cairo:475-1057, bitcoin_mine/discovery_systems.cairo).
