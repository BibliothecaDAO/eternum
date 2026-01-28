use crate::alias::ID;
use crate::models::position::Direction;
use crate::models::troop::{GuardSlot, TroopTier, TroopType};


#[starknet::interface]
pub trait ITroopManagementSystems<TContractState> {
    // guard
    fn guard_add(
        ref self: TContractState,
        for_structure_id: ID,
        slot: GuardSlot,
        category: TroopType,
        tier: TroopTier,
        amount: u128,
    );
    fn guard_delete(ref self: TContractState, for_structure_id: ID, slot: GuardSlot);

    // explorer
    fn explorer_create(
        ref self: TContractState,
        for_structure_id: ID,
        category: TroopType,
        tier: TroopTier,
        amount: u128,
        spawn_direction: Direction,
    ) -> ID;
    fn explorer_add(ref self: TContractState, to_explorer_id: ID, amount: u128, home_direction: Direction);
    fn explorer_delete(ref self: TContractState, explorer_id: ID);

    // troop swap
    fn explorer_explorer_swap(
        ref self: TContractState,
        from_explorer_id: ID,
        to_explorer_id: ID,
        to_explorer_direction: Direction,
        count: u128,
    );
    fn explorer_guard_swap(
        ref self: TContractState,
        from_explorer_id: ID,
        to_structure_id: ID,
        to_structure_direction: Direction,
        to_guard_slot: GuardSlot,
        count: u128,
    );

    fn guard_explorer_swap(
        ref self: TContractState,
        from_structure_id: ID,
        from_guard_slot: GuardSlot,
        to_explorer_id: ID,
        to_explorer_direction: Direction,
        count: u128,
    );
}


#[dojo::contract]
pub mod troop_management_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorageTrait};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, RESOURCE_PRECISION};
    use crate::models::config::{
        CombatConfigImpl, SeasonConfigImpl, TickImpl, TickTrait, TroopLimitConfig, TroopStaminaConfig,
        WorldConfigUtilImpl,
    };
    use crate::models::events::{
        ExplorerAddStory, ExplorerCreateStory, ExplorerDeleteStory, ExplorerExplorerSwapStory, ExplorerGuardSwapStory,
        GuardAddStory, GuardDeleteStory, GuardExplorerSwapStory, Story, StoryEvent,
    };
    use crate::models::map::{Tile, TileImpl};
    use crate::models::map2::TileOpt;
    use crate::models::owner::OwnerAddressTrait;
    use crate::models::position::{Coord, CoordTrait, Direction, TravelTrait};
    use crate::models::resource::resource::{
        ResourceImpl, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, StructureSingleResourceFoodImpl,
        WeightStoreImpl,
    };
    use crate::models::stamina::{StaminaImpl, StaminaTrait};
    use crate::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureOwnerStoreImpl,
        StructureTroopExplorerStoreImpl, StructureTroopGuardStoreImpl,
    };
    use crate::models::troop::{
        ExplorerTroops, GuardImpl, GuardSlot, GuardTrait, GuardTroops, TroopTier, TroopType, Troops,
    };
    use crate::systems::utils::map::IMapImpl;
    use crate::systems::utils::mine::iMineDiscoveryImpl;
    use crate::systems::utils::troop::{iExplorerImpl, iGuardImpl, iTroopImpl};
    use super::ITroopManagementSystems;

    #[abi(embed_v0)]
    impl TroopManagementSystemsImpl of ITroopManagementSystems<ContractState> {
        fn guard_add(
            ref self: ContractState,
            for_structure_id: ID,
            slot: GuardSlot,
            category: TroopType,
            tier: TroopTier,
            amount: u128,
        ) {
            assert!(amount.is_non_zero(), "amount must be greater than 0");

            let mut world = self.world(DEFAULT_NS());
            // ensure caller owns structure or is realms_systems
            let (realms_systems_address, _) = world.dns(@"realm_internal_systems").unwrap();
            let (village_systems_address, _) = world.dns(@"village_systems").unwrap();
            let caller_address: starknet::ContractAddress = starknet::get_caller_address();
            if caller_address != realms_systems_address && caller_address != village_systems_address {
                // ensure season is open
                SeasonConfigImpl::get(world).assert_started_and_not_over();
                StructureOwnerStoreImpl::retrieve(ref world, for_structure_id).assert_caller_owner();
            }

            // deduct resources used to create guard
            iTroopImpl::make_payment(ref world, for_structure_id, amount, category, tier);

            // ensure provided category and tier are correct
            let mut guards: GuardTroops = StructureTroopGuardStoreImpl::retrieve(ref world, for_structure_id);
            let (mut troops, troops_destroyed_tick): (Troops, u32) = guards.from_slot(slot);
            if troops.count.is_non_zero() {
                assert!(troops.category == category && troops.tier == tier, "incorrect category or tier");
            }

            let mut structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, for_structure_id);
            let tick = TickImpl::get_tick_interval(ref world);
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            iGuardImpl::add(
                ref world,
                for_structure_id,
                ref structure_base,
                ref guards,
                ref troops,
                slot,
                category,
                tier,
                troops_destroyed_tick,
                amount,
                tick,
                troop_limit_config,
                troop_stamina_config,
                true,
            );

            StructureTroopGuardStoreImpl::store(ref guards, ref world, for_structure_id);
            StructureBaseStoreImpl::store(ref structure_base, ref world, for_structure_id);

            // emit event
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, for_structure_id);
            world
                .emit_event(
                    @StoryEvent {
                        id: world.dispatcher.uuid(),
                        owner: Option::Some(structure_owner),
                        entity_id: Option::Some(for_structure_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::GuardAddStory(
                            GuardAddStory {
                                structure_id: for_structure_id,
                                slot: slot.into(),
                                category: category.into(),
                                tier: tier.into(),
                                amount,
                            },
                        ),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }


        fn guard_delete(ref self: ContractState, for_structure_id: ID, slot: GuardSlot) {
            let mut world = self.world(DEFAULT_NS());
            // ensure season is open
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns structure
            StructureOwnerStoreImpl::retrieve(ref world, for_structure_id).assert_caller_owner();

            let tick = TickImpl::get_tick_interval(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();

            // delete guard
            let mut guards: GuardTroops = StructureTroopGuardStoreImpl::retrieve(ref world, for_structure_id);
            let (mut troops, troops_destroyed_tick): (Troops, u32) = guards.from_slot(slot);

            // Only proceed if the slot actually has troops to delete
            if troops.count.is_non_zero() {
                let mut structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, for_structure_id);
                iGuardImpl::delete(
                    ref world,
                    for_structure_id,
                    ref structure_base,
                    ref guards,
                    ref troops,
                    troops_destroyed_tick,
                    slot,
                    current_tick,
                );

                // emit event
                let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, for_structure_id);
                world
                    .emit_event(
                        @StoryEvent {
                            id: world.dispatcher.uuid(),
                            owner: Option::Some(structure_owner),
                            entity_id: Option::Some(for_structure_id),
                            tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                            story: Story::GuardDeleteStory(
                                GuardDeleteStory { structure_id: for_structure_id, slot: slot.into() },
                            ),
                            timestamp: starknet::get_block_timestamp(),
                        },
                    );
            } else {
                panic!("guard_delete: No troops in specified slot");
            }
        }

        fn explorer_create(
            ref self: ContractState,
            for_structure_id: ID,
            category: TroopType,
            tier: TroopTier,
            amount: u128,
            spawn_direction: Direction,
        ) -> ID {
            let mut world = self.world(DEFAULT_NS());
            // ensure season is open
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns structure
            StructureOwnerStoreImpl::retrieve(ref world, for_structure_id).assert_caller_owner();

            // deduct resources used to create explorer
            iTroopImpl::make_payment(ref world, for_structure_id, amount, category, tier);

            // ensure structure has not reached itslimit of troops
            let mut structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, for_structure_id);
            assert!(
                structure.troop_explorer_count < structure.troop_max_explorer_count.into(),
                "reached limit of troops for your structure",
            );

            // ensure structure has not reached hard limit of explorers for all structures
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            assert!(
                structure.troop_explorer_count < troop_limit_config.explorer_max_party_count.into(),
                "reached limit of troops per structure",
            );

            // create explorer
            let mut explorer_id: ID = world.dispatcher.uuid();

            // add explorer count to structure
            let mut explorers: Array<ID> = StructureTroopExplorerStoreImpl::retrieve(ref world, for_structure_id)
                .into();
            explorers.append(explorer_id);
            StructureTroopExplorerStoreImpl::store(explorers.span(), ref world, for_structure_id);

            structure.troop_explorer_count += 1;
            StructureBaseStoreImpl::store(ref structure, ref world, for_structure_id);

            // ensure spawn location is not occupied
            let spawn_coord: Coord = structure.coord().neighbor(spawn_direction);
            let tile_opt: TileOpt = world.read_model((spawn_coord.alt, spawn_coord.x, spawn_coord.y));
            let mut tile: Tile = tile_opt.into();
            assert!(tile.not_occupied(), "explorer spawn location is occupied");

            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            let tick = TickImpl::get_tick_interval(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();
            iExplorerImpl::create(
                ref world,
                ref tile,
                explorer_id,
                for_structure_id,
                category,
                tier,
                amount,
                troop_stamina_config,
                troop_limit_config,
                current_tick,
            );

            // emit event
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, for_structure_id);
            world
                .emit_event(
                    @StoryEvent {
                        id: world.dispatcher.uuid(),
                        owner: Option::Some(structure_owner),
                        entity_id: Option::Some(explorer_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::ExplorerCreateStory(
                            ExplorerCreateStory {
                                structure_id: for_structure_id,
                                explorer_id,
                                category: category.into(),
                                tier: tier.into(),
                                amount,
                                spawn_direction: spawn_direction.into(),
                            },
                        ),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );

            explorer_id
        }

        fn explorer_add(ref self: ContractState, to_explorer_id: ID, amount: u128, home_direction: Direction) {
            assert!(amount.is_non_zero(), "amount must be greater than 0");
            assert!(amount % RESOURCE_PRECISION == 0, "amount must be divisible by resource precision");

            let mut world = self.world(DEFAULT_NS());
            // ensure season is open
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns explorer
            let mut explorer: ExplorerTroops = world.read_model(to_explorer_id);
            StructureOwnerStoreImpl::retrieve(ref world, explorer.owner).assert_caller_owner();

            // ensure explorer is adjacent to home structure
            let explorer_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, explorer.owner);
            assert!(
                explorer.coord.is_adjacent(explorer_owner_structure.coord()), "explorer not adjacent to home structure",
            );

            // deduct resources used to create explorer
            iTroopImpl::make_payment(ref world, explorer.owner, amount, explorer.troops.category, explorer.troops.tier);

            // add troops to explorer
            explorer.troops.count += amount;

            // reintialize troop stamina
            let tick = TickImpl::get_tick_interval(ref world);
            let current_tick: u64 = tick.current();
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            explorer
                .troops
                .stamina
                .refill(
                    ref explorer.troops.boosts,
                    explorer.troops.category,
                    explorer.troops.tier,
                    troop_stamina_config,
                    current_tick,
                );

            explorer.troops.stamina.revert_initial_amount(troop_stamina_config, current_tick);

            // update explorer model
            world.write_model(@explorer);

            // update troop capacity
            iExplorerImpl::update_capacity(ref world, to_explorer_id, amount, true);

            // ensure explorer count does not exceed max count
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            assert!(
                explorer.troops.count <= troop_limit_config.explorer_guard_max_troop_count.into() * RESOURCE_PRECISION,
                "reached limit of explorers amount per army",
            );

            // emit event
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, explorer.owner);
            world
                .emit_event(
                    @StoryEvent {
                        id: world.dispatcher.uuid(),
                        owner: Option::Some(structure_owner),
                        entity_id: Option::Some(to_explorer_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::ExplorerAddStory(
                            ExplorerAddStory {
                                explorer_id: to_explorer_id, amount, home_direction: home_direction.into(),
                            },
                        ),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }


        fn explorer_delete(ref self: ContractState, explorer_id: ID) {
            let mut world = self.world(DEFAULT_NS());
            // ensure season is open
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns explorer
            let mut explorer: ExplorerTroops = world.read_model(explorer_id);
            StructureOwnerStoreImpl::retrieve(ref world, explorer.owner).assert_caller_owner();

            let mut explorer_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                ref world, explorer.owner,
            );

            // delete explorer
            let mut explorer_owner_structure_explorers_list: Array<ID> = StructureTroopExplorerStoreImpl::retrieve(
                ref world, explorer.owner,
            )
                .into();

            // ensure explorer is not dead
            assert!(explorer.troops.count.is_non_zero(), "explorer is dead");

            // set explorer count to 0
            explorer.troops.count = 0;
            iExplorerImpl::explorer_from_structure_delete(
                ref world,
                ref explorer,
                explorer_owner_structure_explorers_list,
                ref explorer_owner_structure,
                explorer.owner,
            );

            // emit event
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, explorer.owner);
            world
                .emit_event(
                    @StoryEvent {
                        id: world.dispatcher.uuid(),
                        owner: Option::Some(structure_owner),
                        entity_id: Option::Some(explorer_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::ExplorerDeleteStory(ExplorerDeleteStory { explorer_id }),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }


        fn explorer_explorer_swap(
            ref self: ContractState,
            from_explorer_id: ID,
            to_explorer_id: ID,
            to_explorer_direction: Direction,
            count: u128,
        ) {
            assert!(count.is_non_zero(), "count must be greater than 0");
            assert!(count % RESOURCE_PRECISION == 0, "count must be divisible by resource precision");

            let mut world = self.world(DEFAULT_NS());
            // ensure season is open
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller address owns both explorers
            // (not necessarily the same structure)
            let mut from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
            let mut to_explorer: ExplorerTroops = world.read_model(to_explorer_id);

            // ensure caller owns both explorers
            let from_structure_owner = StructureOwnerStoreImpl::retrieve(ref world, from_explorer.owner);
            let to_structure_owner = StructureOwnerStoreImpl::retrieve(ref world, to_explorer.owner);
            from_structure_owner.assert_caller_owner();
            to_structure_owner.assert_caller_owner();

            StructureOwnerStoreImpl::retrieve(ref world, from_explorer.owner).assert_caller_owner();

            // ensure explorers are adjacent to one another
            assert!(
                from_explorer.coord.is_adjacent(to_explorer.coord), "to explorer is not adjacent to source explorer",
            );

            // ensure count is valid
            assert!(count <= from_explorer.troops.count, "insufficient troops in source explorer");

            // ensure both explorers have are not dead
            assert!(from_explorer.troops.count.is_non_zero(), "from explorer has no troops");
            assert!(to_explorer.troops.count.is_non_zero(), "to explorer has no troops");

            // ensure they have the same category and tier
            assert!(
                from_explorer.troops.category == to_explorer.troops.category,
                "from explorer and to explorer have different categories",
            );
            assert!(
                from_explorer.troops.tier == to_explorer.troops.tier,
                "from explorer and to explorer have different tiers",
            );

            // update troops
            from_explorer.troops.count -= count;
            to_explorer.troops.count += count;

            // update troop capacity
            iExplorerImpl::update_capacity(ref world, from_explorer_id, count, false);
            iExplorerImpl::update_capacity(ref world, to_explorer_id, count, true);

            // ensure from_explorer is not overweight
            iExplorerImpl::ensure_not_overweight(ref world, from_explorer_id);

            // ensure to_explorer count does not exceed max count
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            assert!(
                to_explorer.troops.count <= troop_limit_config.explorer_guard_max_troop_count.into()
                    * RESOURCE_PRECISION,
                "reached limit of explorers amount per army",
            );

            // get current tick
            let tick = TickImpl::get_tick_interval(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();

            // ensure there is no stamina advantage gained by swapping
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            from_explorer
                .troops
                .stamina
                .refill(
                    ref from_explorer.troops.boosts,
                    from_explorer.troops.category,
                    from_explorer.troops.tier,
                    troop_stamina_config,
                    current_tick,
                );
            to_explorer
                .troops
                .stamina
                .refill(
                    ref to_explorer.troops.boosts,
                    to_explorer.troops.category,
                    to_explorer.troops.tier,
                    troop_stamina_config,
                    current_tick,
                );
            if from_explorer.troops.stamina.amount < to_explorer.troops.stamina.amount {
                to_explorer.troops.stamina.amount = from_explorer.troops.stamina.amount;
                to_explorer.troops.stamina.updated_tick = current_tick;
            }

            // ensure there is no battle timer gain by swapping
            if from_explorer.troops.battle_cooldown_end > to_explorer.troops.battle_cooldown_end {
                to_explorer.troops.battle_cooldown_end = from_explorer.troops.battle_cooldown_end;
            }

            // update from_explorer model
            if from_explorer.troops.count.is_zero() {
                // delete from_explorer if count is 0
                let mut explorer_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                    ref world, from_explorer.owner,
                );

                let mut explorer_owner_structure_explorers_list: Array<ID> = StructureTroopExplorerStoreImpl::retrieve(
                    ref world, from_explorer.owner,
                )
                    .into();
                iExplorerImpl::explorer_from_structure_delete(
                    ref world,
                    ref from_explorer,
                    explorer_owner_structure_explorers_list,
                    ref explorer_owner_structure,
                    from_explorer.owner,
                );
            } else {
                world.write_model(@from_explorer);
            }

            // update to_explorer model
            world.write_model(@to_explorer);

            // emit event
            let from_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, from_explorer.owner);
            world
                .emit_event(
                    @StoryEvent {
                        id: world.dispatcher.uuid(),
                        owner: Option::Some(from_owner),
                        entity_id: Option::Some(from_explorer_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::ExplorerExplorerSwapStory(
                            ExplorerExplorerSwapStory {
                                from_explorer_id,
                                to_explorer_id,
                                to_explorer_direction: to_explorer_direction.into(),
                                count,
                            },
                        ),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }


        fn explorer_guard_swap(
            ref self: ContractState,
            from_explorer_id: ID,
            to_structure_id: ID,
            to_structure_direction: Direction,
            to_guard_slot: GuardSlot,
            count: u128,
        ) {
            assert!(count.is_non_zero(), "count must be greater than 0");
            assert!(count % RESOURCE_PRECISION == 0, "count must be divisible by resource precision");

            let mut world = self.world(DEFAULT_NS());
            // ensure season is open
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns explorer
            let mut from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
            StructureOwnerStoreImpl::retrieve(ref world, from_explorer.owner).assert_caller_owner();

            // ensure caller address structure
            StructureOwnerStoreImpl::retrieve(ref world, to_structure_id).assert_caller_owner();

            // ensure explorer is adjacent to structure
            let mut to_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, to_structure_id);
            assert!(
                from_explorer.coord.is_adjacent(to_structure_base.coord()), "explorer is not adjacent to structure",
            );

            // ensure count is valid
            assert!(count <= from_explorer.troops.count, "insufficient troops in explorer");

            // ensure explorer is not dead
            assert!(from_explorer.troops.count.is_non_zero(), "from explorer has no troops");

            // note: we don't need to check if the guard is dead. if it is,
            // it will inherit the category and tier of the explorer

            // ensure they have the same category and tier
            let mut to_structure_guards: GuardTroops = StructureTroopGuardStoreImpl::retrieve(
                ref world, to_structure_id,
            );
            let (mut to_structure_troops, to_structure_troops_destroyed_tick): (Troops, u32) = to_structure_guards
                .from_slot(to_guard_slot);
            if to_structure_troops.count.is_non_zero() {
                assert!(
                    from_explorer.troops.category == to_structure_troops.category,
                    "from explorer and structure guard have different categories",
                );
                assert!(
                    from_explorer.troops.tier == to_structure_troops.tier,
                    "from explorer and structure guard have different tiers",
                );
            }

            /////////// Update Explorer ///////////
            ///////////////////////////////////////

            // update explorer troop counts
            from_explorer.troops.count -= count;

            // update explorer troop capacity
            iExplorerImpl::update_capacity(ref world, from_explorer_id, count, false);

            // update explorer stamina
            let tick = TickImpl::get_tick_interval(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            from_explorer
                .troops
                .stamina
                .refill(
                    ref from_explorer.troops.boosts,
                    from_explorer.troops.category,
                    from_explorer.troops.tier,
                    troop_stamina_config,
                    current_tick,
                );

            // update explorer model
            if from_explorer.troops.count.is_zero() {
                // delete from_explorer if count is 0
                let mut explorer_owner_structure: StructureBase = StructureBaseStoreImpl::retrieve(
                    ref world, from_explorer.owner,
                );

                let mut explorer_owner_structure_explorers_list: Array<ID> = StructureTroopExplorerStoreImpl::retrieve(
                    ref world, from_explorer.owner,
                )
                    .into();
                iExplorerImpl::explorer_from_structure_delete(
                    ref world,
                    ref from_explorer,
                    explorer_owner_structure_explorers_list,
                    ref explorer_owner_structure,
                    from_explorer.owner,
                );
            } else {
                world.write_model(@from_explorer);
            }

            /////////// Update Structure Guard ///////////
            /////////////////////////////////////////////

            // ensure there is no stamina advantage gained by swapping
            to_structure_troops
                .stamina
                .refill(
                    ref to_structure_troops.boosts,
                    to_structure_troops.category,
                    to_structure_troops.tier,
                    troop_stamina_config,
                    current_tick,
                );
            if from_explorer.troops.stamina.amount < to_structure_troops.stamina.amount {
                to_structure_troops.stamina.amount = from_explorer.troops.stamina.amount;
                to_structure_troops.stamina.updated_tick = current_tick;
            }

            // ensure there is no battle timer gain by swapping
            if from_explorer.troops.battle_cooldown_end > to_structure_troops.battle_cooldown_end {
                to_structure_troops.battle_cooldown_end = from_explorer.troops.battle_cooldown_end;
            }

            // add troops to structure guard
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            iGuardImpl::add(
                ref world,
                to_structure_id,
                ref to_structure_base,
                ref to_structure_guards,
                ref to_structure_troops,
                to_guard_slot,
                from_explorer.troops.category,
                from_explorer.troops.tier,
                to_structure_troops_destroyed_tick,
                count,
                tick,
                troop_limit_config,
                troop_stamina_config,
                false,
            );
            StructureTroopGuardStoreImpl::store(ref to_structure_guards, ref world, to_structure_id);
            StructureBaseStoreImpl::store(ref to_structure_base, ref world, to_structure_id);

            // emit event
            let from_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, from_explorer.owner);
            world
                .emit_event(
                    @StoryEvent {
                        id: world.dispatcher.uuid(),
                        owner: Option::Some(from_owner),
                        entity_id: Option::Some(from_explorer_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::ExplorerGuardSwapStory(
                            ExplorerGuardSwapStory {
                                from_explorer_id,
                                to_structure_id,
                                to_structure_direction: to_structure_direction.into(),
                                to_guard_slot: to_guard_slot.into(),
                                count,
                            },
                        ),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }


        fn guard_explorer_swap(
            ref self: ContractState,
            from_structure_id: ID,
            from_guard_slot: GuardSlot,
            to_explorer_id: ID,
            to_explorer_direction: Direction,
            count: u128,
        ) {
            assert!(count.is_non_zero(), "count must be greater than 0");
            assert!(count % RESOURCE_PRECISION == 0, "count must be divisible by resource precision");

            let mut world = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns explorer
            let mut to_explorer: ExplorerTroops = world.read_model(to_explorer_id);
            StructureOwnerStoreImpl::retrieve(ref world, to_explorer.owner).assert_caller_owner();

            // ensure caller address owns structure
            StructureOwnerStoreImpl::retrieve(ref world, from_structure_id).assert_caller_owner();

            // ensure structure is adjacent to explorer
            let mut from_structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, from_structure_id);
            assert!(
                from_structure_base.coord().is_adjacent(to_explorer.coord), "structure is not adjacent to explorer",
            );

            // ensure count is less than or equal to structure guard count
            let mut from_structure_guards: GuardTroops = StructureTroopGuardStoreImpl::retrieve(
                ref world, from_structure_id,
            );
            let (mut from_structure_troops, from_structure_troops_destroyed_tick): (Troops, u32) = from_structure_guards
                .from_slot(from_guard_slot);

            // ensure guard is not dead
            assert!(from_structure_troops.count.is_non_zero(), "structure guard is dead");
            assert!(count <= from_structure_troops.count, "insufficient troops in structure");

            // ensure explorer is not dead
            assert!(to_explorer.troops.count.is_non_zero(), "explorer has no troops");

            // ensure they have the same category and tier
            assert!(
                to_explorer.troops.category == from_structure_troops.category,
                "explorer and structure guard have different categories",
            );
            assert!(
                to_explorer.troops.tier == from_structure_troops.tier,
                "explorer and structure guard have different tiers",
            );

            // update troop counts
            to_explorer.troops.count += count;
            from_structure_troops.count -= count;

            // update explorer troop capacity
            iExplorerImpl::update_capacity(ref world, to_explorer_id, count, true);

            // ensure to_explorer count does not exceed max count
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            assert!(
                to_explorer.troops.count <= troop_limit_config.explorer_guard_max_troop_count.into()
                    * RESOURCE_PRECISION,
                "reached limit of explorer troop count",
            );

            // get current tick
            let tick = TickImpl::get_tick_interval(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();

            // ensure there is no stamina advantage gained by swapping
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            to_explorer
                .troops
                .stamina
                .refill(
                    ref to_explorer.troops.boosts,
                    to_explorer.troops.category,
                    to_explorer.troops.tier,
                    troop_stamina_config,
                    current_tick,
                );
            from_structure_troops
                .stamina
                .refill(
                    ref from_structure_troops.boosts,
                    from_structure_troops.category,
                    from_structure_troops.tier,
                    troop_stamina_config,
                    current_tick,
                );
            if from_structure_troops.stamina.amount < to_explorer.troops.stamina.amount {
                to_explorer.troops.stamina.amount = from_structure_troops.stamina.amount;
                to_explorer.troops.stamina.updated_tick = current_tick;
            }

            // ensure there is no battle timer gain by swapping
            if from_structure_troops.battle_cooldown_end > to_explorer.troops.battle_cooldown_end {
                to_explorer.troops.battle_cooldown_end = from_structure_troops.battle_cooldown_end;
            }

            // update to_explorer model
            world.write_model(@to_explorer);

            // update structure guard model
            if from_structure_troops.count.is_zero() {
                // delete guard if count is 0
                iGuardImpl::delete(
                    ref world,
                    from_structure_id,
                    ref from_structure_base,
                    ref from_structure_guards,
                    ref from_structure_troops,
                    from_structure_troops_destroyed_tick,
                    from_guard_slot,
                    current_tick,
                );
            } else {
                from_structure_guards
                    .to_slot(
                        from_guard_slot,
                        from_structure_troops,
                        from_structure_troops_destroyed_tick.try_into().unwrap(),
                    );
                StructureTroopGuardStoreImpl::store(ref from_structure_guards, ref world, from_structure_id);
            }

            // emit event
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, from_structure_id);
            world
                .emit_event(
                    @StoryEvent {
                        id: world.dispatcher.uuid(),
                        owner: Option::Some(structure_owner),
                        entity_id: Option::Some(from_structure_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::GuardExplorerSwapStory(
                            GuardExplorerSwapStory {
                                from_structure_id,
                                from_guard_slot: from_guard_slot.into(),
                                to_explorer_id,
                                to_explorer_direction: to_explorer_direction.into(),
                                count,
                            },
                        ),
                        timestamp: starknet::get_block_timestamp(),
                    },
                );
        }
    }
}
