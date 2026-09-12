// Frozen pre-cleanup layouts from 89bb76e. Do not regenerate from the current structs.
// Compatibility slots may be unused, but their widths, selectors and order must survive upgrades.
use dojo::meta::introspect::{Introspect, Member, Struct, Ty};
use dojo::meta::{FieldLayout, Layout};
use dojo::model::Model;
use starknet::ContractAddress;
use crate::models::config::{
    ArtificerConfig, BankConfig, BattleConfig, BitcoinMineConfig, BlitzExplorationConfig, BlitzRegistrationRulesConfig,
    BuildingConfig, CapacityConfig, FaithConfig, GameMapConfig, HyperstructureConfig, HyperstructureCostConfig,
    MapConfig, PresetConfig, PresetQuestGame, ResourceBridgeConfig, ResourceBridgeFeeSplitConfig, SpeedConfig,
    StartingResourcesConfig, StructureCapacityConfig, StructureMaxLevelConfig, TickConfig, TradeConfig,
    TroopDamageConfig, TroopLimitConfig, TroopStaminaConfig, VictoryPointsGrantConfig, VictoryPointsWinConfig,
    VillageFoundResourcesConfig, VillageTroopConfig,
};

#[derive(IntrospectPacked)]
struct LegacyMapConfig {
    reward_resource_amount: u16,
    shards_mines_win_probability: u16,
    shards_mines_fail_probability: u16,
    agent_discovery_prob: u16,
    agent_discovery_fail_prob: u16,
    camp_win_probability: u16,
    camp_fail_probability: u16,
    holysite_win_probability: u16,
    holysite_fail_probability: u16,
    bitcoin_mine_win_probability: u16,
    bitcoin_mine_fail_probability: u16,
    hyps_win_prob: u32,
    hyps_fail_prob: u32,
    hyps_fail_prob_increase_p_hex: u16,
    hyps_fail_prob_increase_p_fnd: u16,
    relic_discovery_interval_sec: u16,
    relic_hex_dist_from_center: u8,
    relic_chest_relics_per_chest: u8,
}

#[derive(Introspect)]
struct LegacyFaithConfig {
    enabled: bool,
    wonder_base_fp_per_sec: u16,
    holy_site_fp_per_sec: u16,
    realm_fp_per_sec: u16,
    village_fp_per_sec: u16,
    owner_share_percent: u16,
    reward_token: starknet::ContractAddress,
}

#[derive(Introspect)]
struct LegacyStructureCapacityConfig {
    realm_capacity: u64,
    village_capacity: u64,
    hyperstructure_capacity: u64,
    fragment_mine_capacity: u64,
    bank_structure_capacity: u64,
    holysite_capacity: u64,
    camp_capacity: u64,
    bitcoin_mine_capacity: u64,
}

#[derive(Introspect)]
struct LegacyQuestConfig {
    quest_discovery_prob: u16,
    quest_discovery_fail_prob: u16,
}

#[derive(Introspect)]
struct LegacyPresetQuestGame {
    address: ContractAddress,
    levels: Span<LegacyQuestLevel>,
}

#[derive(Introspect)]
struct LegacyQuestLevel {
    target_score: u32,
    settings_id: u32,
    time_limit: u64,
}

#[test]
fn existing_nested_config_layouts_keep_their_reserved_slots() {
    assert_eq!(Introspect::<MapConfig>::layout(), Introspect::<LegacyMapConfig>::layout());
    assert_eq!(Introspect::<FaithConfig>::layout(), Introspect::<LegacyFaithConfig>::layout());
    assert_eq!(Introspect::<StructureCapacityConfig>::layout(), Introspect::<LegacyStructureCapacityConfig>::layout());
    assert_eq!(Introspect::<PresetQuestGame>::layout(), Introspect::<LegacyPresetQuestGame>::layout());
    assert_eq!(
        Model::<GameMapConfig>::layout(),
        Layout::Struct(
            array![FieldLayout { selector: selector!("map_config"), layout: Introspect::<LegacyMapConfig>::layout() }]
                .span(),
        ),
    );
}

#[test]
fn existing_presets_keep_member_selectors_and_nested_storage_layouts() {
    let expected = Layout::Struct(
        array![
            FieldLayout {
                selector: selector!("hyperstructure_config"), layout: Introspect::<HyperstructureConfig>::layout(),
            },
            FieldLayout {
                selector: selector!("hyperstructure_cost_config"),
                layout: Introspect::<HyperstructureCostConfig>::layout(),
            },
            FieldLayout { selector: selector!("speed_config"), layout: Introspect::<SpeedConfig>::layout() },
            FieldLayout { selector: selector!("map_config"), layout: Introspect::<LegacyMapConfig>::layout() },
            FieldLayout { selector: selector!("tick_config"), layout: Introspect::<TickConfig>::layout() },
            FieldLayout {
                selector: selector!("structure_max_level_config"),
                layout: Introspect::<StructureMaxLevelConfig>::layout(),
            },
            FieldLayout { selector: selector!("building_config"), layout: Introspect::<BuildingConfig>::layout() },
            FieldLayout {
                selector: selector!("troop_damage_config"), layout: Introspect::<TroopDamageConfig>::layout(),
            },
            FieldLayout {
                selector: selector!("troop_stamina_config"), layout: Introspect::<TroopStaminaConfig>::layout(),
            },
            FieldLayout { selector: selector!("troop_limit_config"), layout: Introspect::<TroopLimitConfig>::layout() },
            FieldLayout { selector: selector!("capacity_config"), layout: Introspect::<CapacityConfig>::layout() },
            FieldLayout { selector: selector!("battle_config"), layout: Introspect::<BattleConfig>::layout() },
            FieldLayout { selector: selector!("bank_config"), layout: Introspect::<BankConfig>::layout() },
            FieldLayout { selector: selector!("trade_config"), layout: Introspect::<TradeConfig>::layout() },
            FieldLayout { selector: selector!("quest_config"), layout: Introspect::<LegacyQuestConfig>::layout() },
            FieldLayout { selector: selector!("faith_config"), layout: Introspect::<LegacyFaithConfig>::layout() },
            FieldLayout {
                selector: selector!("bitcoin_mine_config"), layout: Introspect::<BitcoinMineConfig>::layout(),
            },
            FieldLayout {
                selector: selector!("resource_bridge_config"), layout: Introspect::<ResourceBridgeConfig>::layout(),
            },
            FieldLayout {
                selector: selector!("res_bridge_fee_split_config"),
                layout: Introspect::<ResourceBridgeFeeSplitConfig>::layout(),
            },
            FieldLayout {
                selector: selector!("village_troop_config"), layout: Introspect::<VillageTroopConfig>::layout(),
            },
            FieldLayout {
                selector: selector!("quest_games"), layout: Introspect::<Span<LegacyPresetQuestGame>>::layout(),
            },
            FieldLayout {
                selector: selector!("realm_start_resources_config"),
                layout: Introspect::<StartingResourcesConfig>::layout(),
            },
            FieldLayout {
                selector: selector!("village_start_resources_config"),
                layout: Introspect::<StartingResourcesConfig>::layout(),
            },
            FieldLayout {
                selector: selector!("village_find_resources_config"),
                layout: Introspect::<VillageFoundResourcesConfig>::layout(),
            },
            FieldLayout {
                selector: selector!("structure_capacity_config"),
                layout: Introspect::<LegacyStructureCapacityConfig>::layout(),
            },
            FieldLayout {
                selector: selector!("victory_points_grant_config"),
                layout: Introspect::<VictoryPointsGrantConfig>::layout(),
            },
            FieldLayout {
                selector: selector!("victory_points_win_config"),
                layout: Introspect::<VictoryPointsWinConfig>::layout(),
            },
            FieldLayout {
                selector: selector!("blitz_exploration_config"), layout: Introspect::<BlitzExplorationConfig>::layout(),
            },
            FieldLayout { selector: selector!("artificer_config"), layout: Introspect::<ArtificerConfig>::layout() },
            FieldLayout {
                selector: selector!("blitz_registration_rules_config"),
                layout: Introspect::<BlitzRegistrationRulesConfig>::layout(),
            },
            FieldLayout { selector: selector!("mercenaries_name"), layout: Introspect::<felt252>::layout() },
            FieldLayout { selector: selector!("spire_travel_essence_cost"), layout: Introspect::<u128>::layout() },
        ]
            .span(),
    );
    assert_eq!(Model::<PresetConfig>::layout(), expected);
}

#[test]
fn reserved_quest_span_decodes_existing_nonempty_values_and_preserves_the_tail() {
    let mut data = array![1, 0x123, 2, 26, 3, 86400, 51, 1, 172800, 777].span();
    let games: Span<PresetQuestGame> = Serde::deserialize(ref data).unwrap();
    assert!(games.len() == 1 && games.at(0).levels.len() == 2, "legacy span dimensions changed");
    assert!(*games.at(0).levels.at(1).time_limit == 172800, "legacy level width changed");
    assert!(data == array![777].span(), "legacy quest span consumed the following field");
}

#[test]
fn reserved_quest_records_keep_the_deployed_type_names() {
    let level = Ty::Struct(
        Struct {
            name: 'Level',
            attrs: [].span(),
            children: array![
                Member { name: 'target_score', attrs: [].span(), ty: Introspect::<u32>::ty() },
                Member { name: 'settings_id', attrs: [].span(), ty: Introspect::<u32>::ty() },
                Member { name: 'time_limit', attrs: [].span(), ty: Introspect::<u64>::ty() },
            ]
                .span(),
        },
    );
    let game = Ty::Struct(
        Struct {
            name: 'PresetQuestGame',
            attrs: [].span(),
            children: array![
                Member { name: 'address', attrs: [].span(), ty: Introspect::<ContractAddress>::ty() },
                Member { name: 'levels', attrs: [].span(), ty: Ty::Array(array![level].span()) },
            ]
                .span(),
        },
    );
    assert_eq!(Introspect::<Span<PresetQuestGame>>::ty(), Ty::Array(array![game].span()));
}
