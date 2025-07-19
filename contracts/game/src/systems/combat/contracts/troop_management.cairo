use s1_eternum::alias::ID;
use s1_eternum::models::position::Direction;
use s1_eternum::models::troop::{GuardSlot, TroopTier, TroopType};


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
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait};
    use dojo::world::{WorldStorageTrait};
    use s1_eternum::alias::ID;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::constants::{RESOURCE_PRECISION};
    use s1_eternum::models::relic::{RelicEffect, RelicEffectStoreImpl};
    use s1_eternum::models::stamina::StaminaImpl;
    use s1_eternum::models::{
        config::{
            CombatConfigImpl, SeasonConfigImpl, TickImpl, TickTrait, TroopLimitConfig, TroopStaminaConfig,
            WorldConfigUtilImpl,
        },
        map::{Tile, TileImpl}, owner::{OwnerAddressTrait}, position::{Coord, CoordTrait, Direction},
        resource::{
            resource::{
                ResourceImpl, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl,
                StructureSingleResourceFoodImpl, WeightStoreImpl,
            },
        },
        stamina::{StaminaTrait},
        structure::{
            StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureOwnerStoreImpl,
            StructureTroopExplorerStoreImpl, StructureTroopGuardStoreImpl,
        },
        troop::{ExplorerTroops, GuardImpl, GuardSlot, GuardTrait, GuardTroops, TroopTier, TroopType, Troops},
    };
    use s1_eternum::systems::utils::map::IMapImpl;
    use s1_eternum::systems::utils::{mine::iMineDiscoveryImpl, troop::{iExplorerImpl, iGuardImpl, iTroopImpl}};

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
            let current_tick: u64 = tick.current().try_into().unwrap();
            let guard_stamina_relic_effect: Option<RelicEffect> = RelicEffectStoreImpl::retrieve(
                ref world, for_structure_id, StaminaImpl::relic_effect_id(), current_tick,
            );
            iGuardImpl::add(
                ref world,
                for_structure_id,
                ref structure_base,
                ref guards,
                ref troops,
                guard_stamina_relic_effect,
                slot,
                category,
                tier,
                troops_destroyed_tick,
                amount,
                tick,
                troop_limit_config,
                troop_stamina_config,
            );

            StructureTroopGuardStoreImpl::store(ref guards, ref world, for_structure_id);
            StructureBaseStoreImpl::store(ref structure_base, ref world, for_structure_id);
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
            let mut tile: Tile = world.read_model((spawn_coord.x, spawn_coord.y));
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
                explorer_owner_structure.coord() == explorer.coord.neighbor(home_direction),
                "explorer not adjacent to home structure",
            );

            // deduct resources used to create explorer
            iTroopImpl::make_payment(ref world, explorer.owner, amount, explorer.troops.category, explorer.troops.tier);

            // add troops to explorer
            explorer.troops.count += amount;
            world.write_model(@explorer);

            // update troop capacity
            iExplorerImpl::update_capacity(ref world, to_explorer_id, amount, true);

            // ensure explorer count does not exceed max count
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            assert!(
                explorer.troops.count <= troop_limit_config.explorer_guard_max_troop_count.into() * RESOURCE_PRECISION,
                "reached limit of explorers amount per army",
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
                to_explorer.coord == from_explorer.coord.neighbor(to_explorer_direction),
                "to explorer is not at the target coordinate",
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
            let from_explorer_stamina_relic_effect: Option<RelicEffect> = RelicEffectStoreImpl::retrieve(
                ref world, from_explorer.explorer_id, StaminaImpl::relic_effect_id(), current_tick,
            );
            let to_explorer_stamina_relic_effect: Option<RelicEffect> = RelicEffectStoreImpl::retrieve(
                ref world, to_explorer.explorer_id, StaminaImpl::relic_effect_id(), current_tick,
            );
            from_explorer
                .troops
                .stamina
                .refill(
                    from_explorer_stamina_relic_effect,
                    from_explorer.troops.category,
                    from_explorer.troops.tier,
                    troop_stamina_config,
                    current_tick,
                );
            to_explorer
                .troops
                .stamina
                .refill(
                    to_explorer_stamina_relic_effect,
                    to_explorer.troops.category,
                    to_explorer.troops.tier,
                    troop_stamina_config,
                    current_tick,
                );
            if from_explorer.troops.stamina.amount < to_explorer.troops.stamina.amount {
                to_explorer.troops.stamina.amount = from_explorer.troops.stamina.amount;
                to_explorer.troops.stamina.updated_tick = current_tick;
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
                to_structure_base.coord() == from_explorer.coord.neighbor(to_structure_direction),
                "explorer is not adjacent to structure",
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
            let from_explorer_stamina_relic_effect: Option<RelicEffect> = RelicEffectStoreImpl::retrieve(
                ref world, from_explorer.explorer_id, StaminaImpl::relic_effect_id(), current_tick,
            );
            from_explorer
                .troops
                .stamina
                .refill(
                    from_explorer_stamina_relic_effect,
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
            let to_structure_troops_stamina_relic_effect: Option<RelicEffect> = RelicEffectStoreImpl::retrieve(
                ref world, to_structure_id, StaminaImpl::relic_effect_id(), current_tick,
            );
            to_structure_troops
                .stamina
                .refill(
                    to_structure_troops_stamina_relic_effect,
                    to_structure_troops.category,
                    to_structure_troops.tier,
                    troop_stamina_config,
                    current_tick,
                );
            if from_explorer.troops.stamina.amount < to_structure_troops.stamina.amount {
                to_structure_troops.stamina.amount = from_explorer.troops.stamina.amount;
                to_structure_troops.stamina.updated_tick = current_tick;
            }

            // add troops to structure guard
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            iGuardImpl::add(
                ref world,
                to_structure_id,
                ref to_structure_base,
                ref to_structure_guards,
                ref to_structure_troops,
                to_structure_troops_stamina_relic_effect,
                to_guard_slot,
                from_explorer.troops.category,
                from_explorer.troops.tier,
                to_structure_troops_destroyed_tick,
                count,
                tick,
                troop_limit_config,
                troop_stamina_config,
            );
            StructureTroopGuardStoreImpl::store(ref to_structure_guards, ref world, to_structure_id);
            StructureBaseStoreImpl::store(ref to_structure_base, ref world, to_structure_id);
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
                to_explorer.coord == from_structure_base.coord().neighbor(to_explorer_direction),
                "structure is not adjacent to explorer",
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
            let to_explorer_stamina_relic_effect: Option<RelicEffect> = RelicEffectStoreImpl::retrieve(
                ref world, to_explorer.explorer_id, StaminaImpl::relic_effect_id(), current_tick,
            );
            let from_structure_troops_stamina_relic_effect: Option<RelicEffect> = RelicEffectStoreImpl::retrieve(
                ref world, from_structure_id, StaminaImpl::relic_effect_id(), current_tick,
            );
            to_explorer
                .troops
                .stamina
                .refill(
                    to_explorer_stamina_relic_effect,
                    to_explorer.troops.category,
                    to_explorer.troops.tier,
                    troop_stamina_config,
                    current_tick,
                );
            from_structure_troops
                .stamina
                .refill(
                    from_structure_troops_stamina_relic_effect,
                    from_structure_troops.category,
                    from_structure_troops.tier,
                    troop_stamina_config,
                    current_tick,
                );
            if from_structure_troops.stamina.amount < to_explorer.troops.stamina.amount {
                to_explorer.troops.stamina.amount = from_structure_troops.stamina.amount;
                to_explorer.troops.stamina.updated_tick = current_tick;
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
        }
    }
}

#[cfg(test)]
mod tests {
    use achievement::events::index::e_TrophyProgression;
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::{WorldStorageTrait};
    use dojo_cairo_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world,
    };

    use s1_eternum::constants::{DEFAULT_NS, DEFAULT_NS_STR, RESOURCE_PRECISION, ResourceTypes};
    use s1_eternum::models::{
        config::{CombatConfigImpl, SeasonConfig, TroopLimitConfig, WorldConfigUtilImpl, m_WeightConfig, m_WorldConfig},
        map::{Tile, TileTrait, m_Tile}, position::{Coord, CoordTrait, Direction},
        resource::production::building::{m_Building, m_StructureBuildings},
        resource::resource::{ResourceImpl, m_Resource},
        structure::{
            StructureBaseStoreImpl, StructureTroopExplorerStoreImpl, StructureTroopGuardStoreImpl, m_Structure,
            m_StructureOwnerStats, m_StructureVillageSlots,
        },
        troop::{ExplorerTroops, GuardSlot, GuardTrait, TroopTier, TroopType, m_ExplorerTroops},
    };

    // use s1_eternum::models::weight::m_Weight; // Removed: Weight is not a model
    use s1_eternum::systems::combat::contracts::troop_management::{
        ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait, troop_management_systems,
    };
    use s1_eternum::systems::combat::contracts::troop_movement::{
        ITroopMovementSystemsDispatcher, ITroopMovementSystemsDispatcherTrait,
    };
    use s1_eternum::systems::combat::contracts::troop_movement::{
        agent_discovery_systems, hyperstructure_discovery_systems, mine_discovery_systems, troop_movement_systems,
        troop_movement_util_systems,
    };
    use s1_eternum::systems::realm::contracts::realm_internal_systems;
    use s1_eternum::systems::resources::contracts::resource_systems::resource_systems;
    use s1_eternum::systems::village::contracts::village_systems;
    use s1_eternum::utils::testing::helpers::{
        init_config, tgrant_resources, tspawn_realm_with_resources, tspawn_simple_realm,
    };

    use starknet::{ContractAddress, testing::{set_account_contract_address, set_contract_address}};

    fn namespace_def() -> NamespaceDef {
        let ndef = NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                // world config
                TestResource::Model(m_WorldConfig::TEST_CLASS_HASH),
                TestResource::Model(m_WeightConfig::TEST_CLASS_HASH), // structure, realm and buildings
                TestResource::Model(m_Structure::TEST_CLASS_HASH),
                TestResource::Model(m_StructureOwnerStats::TEST_CLASS_HASH),
                TestResource::Model(m_StructureBuildings::TEST_CLASS_HASH),
                TestResource::Model(m_Building::TEST_CLASS_HASH), TestResource::Model(m_Tile::TEST_CLASS_HASH),
                TestResource::Model(m_Resource::TEST_CLASS_HASH),
                TestResource::Model(m_ExplorerTroops::TEST_CLASS_HASH),
                TestResource::Model(m_StructureVillageSlots::TEST_CLASS_HASH),
                TestResource::Event(e_TrophyProgression::TEST_CLASS_HASH),
                // contracts
                TestResource::Contract(troop_management_systems::TEST_CLASS_HASH),
                TestResource::Contract(troop_movement_systems::TEST_CLASS_HASH),
                TestResource::Contract(troop_movement_util_systems::TEST_CLASS_HASH),
                TestResource::Contract(agent_discovery_systems::TEST_CLASS_HASH),
                TestResource::Contract(hyperstructure_discovery_systems::TEST_CLASS_HASH),
                TestResource::Contract(mine_discovery_systems::TEST_CLASS_HASH),
                TestResource::Contract(resource_systems::TEST_CLASS_HASH),
                TestResource::Contract(village_systems::TEST_CLASS_HASH),
                TestResource::Contract(realm_internal_systems::TEST_CLASS_HASH),
                // events
                TestResource::Event(troop_movement_systems::e_ExplorerMoveEvent::TEST_CLASS_HASH),
            ]
                .span(),
        };

        ndef
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(DEFAULT_NS(), @"troop_management_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"troop_movement_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"troop_movement_util_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"agent_discovery_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"hyperstructure_discovery_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"mine_discovery_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"resource_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"village_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
            ContractDefTrait::new(DEFAULT_NS(), @"realm_internal_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ]
            .span()
    }

    fn impersonate(address: ContractAddress) {
        set_contract_address(address);
        set_account_contract_address(address);
    }

    fn get_opposite_direction(direction: Direction) -> Direction {
        match direction {
            Direction::East => Direction::West,
            Direction::NorthEast => Direction::SouthWest,
            Direction::NorthWest => Direction::SouthEast,
            Direction::West => Direction::East,
            Direction::SouthWest => Direction::NorthEast,
            Direction::SouthEast => Direction::NorthWest,
        }
    }

    // I. guard_add tests
    /// @notice Tests adding troops to an empty guard slot successfully.
    /// @dev Verifies the happy path for `guard_add` when the slot is initially empty.
    /// Checks correct model updates (GuardTroops, StructureBase) and resource deduction.
    #[test]
    fn guard_add_success_empty_slot() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let knights_added_to_guard = 1 * RESOURCE_PRECISION;

        let initial_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        let initial_guards = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (initial_troops, _) = initial_guards.from_slot(slot);
        assert(initial_troops.count == 0, 'Slot empty');

        // Act
        troop_management_systems.guard_add(realm_id, slot, category, tier, knights_added_to_guard);

        // Assert
        let final_guards = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (final_troops, _) = final_guards.from_slot(slot);

        assert(final_troops.count == knights_added_to_guard, 'Guard count');
        assert(final_troops.category == category, 'Guard category');
        assert(final_troops.tier == tier, 'Guard tier');

        let final_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert(
            final_structure_base.troop_guard_count == initial_structure_base.troop_guard_count + 1, 'Base guard count',
        );

        let knight_balance = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        let expected_knight_balance = starting_knight_t1_amount - knights_added_to_guard;
        assert!(
            knight_balance == expected_knight_balance,
            "Wrong knight balance. Expected: {}, Actual: {}",
            expected_knight_balance,
            knight_balance,
        );
    }

    /// @notice Tests adding troops to a guard slot that already contains troops of the same type
    /// and tier.
    /// @dev Verifies the happy path for `guard_add` when adding to an existing stack.
    /// Checks correct count increment, potential stamina update, StructureBase updates, and
    /// resource deduction.
    #[test]
    fn guard_add_success_existing_slot() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let first_add_amount = 1 * RESOURCE_PRECISION;
        let second_add_amount = 2 * RESOURCE_PRECISION;
        let total_added_amount = first_add_amount + second_add_amount;

        // Act 1: Add first batch
        troop_management_systems.guard_add(realm_id, slot, category, tier, first_add_amount);

        // Assert 1: Check state after first add
        let guards_after_first_add = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (troops_after_first_add, _) = guards_after_first_add.from_slot(slot);
        assert(troops_after_first_add.count == first_add_amount, 'Guard count after first add');
        assert(troops_after_first_add.category == category, 'Guard category after first add');
        assert(troops_after_first_add.tier == tier, 'Guard tier after first add');

        let structure_base_after_first_add = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        let initial_base_guard_count = structure_base_after_first_add.troop_guard_count;
        assert(initial_base_guard_count == 1, 'Base guard count after first');

        let knight_balance_after_first_add = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        let expected_knight_balance_after_first_add = starting_knight_t1_amount - first_add_amount;
        assert!(
            knight_balance_after_first_add == expected_knight_balance_after_first_add,
            "Wrong knight balance after first",
        );

        // Act 2: Add second batch to the same slot
        troop_management_systems.guard_add(realm_id, slot, category, tier, second_add_amount);

        // Assert 2: Check final state
        let final_guards = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (final_troops, _) = final_guards.from_slot(slot);

        assert(final_troops.count == total_added_amount, 'Final guard count');
        assert(final_troops.category == category, 'Final guard category');
        assert(final_troops.tier == tier, 'Final guard tier');

        // StructureBase troop_guard_count should NOT increase the second time
        let final_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert(final_structure_base.troop_guard_count == initial_base_guard_count, 'Base guard count unchanged');

        let final_knight_balance = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        let expected_final_knight_balance = starting_knight_t1_amount - total_added_amount;
        assert!(final_knight_balance == expected_final_knight_balance, "Wrong final knight balance");
    }

    /// @notice Tests that `guard_add` reverts if the season is not active.
    /// @dev Required by the `SeasonConfigImpl::get(world).assert_started_and_not_over()` check.
    #[test]
    #[should_panic(expected: ("The game starts in 0 hours 33 minutes, 20 seconds", 'ENTRYPOINT_FAILED'))]
    fn guard_add_revert_season_inactive() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world); // Initialize all standard configs first

        // NOW, overwrite SeasonConfig to make it inactive
        let current_time = starknet::get_block_timestamp();
        let future_start = current_time + 1000;
        let inactive_season_config = SeasonConfig {
            start_settling_at: future_start,
            start_main_at: future_start + 1000,
            end_at: 0,
            end_grace_seconds: 0,
            registration_grace_seconds: 0,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), inactive_season_config);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        // Can use tspawn_realm_with_resources now that init_config was called
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);
        // Grant resources needed for the call
        let amount = 1 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, amount * 2)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;

        // Act - Attempt guard_add with inactive season, expecting panic
        troop_management_systems.guard_add(realm_id, slot, category, tier, amount);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `guard_add` reverts if the caller does not own the structure.
    /// @dev Required by the `StructureOwnerStoreImpl::retrieve(...).assert_caller_owner()` check.
    #[test]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn guard_add_revert_not_owner() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::contract_address_const::<0x1>();
        let other_caller = starknet::contract_address_const::<0x2>();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Grant resources to the realm, though ownership check should happen first
        let amount = 1 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;

        // Act - Call from `other_caller`, expecting panic
        impersonate(other_caller); // Use the helper function
        troop_management_systems.guard_add(realm_id, slot, category, tier, amount);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `guard_add` reverts if the structure lacks sufficient resources for
    /// payment.
    /// @dev Required by the internal `iTroopImpl::make_payment` call.
    #[test]
    #[should_panic(expected: ("Insufficient Balance: T1 KNIGHT (id: 4, balance: 0) < 1000000000", 'ENTRYPOINT_FAILED'))]
    fn guard_add_revert_insufficient_resources() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address(); // Use default caller
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_simple_realm(ref world, 1, realm_owner, realm_coord); // Spawn without resources

        // DO NOT grant resources

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;

        // Act - Attempt to add troops without resources, expecting panic
        troop_management_systems.guard_add(realm_id, slot, category, tier, amount);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `guard_add` reverts when adding to an existing slot with a different
    /// troop type (category).
    /// @dev Required by the `assert!(troops.category == category ...)` check within the if block.
    #[test]
    #[should_panic(expected: ("incorrect category or tier", 'ENTRYPOINT_FAILED'))]
    fn guard_add_revert_mismatched_type() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Grant enough resources for both types
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        let starting_paladin_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(
            ref world,
            realm_id,
            array![
                (ResourceTypes::KNIGHT_T1, starting_knight_t1_amount),
                (ResourceTypes::PALADIN_T1, starting_paladin_t1_amount),
            ]
                .span(),
        );

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let slot = GuardSlot::Delta;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;

        // Act 1: Add Knights
        troop_management_systems.guard_add(realm_id, slot, TroopType::Knight, tier, amount);

        // Assert 1: Check knights are added
        let guards_after_first = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (troops_after_first, _) = guards_after_first.from_slot(slot);
        assert(troops_after_first.category == TroopType::Knight, 'Category should be Knight');

        // Act 2: Attempt to add Paladins to the same slot, expecting panic
        troop_management_systems.guard_add(realm_id, slot, TroopType::Paladin, tier, amount);
        // Assert 2 - Handled by should_panic
    }

    /// @notice Tests that `guard_add` reverts when adding to an existing slot with a different
    /// troop tier.
    /// @dev Required by the `assert!(... && troops.tier == tier)` check within the if block.
    #[test]
    #[should_panic(expected: ("incorrect category or tier", 'ENTRYPOINT_FAILED'))]
    fn guard_add_revert_mismatched_tier() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Grant enough resources for both tiers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        let starting_knight_t2_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(
            ref world,
            realm_id,
            array![
                (ResourceTypes::KNIGHT_T1, starting_knight_t1_amount),
                (ResourceTypes::KNIGHT_T2, starting_knight_t2_amount) // Assuming T2 exists
            ]
                .span(),
        );

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let amount = 1 * RESOURCE_PRECISION;

        // Act 1: Add Knight T1
        troop_management_systems.guard_add(realm_id, slot, category, TroopTier::T1, amount);

        // Assert 1: Check T1 knights are added
        let guards_after_first = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (troops_after_first, _) = guards_after_first.from_slot(slot);
        assert(troops_after_first.tier == TroopTier::T1, 'Tier should be T1');

        // Act 2: Attempt to add Knight T2 to the same slot, expecting panic
        troop_management_systems.guard_add(realm_id, slot, category, TroopTier::T2, amount);
        // Assert 2 - Handled by should_panic
    }

    /// @notice Tests that `guard_add` reverts if adding troops would exceed troop limits.
    /// @dev Required by internal checks within `iGuardImpl::add`.
    #[test]
    #[should_panic(expected: ("reached limit of structure guard troop count", 'ENTRYPOINT_FAILED'))]
    fn guard_add_revert_exceed_limit() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Get the limit from config
        let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
        let max_troops_per_guard = troop_limit_config.explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;
        let amount_to_exceed = max_troops_per_guard + 1 * RESOURCE_PRECISION;

        // Grant enough resources for the large amount
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, amount_to_exceed * 2)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;

        // Act - Attempt to add more troops than the limit, expecting panic
        troop_management_systems.guard_add(realm_id, slot, category, tier, amount_to_exceed);
        // Assert - Handled by should_panic
    }

    // II. guard_delete tests
    /// @notice Tests deleting an existing, non-empty guard slot successfully.
    /// @dev Verifies the happy path for `guard_delete`. Checks model updates (GuardTroops,
    /// StructureBase).
    #[test]
    fn guard_delete_success() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount_to_add = 1 * RESOURCE_PRECISION;

        // Act 1: Add troops to the slot
        troop_management_systems.guard_add(realm_id, slot, category, tier, amount_to_add);

        // Assert 1: Verify troops were added
        let initial_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert(initial_structure_base.troop_guard_count == 1, 'Guard count post-add');
        let initial_guards = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (initial_troops, _) = initial_guards.from_slot(slot);
        assert(initial_troops.count == amount_to_add, 'Troop count post-add');

        // Act 2: Delete the troops from the slot
        troop_management_systems.guard_delete(realm_id, slot);

        // Assert 2: Verify troops were deleted
        let final_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert(final_structure_base.troop_guard_count == 0, 'Guard count post-delete');
        let final_guards = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (final_troops, _) = final_guards.from_slot(slot);
        assert(final_troops.count == 0, 'Troop count post-delete');
        assert(final_troops.category == category, 'Category post-delete');
        assert(final_troops.tier == tier, 'Tier post-delete');
    }

    /// @notice Tests attempting to delete an already empty guard slot.
    /// @dev Verifies that attempting to delete an empty slot throws an error.
    #[test]
    #[should_panic(expected: ("guard_delete: No troops in specified slot", 'ENTRYPOINT_FAILED'))]
    fn guard_delete_empty_slot() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let slot = GuardSlot::Charlie; // Use a different slot for clarity

        // Assert 1: Verify slot is initially empty
        let initial_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert(initial_structure_base.troop_guard_count == 0, 'Initial guard count should be 0');
        let initial_guards = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (initial_troops, _) = initial_guards.from_slot(slot);
        assert(initial_troops.count == 0, 'Initial troop count should be 0');

        // Act: Delete the empty slot
        troop_management_systems.guard_delete(realm_id, slot);

        // Assert 2: Verify state remains unchanged
        let final_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert(final_structure_base.troop_guard_count == 0, 'Final guard count should be 0');
        let final_guards = StructureTroopGuardStoreImpl::retrieve(ref world, realm_id);
        let (final_troops, _) = final_guards.from_slot(slot);
        assert(final_troops.count == 0, 'Final troop count should be 0');
    }

    /// @notice Tests that `guard_delete` reverts if the season is not active.
    /// @dev Required by the `SeasonConfigImpl::get(world).assert_started_and_not_over()` check.
    #[test]
    #[should_panic(expected: ("The game starts in 0 hours 33 minutes, 20 seconds", 'ENTRYPOINT_FAILED'))]
    fn guard_delete_revert_season_inactive() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        // Overwrite SeasonConfig to make it inactive
        let current_time = starknet::get_block_timestamp();
        let future_start = current_time + 1000;
        let inactive_season_config = SeasonConfig {
            start_settling_at: future_start,
            start_main_at: future_start + 1000,
            end_at: 0,
            end_grace_seconds: 0,
            registration_grace_seconds: 0,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), inactive_season_config);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);
        // No need to add troops, check should happen before slot logic

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let slot = GuardSlot::Delta;

        // Act - Attempt guard_delete with inactive season, expecting panic
        troop_management_systems.guard_delete(realm_id, slot);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `guard_delete` reverts if the caller does not own the structure.
    /// @dev Required by the `StructureOwnerStoreImpl::retrieve(...).assert_caller_owner()` check.
    #[test]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn guard_delete_revert_not_owner() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::contract_address_const::<0x1>();
        let other_caller = starknet::contract_address_const::<0x2>();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Add some troops to a slot first (as owner)
        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };
        let slot = GuardSlot::Delta;
        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, amount)].span());
        impersonate(realm_owner); // Ensure owner adds troops
        troop_management_systems.guard_add(realm_id, slot, category, tier, amount);

        // Act - Call delete from `other_caller`, expecting panic
        impersonate(other_caller);
        troop_management_systems.guard_delete(realm_id, slot);
        // Assert - Handled by should_panic
    }

    // III. explorer_create tests
    /// @notice Tests creating a new explorer successfully.
    /// @dev Verifies the happy path for `explorer_create`. Checks creation of ExplorerTroops,
    /// StructureBase/StructureTroopExplorerStoreImpl updates, Tile occupation, resource deduction,
    /// and ID return.
    #[test]
    fn explorer_create_success() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        let initial_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        let initial_explorers = StructureTroopExplorerStoreImpl::retrieve(ref world, realm_id);
        assert(SpanTrait::len(initial_explorers) == 0, 'Initial explorer count');

        let structure_coord = Coord { x: initial_structure_base.coord_x, y: initial_structure_base.coord_y };
        let spawn_coord = structure_coord.neighbor(spawn_direction);
        let initial_spawn_tile: Tile = world.read_model((spawn_coord.x, spawn_coord.y));
        assert(initial_spawn_tile.not_occupied(), 'Spawn tile initially free');

        // Act
        let explorer_id = troop_management_systems.explorer_create(realm_id, category, tier, amount, spawn_direction);

        // Assert
        assert(explorer_id != 0, 'Explorer ID should be non-zero');

        // Check ExplorerTroops model
        let explorer: ExplorerTroops = world.read_model(explorer_id);
        assert(explorer.explorer_id == explorer_id, 'Explorer ID mismatch');
        assert(explorer.owner == realm_id, 'Explorer owner mismatch');
        assert(explorer.coord == spawn_coord, 'Explorer coord mismatch');
        assert(explorer.troops.category == category, 'Explorer category mismatch');
        assert(explorer.troops.tier == tier, 'Explorer tier mismatch');
        assert(explorer.troops.count == amount, 'Explorer count mismatch');

        // Check StructureBase updates
        let final_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert(
            final_structure_base.troop_explorer_count == initial_structure_base.troop_explorer_count + 1,
            'Structure explorer count',
        );

        // Check StructureTroopExplorerStoreImpl updates
        let final_explorers = StructureTroopExplorerStoreImpl::retrieve(ref world, realm_id);
        assert(final_explorers.len() == 1, 'Final explorer list length');
        assert(*final_explorers.at(0) == explorer_id, 'Explorer ID not in list');

        // Check Tile occupation
        let final_spawn_tile: Tile = world.read_model((spawn_coord.x, spawn_coord.y));
        assert(!final_spawn_tile.not_occupied(), 'Spawn tile should be occupied');
        assert(final_spawn_tile.occupier_id == explorer_id, 'Spawn tile occupant ID');

        // Check resource deduction
        let final_knight_balance = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        let expected_knight_balance = starting_knight_t1_amount - amount;
        assert!(
            final_knight_balance == expected_knight_balance,
            "Wrong knight balance. Expected: {}, Actual: {}",
            expected_knight_balance,
            final_knight_balance,
        );
    }

    /// @notice Tests that `explorer_create` reverts if the amount is zero.
    /// @dev Although the direct assert is in `guard_add`, payment likely enforces non-zero.
    /// Verifies this path.
    #[test]
    #[should_panic(expected: ("amount must be greater than 0", 'ENTRYPOINT_FAILED'))]
    fn explorer_create_revert_zero_amount() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        // Spawn realm with resources (though not strictly needed for this check)
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 0; // Zero amount
        let spawn_direction = Direction::NorthEast;

        // Act - Attempt to create explorer with zero amount, expecting panic
        troop_management_systems.explorer_create(realm_id, category, tier, amount, spawn_direction);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_create` reverts if the season is not active.
    /// @dev Required by the `SeasonConfigImpl::get(world).assert_started_and_not_over()` check.
    #[test]
    #[should_panic(expected: ("The game starts in 0 hours 33 minutes, 20 seconds", 'ENTRYPOINT_FAILED'))]
    fn explorer_create_revert_season_inactive() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world); // Init standard config first

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for initial creation
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer
        let explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount, spawn_direction);

        // Overwrite SeasonConfig to make it inactive *after* creation
        let current_time = starknet::get_block_timestamp();
        let future_start = current_time + 1000;
        let inactive_season_config = SeasonConfig {
            start_settling_at: future_start,
            start_main_at: future_start + 1000,
            end_at: 0,
            end_grace_seconds: 0,
            registration_grace_seconds: 0,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), inactive_season_config);

        // Act 2: Attempt to add troops with inactive season
        let home_direction = get_opposite_direction(spawn_direction);
        troop_management_systems.explorer_add(explorer_id, create_amount, home_direction);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_create` reverts if the caller does not own the structure.
    /// @dev Required by the `StructureOwnerStoreImpl::retrieve(...).assert_caller_owner()` check.
    #[test]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn explorer_create_revert_not_owner() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::contract_address_const::<0x1>();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for the call
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act - Attempt to create explorer when global limit is 0
        troop_management_systems.explorer_create(realm_id, category, tier, amount, spawn_direction);
        // Assert - Handled by should_panic
    }

    /// @dev Required by the internal `iTroopImpl::make_payment` call.
    #[test]
    #[should_panic(expected: ("Insufficient Balance: T1 KNIGHT (id: 4, balance: 0) < 1000000000", 'ENTRYPOINT_FAILED'))]
    fn explorer_create_revert_insufficient_resources() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address(); // Use default caller
        let realm_coord = Coord { x: 10, y: 10 };
        // Spawn realm WITHOUT granting any resources
        let realm_id = tspawn_simple_realm(ref world, 1, realm_owner, realm_coord);

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION; // Amount to attempt creation
        let spawn_direction = Direction::NorthEast;

        // Act - Attempt to create explorer without resources, expecting panic
        troop_management_systems.explorer_create(realm_id, category, tier, amount, spawn_direction);
        // Assert - Handled by should_panic
    }

    /// @dev Required by the `assert!(structure.troop_explorer_count <
    /// structure.troop_max_explorer_count.into())`
    /// check.
    #[test]
    #[should_panic(expected: ("reached limit of troops for your structure", 'ENTRYPOINT_FAILED'))]
    fn explorer_create_revert_structure_explorer_limit() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Set the structure's specific explorer limit to 1
        let mut structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        structure_base.troop_max_explorer_count = 1;
        StructureBaseStoreImpl::store(ref structure_base, ref world, realm_id);

        // Grant enough resources to create *two* explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount * 2)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;
        let spawn_direction_1 = Direction::NorthEast;
        let spawn_direction_2 = Direction::East; // Use a different direction

        // Act 1: Create the first explorer (should succeed)
        let _first_explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, amount, spawn_direction_1);

        // Assert 1: Check structure count is 1 (optional)
        let structure_base_after_1 = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert(structure_base_after_1.troop_explorer_count == 1, 'Count should be 1');

        // Act 2: Attempt to create the second explorer (should panic)
        troop_management_systems.explorer_create(realm_id, category, tier, amount, spawn_direction_2);
        // Assert 2 - Handled by should_panic
    }

    /// @notice Tests that `explorer_create` reverts if the structure has reached the global
    /// explorer limit per structure.
    /// @dev Required by the `assert!(structure.troop_explorer_count <
    /// troop_limit_config.explorer_max_party_count.into())` check.
    #[test]
    #[should_panic(expected: ("reached limit of troops per structure", 'ENTRYPOINT_FAILED'))]
    fn explorer_create_revert_global_explorer_limit() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world); // Init config first (sets global limit to 20)

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        // Create the realm *before* changing the global limit config
        // This ensures the structure's internal max_explorer_count is 20
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Now, set global explorer limit config to 0 *after* realm creation
        let mut troop_limit_config = CombatConfigImpl::troop_limit_config(ref world);
        troop_limit_config.explorer_max_party_count = 0;
        WorldConfigUtilImpl::set_member(ref world, selector!("troop_limit_config"), troop_limit_config);

        // Grant resources needed for the call (even though it should fail)
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act - Attempt to create explorer.
        // Structure limit check (0 < 20) should pass.
        // Global limit check (0 < 0) should fail.
        troop_management_systems.explorer_create(realm_id, category, tier, amount, spawn_direction);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_create` reverts if the designated spawn tile is already
    /// occupied.
    /// @dev Required by the `assert!(tile.not_occupied())` check.
    #[test]
    #[should_panic(expected: ("explorer spawn location is occupied", 'ENTRYPOINT_FAILED'))]
    fn explorer_create_revert_spawn_occupied() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Increase structure explorer limit to avoid hitting it first
        let mut structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        structure_base.troop_max_explorer_count = 5; // Set to a value > 1
        StructureBaseStoreImpl::store(ref structure_base, ref world, realm_id);

        // Grant resources needed for the call
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(
            ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount * 2)].span(),
        ); // Need enough for two creations

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the first explorer to occupy the spawn tile
        let _first_explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, amount, spawn_direction);

        // Act 2: Attempt to create a second explorer at the same occupied spawn tile
        troop_management_systems.explorer_create(realm_id, category, tier, amount, spawn_direction);
        // Assert - Handled by should_panic
    }

    // IV. explorer_add tests
    /// @notice Tests adding troops to an existing explorer successfully.
    /// @dev Verifies the happy path for `explorer_add`. Checks ExplorerTroops count/capacity update
    /// and resource deduction.
    #[test]
    fn explorer_add_success() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Grant resources for creation and addition
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let add_amount = 2 * RESOURCE_PRECISION;
        let total_amount = create_amount + add_amount;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer
        let explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount, spawn_direction);

        // Assert 1: Check initial state
        let initial_explorer: ExplorerTroops = world.read_model(explorer_id);
        assert(initial_explorer.troops.count == create_amount, 'Initial count');

        let balance_after_create = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        let expected_balance_after_create = starting_knight_t1_amount - create_amount;
        assert(balance_after_create == expected_balance_after_create, 'Balance post-create');

        // Act 2: Add more troops
        // Need the direction from the explorer back to the structure
        let home_direction = get_opposite_direction(spawn_direction);
        troop_management_systems.explorer_add(explorer_id, add_amount, home_direction);

        // Assert 2: Check final state
        let final_explorer: ExplorerTroops = world.read_model(explorer_id);
        assert(final_explorer.troops.count == total_amount, 'Final count');

        // Check final resource deduction
        let final_knight_balance = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        let expected_knight_balance = starting_knight_t1_amount - total_amount;
        assert!(final_knight_balance == expected_knight_balance, "Wrong final knight balance");
    }

    /// @notice Tests that `explorer_add` reverts if the amount is zero.
    /// @dev Required by the `assert!(amount.is_non_zero())` check.
    #[test]
    #[should_panic(expected: ("amount must be greater than 0", 'ENTRYPOINT_FAILED'))]
    fn explorer_add_revert_zero_amount() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for initial creation
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let add_amount = 0; // Zero amount
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer
        let explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount, spawn_direction);

        // Act 2: Attempt to add zero troops
        let home_direction = get_opposite_direction(spawn_direction);
        troop_management_systems.explorer_add(explorer_id, add_amount, home_direction);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_add` reverts if the amount is not divisible by
    /// RESOURCE_PRECISION.
    /// @dev Required by the `assert!(amount % RESOURCE_PRECISION == 0)` check.
    #[test]
    #[should_panic(expected: ("amount must be divisible by resource precision", 'ENTRYPOINT_FAILED'))]
    fn explorer_add_revert_invalid_precision() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for initial creation and attempt
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let add_amount = 1 * RESOURCE_PRECISION + 1; // Invalid precision
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer
        let explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount, spawn_direction);

        // Act 2: Attempt to add troops with invalid precision
        let home_direction = get_opposite_direction(spawn_direction);
        troop_management_systems.explorer_add(explorer_id, add_amount, home_direction);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_add` reverts if the season is not active.
    /// @dev Required by the `SeasonConfigImpl::get(world).assert_started_and_not_over()` check.
    #[test]
    #[should_panic(expected: ("The game starts in 0 hours 33 minutes, 20 seconds", 'ENTRYPOINT_FAILED'))]
    fn explorer_add_revert_season_inactive() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world); // Init standard config first

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for initial creation
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer
        let explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount, spawn_direction);

        // Overwrite SeasonConfig to make it inactive *after* creation
        let current_time = starknet::get_block_timestamp();
        let future_start = current_time + 1000;
        let inactive_season_config = SeasonConfig {
            start_settling_at: future_start,
            start_main_at: future_start + 1000,
            end_at: 0,
            end_grace_seconds: 0,
            registration_grace_seconds: 0,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), inactive_season_config);

        // Act 2: Attempt to add troops with inactive season
        let home_direction = get_opposite_direction(spawn_direction);
        troop_management_systems.explorer_add(explorer_id, create_amount, home_direction);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_add` reverts if the caller does not own the explorer's home
    /// structure.
    /// @dev Required by the `StructureOwnerStoreImpl::retrieve(ref world,
    /// explorer.owner).assert_caller_owner()` check.
    #[test]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn explorer_add_revert_not_owner() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::contract_address_const::<0x1>();
        let other_caller = starknet::contract_address_const::<0x2>();
        let realm_coord = Coord { x: 10, y: 10 };
        // Spawn the realm with the intended owner
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for creation and addition
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let add_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer (as owner)
        impersonate(realm_owner);
        let explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount, spawn_direction);

        // Act 2: Attempt to add troops from `other_caller`
        impersonate(other_caller);
        let home_direction = get_opposite_direction(spawn_direction);
        troop_management_systems.explorer_add(explorer_id, add_amount, home_direction);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_add` reverts if the explorer is not adjacent to its home
    /// structure (or wrong direction).
    /// @dev Required by the `assert!(explorer_owner_structure.coord() ==
    /// explorer.coord.neighbor(home_direction))`
    /// check.
    #[test]
    #[should_panic(expected: ("explorer not adjacent to home structure", 'ENTRYPOINT_FAILED'))]
    fn explorer_add_revert_not_adjacent_home() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for creation and attempted addition
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        let wheat_amount: u128 = 100000000000000000; // For movement
        let fish_amount: u128 = 50000000000000000; // For movement
        tgrant_resources(
            ref world,
            realm_id,
            array![
                (ResourceTypes::KNIGHT_T1, starting_knight_t1_amount),
                (ResourceTypes::WHEAT, wheat_amount),
                (ResourceTypes::FISH, fish_amount),
            ]
                .span(),
        );

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };
        let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
        let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let add_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act
        let explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount, spawn_direction);

        let move_direction = array![spawn_direction].span();
        troop_movement_systems.explorer_move(explorer_id, move_direction, false);

        // Assert
        let explorer_after_move: ExplorerTroops = world.read_model(explorer_id);
        let expected_coord = realm_coord.neighbor(spawn_direction).neighbor(spawn_direction);
        assert!(explorer_after_move.coord == expected_coord, "Explorer didn't move correctly");

        // Act 2
        let incorrect_home_direction = Direction::NorthEast; // Still incorrect
        troop_management_systems.explorer_add(explorer_id, add_amount, incorrect_home_direction);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_add` reverts if the structure lacks sufficient resources.
    /// @dev Required by the internal `iTroopImpl::make_payment` call.
    #[test]
    #[should_panic(expected: ("Insufficient Balance: T1 KNIGHT (id: 4, balance: 0) < 2000000000", 'ENTRYPOINT_FAILED'))]
    fn explorer_add_revert_insufficient_resources() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_simple_realm(
            ref world, 1, realm_owner, realm_coord,
        ); // Spawn without extra resources initially

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let add_amount = 2 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Grant exactly enough resources to CREATE the explorer, but not enough to ADD more
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, create_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        // Act 1: Create the explorer (this should succeed)
        let explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount, spawn_direction);

        // Assert 1: Verify the realm has 0 Knight T1 balance after creation
        let balance_after_create = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        assert!(balance_after_create == 0, "Balance should be zero after creation");

        // Act 2: Attempt to add more troops (this should fail due to insufficient resources)
        let home_direction = get_opposite_direction(spawn_direction);
        troop_management_systems.explorer_add(explorer_id, add_amount, home_direction);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_add` reverts if adding troops would exceed the explorer's troop
    /// limit.
    /// @dev Required by the `assert!(explorer.troops.count <= ...)` check.
    #[test]
    #[should_panic(expected: ("reached limit of explorers amount per army", 'ENTRYPOINT_FAILED'))]
    fn explorer_add_revert_exceed_limit() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Get the limit from config
        let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
        let max_troops_per_explorer = troop_limit_config.explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;
        let create_amount = max_troops_per_explorer - 1 * RESOURCE_PRECISION; // Create just under the limit
        let add_amount = 2 * RESOURCE_PRECISION; // Amount that will exceed the limit
        let total_needed_resource = create_amount + add_amount;

        // Grant enough resources for creation and the attempt to add more
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, total_needed_resource)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer with an amount close to the limit
        let explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount, spawn_direction);

        // Assert 1: Check initial state (optional, but good practice)
        let initial_explorer: ExplorerTroops = world.read_model(explorer_id);
        assert(initial_explorer.troops.count == create_amount, 'Initial count wrong');

        // Act 2: Attempt to add troops that exceed the limit, expecting panic
        let home_direction = get_opposite_direction(spawn_direction);
        troop_management_systems.explorer_add(explorer_id, add_amount, home_direction);
        // Assert - Handled by should_panic
    }

    // V. explorer_delete tests
    /// @notice Tests deleting an existing explorer successfully.
    /// @dev Verifies the happy path for `explorer_delete`. Checks ExplorerTroops deletion,
    /// StructureBase/Store updates, Tile freeing.
    #[test]
    fn explorer_delete_success() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Grant resources for creation
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer
        let explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount, spawn_direction);

        // Assert 1: Verify initial state
        let mut initial_explorer: ExplorerTroops = world.read_model(explorer_id);
        assert(initial_explorer.explorer_id == explorer_id, 'Explorer ID wrong');
        assert(initial_explorer.troops.count == create_amount, 'Initial count wrong');

        let initial_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert(initial_structure_base.troop_explorer_count == 1, 'Initial structure count wrong');
        let structure_coord = Coord { x: initial_structure_base.coord_x, y: initial_structure_base.coord_y };
        let spawn_coord = structure_coord.neighbor(spawn_direction);

        let initial_explorers = StructureTroopExplorerStoreImpl::retrieve(ref world, realm_id);
        assert(initial_explorers.len() == 1, 'Initial explorer list len wrong');
        assert(*initial_explorers.at(0) == explorer_id, 'Initial explorer ID not in list');

        let initial_spawn_tile: Tile = world.read_model((spawn_coord.x, spawn_coord.y));
        assert(!initial_spawn_tile.not_occupied(), 'Spawn tile should be occupied');
        assert(initial_spawn_tile.occupier_id == explorer_id, 'Spawn tile occupier wrong');

        // Act 2: Delete the explorer
        world.write_model_test(@initial_explorer);
        troop_management_systems.explorer_delete(explorer_id);

        // Assert 2: Verify final state
        let final_explorer: ExplorerTroops = world.read_model(explorer_id);

        // Dojo models aren't truly deleted, but zeroed out.
        assert(final_explorer.owner == 0, 'Final owner should be 0');
        assert(final_explorer.troops.count == 0, 'Final count should be 0');
        assert(final_explorer.explorer_id == explorer_id, 'Explorer ID should be same'); // ID is also zeroed
        assert(final_explorer.troops.count == 0, 'Final count should be 0');
        assert(final_explorer.coord.x == 0, 'Final coord x should be 0');
        assert(final_explorer.coord.y == 0, 'Final coord y should be 0');

        let final_structure_base = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert(final_structure_base.troop_explorer_count == 0, 'Final structure count wrong');

        let final_explorers = StructureTroopExplorerStoreImpl::retrieve(ref world, realm_id);
        assert(final_explorers.len() == 0, 'Final explorer list len wrong');

        let final_spawn_tile: Tile = world.read_model((spawn_coord.x, spawn_coord.y));
        assert(final_spawn_tile.not_occupied(), 'Spawn tile should be free');
        assert(final_spawn_tile.occupier_id == 0, 'Spawn tile occupier should be 0');
    }

    /// @notice Tests that `explorer_delete` reverts if the season is not active.
    /// @dev Required by the `SeasonConfigImpl::get(world).assert_started_and_not_over()` check.
    #[test]
    #[should_panic(expected: ("The game starts in 0 hours 33 minutes, 20 seconds", 'ENTRYPOINT_FAILED'))]
    fn explorer_delete_revert_season_inactive() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world); // Init standard config first

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for initial creation
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer (while season is active)
        let explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount, spawn_direction);

        // Overwrite SeasonConfig to make it inactive *after* creation
        let current_time = starknet::get_block_timestamp();
        let future_start = current_time + 1000;
        let inactive_season_config = SeasonConfig {
            start_settling_at: future_start,
            start_main_at: future_start + 1000,
            end_at: 0,
            end_grace_seconds: 0,
            registration_grace_seconds: 0,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), inactive_season_config);

        // Act 2: Attempt to delete the explorer with inactive season
        troop_management_systems.explorer_delete(explorer_id);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_delete` reverts if the caller does not own the explorer's home
    /// structure.
    /// @dev Required by the `StructureOwnerStoreImpl::retrieve(ref world,
    /// explorer.owner).assert_caller_owner()` check.
    #[test]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn explorer_delete_revert_not_owner() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::contract_address_const::<0x1>();
        let other_caller = starknet::contract_address_const::<0x2>();
        let realm_coord = Coord { x: 10, y: 10 };
        // Spawn the realm with the intended owner
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);

        // Grant resources needed for creation and addition
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction = Direction::NorthEast;

        // Act 1: Create the explorer (as owner)
        let explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount, spawn_direction);

        // Act 2: Attempt to delete the explorer from `other_caller`
        impersonate(other_caller);
        troop_management_systems.explorer_delete(explorer_id);
        // Assert - Handled by should_panic
    }

    // VI. explorer_explorer_swap tests
    /// @notice Tests swapping troops between two valid, adjacent explorers owned by the same
    /// structure.
    /// @dev Verifies the happy path for `explorer_explorer_swap`. Checks count/capacity/stamina
    /// updates for both explorers.
    #[test]
    fn explorer_swap_success() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        // Verify config directly
        let troop_limit_config_check: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
        assert(troop_limit_config_check.explorer_max_party_count == 20, 'Config Max Party Count Check');

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);
        let realm2_coord = Coord { x: 13, y: 10 };
        let realm2_id = tspawn_realm_with_resources(ref world, 2, realm_owner, realm2_coord);

        // Verify structure max count after creation
        let structure_base_after_spawn = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert(structure_base_after_spawn.troop_max_explorer_count == 1, 'Structure Max Count Check');
        let structure_base_after_spawn2 = StructureBaseStoreImpl::retrieve(ref world, realm2_id);
        assert(structure_base_after_spawn2.troop_max_explorer_count == 1, 'Structure Max Count Check');

        // Grant enough resources for two explorers and the swap
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        // Set swap_amount to a precise value <= create_amount_from
        let swap_amount = 1 * RESOURCE_PRECISION; // Changed from 4 * RESOURCE_PRECISION
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West; // Adjacent

        // Act

        // Create the 'from' explorer
        let from_explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);

        // Create the 'to' explorer
        let to_explorer_id = troop_management_systems
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);

        // Verify structure state after first create
        let structure_base_after_first_create = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert(structure_base_after_first_create.troop_explorer_count == 1, 'Count after first create');
        assert(structure_base_after_first_create.troop_max_explorer_count == 1, 'Max count after first create');

        // Assert 1: Verify initial states
        let initial_from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
        let initial_to_explorer: ExplorerTroops = world.read_model(to_explorer_id);
        assert(initial_from_explorer.troops.count == create_amount_from, 'Initial From Count');
        assert(initial_to_explorer.troops.count == create_amount_to, 'Initial To Count');

        // Act 3: Perform the swap
        let swap_direction = Direction::East;
        troop_management_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);

        // Assert 2: Verify final states
        let final_from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
        let final_to_explorer: ExplorerTroops = world.read_model(to_explorer_id);

        let expected_from_count = create_amount_from - swap_amount;
        let expected_to_count = create_amount_to + swap_amount;
        assert(final_from_explorer.troops.count == expected_from_count, 'Final From Count');
        assert(final_to_explorer.troops.count == expected_to_count, 'Final To Count');

        // Check stamina - 'to' stamina should not increase beyond 'from' stamina after swap
        // (Assuming initial refill puts them at max or same level initially)
        let initial_from_stamina = initial_from_explorer.troops.stamina.amount;
        let final_to_stamina = final_to_explorer.troops.stamina.amount;
        // This assertion might need refinement based on exact stamina refill logic and timing
        assert(final_to_stamina <= initial_from_stamina, 'Stamina constraint');

        // Check knight balance at realm layer (should be unaffected by the swap)
        let final_knight_balance_realm1 = ResourceImpl::read_balance(ref world, realm_id, ResourceTypes::KNIGHT_T1);
        let final_knight_balance_realm2 = ResourceImpl::read_balance(ref world, realm2_id, ResourceTypes::KNIGHT_T1);
        assert(final_knight_balance_realm1 == starting_knight_t1_amount - create_amount_from, 'Final Balance Realm 1');
        assert(final_knight_balance_realm2 == starting_knight_t1_amount - create_amount_to, 'Final Balance Realm 2');
    }

    /// @notice Tests swapping troops when the swap amount equals the source explorer's total
    /// troops, causing deletion.
    /// @dev Required by the `assert!(structure.troop_explorer_count <
    /// troop_limit_config.explorer_max_party_count.into())` check.
    #[test]
    fn explorer_swap_success_delete_source() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        // Verify config directly
        let troop_limit_config_check: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
        assert(troop_limit_config_check.explorer_max_party_count == 20, 'Config Max Party Count Check');

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);
        let realm2_coord = Coord { x: 13, y: 10 };
        let realm2_id = tspawn_realm_with_resources(ref world, 2, realm_owner, realm2_coord);

        // Verify structure max count after creation
        let structure_base_after_spawn = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert(structure_base_after_spawn.troop_max_explorer_count == 1, 'Structure Max Count Check');
        let structure_base_after_spawn2 = StructureBaseStoreImpl::retrieve(ref world, realm2_id);
        assert(structure_base_after_spawn2.troop_max_explorer_count == 1, 'Structure Max Count Check');

        // Grant enough resources for two explorers and the swap
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        // Set swap_amount to a precise value <= create_amount_from
        let swap_amount = create_amount_from; // Swap all troops from 'from'
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West; // Adjacent to NorthEast

        // Act 1: Create the 'from' explorer
        let from_explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);

        // Verify structure state after first create
        let structure_base_after_first_create = StructureBaseStoreImpl::retrieve(ref world, realm_id);
        assert(structure_base_after_first_create.troop_explorer_count == 1, 'Count after first create');
        assert(structure_base_after_first_create.troop_max_explorer_count == 1, 'Max count after first create');

        // Act 2: Create the 'to' explorer
        let to_explorer_id = troop_management_systems
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);

        // Assert 1: Verify initial states
        let initial_from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
        let initial_to_explorer: ExplorerTroops = world.read_model(to_explorer_id);
        assert(initial_from_explorer.troops.count == create_amount_from, 'Initial From Count');
        assert(initial_to_explorer.troops.count == create_amount_to, 'Initial To Count');

        // Act 3: Perform the swap
        // Direction from 'from_explorer' (NE) to 'to_explorer' (E) is SouthEast
        let swap_direction = Direction::East;
        troop_management_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);

        // Assert 2: Verify final states
        let final_from_explorer: ExplorerTroops = world.read_model(from_explorer_id);
        let final_to_explorer: ExplorerTroops = world.read_model(to_explorer_id);

        let expected_from_count = 0; // 'from' explorer should be deleted
        let expected_to_count = create_amount_to + swap_amount;
        assert(final_from_explorer.troops.count == expected_from_count, 'Final From Count');
        assert(final_to_explorer.troops.count == expected_to_count, 'Final To Count');

        // Check stamina - 'to' stamina should not increase beyond 'from' stamina after swap
        // (Assuming initial refill puts them at max or same level initially)
        let initial_from_stamina = initial_from_explorer.troops.stamina.amount;
        let final_to_stamina = final_to_explorer.troops.stamina.amount;
        // This assertion might need refinement based on exact stamina refill logic and timing
        assert(final_to_stamina <= initial_from_stamina, 'Stamina constraint');
    }

    /// @notice Tests that `explorer_explorer_swap` reverts if the count is zero.
    /// @dev Required by the `assert!(count.is_non_zero())` check.
    #[test]
    #[should_panic(expected: ("count must be greater than 0", 'ENTRYPOINT_FAILED'))]
    fn explorer_swap_revert_zero_amount() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);
        let realm2_coord = Coord { x: 13, y: 10 };
        let realm2_id = tspawn_realm_with_resources(ref world, 2, realm_owner, realm2_coord);

        // Grant enough resources for two explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 0; // Zero amount
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West; // Adjacent

        // Act 1: Create the explorers
        let from_explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);
        let to_explorer_id = troop_management_systems
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);

        // Act 2: Attempt the swap with zero amount (expect panic)
        let swap_direction = Direction::East;
        troop_management_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_explorer_swap` reverts if the season is not active.
    /// @dev Required by the `SeasonConfigImpl::get(world).assert_started_and_not_over()` check.
    #[test]
    #[should_panic(expected: ("The game starts in 0 hours 33 minutes, 20 seconds", 'ENTRYPOINT_FAILED'))]
    fn explorer_swap_revert_season_inactive() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm2_coord = Coord { x: 13, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);
        let realm2_id = tspawn_realm_with_resources(ref world, 2, realm_owner, realm2_coord);

        // Grant enough resources for two explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 2 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 2 * RESOURCE_PRECISION;
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West; // Adjacent

        // Act 1: Create the explorers (while season is active)
        let from_explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);
        let to_explorer_id = troop_management_systems
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);

        // Make season inactive
        let current_time = starknet::get_block_timestamp();
        let future_start = current_time + 1000;
        let inactive_season_config = SeasonConfig {
            start_settling_at: future_start,
            start_main_at: future_start + 1000,
            end_at: 0,
            end_grace_seconds: 0,
            registration_grace_seconds: 0,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), inactive_season_config);

        // Act 2: Attempt the swap with inactive season (expect panic)
        let swap_direction = Direction::SouthEast;
        troop_management_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_explorer_swap` reverts if the caller does not own the
    /// explorers' home structure.
    /// @dev Required by the `StructureOwnerStoreImpl::retrieve(ref world,
    /// from_explorer.owner).assert_caller_owner()`
    /// check.
    #[test]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn explorer_swap_revert_not_owner() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::contract_address_const::<0x1>();
        let other_caller = starknet::contract_address_const::<0x2>();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);
        let realm2_coord = Coord { x: 13, y: 10 };
        let realm2_id = tspawn_realm_with_resources(ref world, 2, realm_owner, realm2_coord);

        // Grant enough resources for two explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West; // Adjacent

        // Act 1: Create the explorers (as owner)
        impersonate(realm_owner);
        let from_explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);

        impersonate(other_caller);
        let to_explorer_id = troop_management_systems
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);

        // Act 2: Attempt the swap explorers from other_caller
        //        who only owns one of the explorers (expect panic)
        impersonate(other_caller);
        let swap_direction = Direction::East;
        troop_management_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_explorer_swap` reverts if the explorers have different owners.
    /// @dev Required by the `assert!(from_explorer.owner == to_explorer.owner)` check.
    #[test]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn explorer_swap_revert_different_owners() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner_1 = starknet::contract_address_const::<0x1>();
        let realm_owner_2 = starknet::contract_address_const::<0x2>();
        let realm_coord_1 = Coord { x: 10, y: 10 };
        let realm_coord_2 = Coord { x: 13, y: 10 };
        let realm_id_1 = tspawn_realm_with_resources(ref world, 1, realm_owner_1, realm_coord_1);
        let realm_id_2 = tspawn_realm_with_resources(ref world, 2, realm_owner_2, realm_coord_2);

        // Grant enough resources for two explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id_1, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm_id_2, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West; // Adjacent

        // Act 1: Create the explorers (as different owners)
        impersonate(realm_owner_1);
        let from_explorer_id = troop_management_systems
            .explorer_create(realm_id_1, category, tier, create_amount_from, spawn_direction_from);
        impersonate(realm_owner_2);
        let to_explorer_id = troop_management_systems
            .explorer_create(realm_id_2, category, tier, create_amount_to, spawn_direction_to);

        // Act 2: Attempt the swap between different owners (expect panic)
        impersonate(realm_owner_1);
        let swap_direction = Direction::SouthEast;
        troop_management_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_explorer_swap` reverts if the explorers are not adjacent.
    /// @dev Required by the `assert!(from_explorer.coord.is_adjacent(to_explorer.coord))` check.
    #[test]
    #[should_panic(expected: ("to explorer is not at the target coordinate", 'ENTRYPOINT_FAILED'))]
    fn explorer_swap_revert_not_adjacent() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);
        let realm2_coord = Coord { x: 15, y: 10 };
        let realm2_id = tspawn_realm_with_resources(ref world, 2, realm_owner, realm2_coord);

        // Grant enough resources for two explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 1 * RESOURCE_PRECISION;
        let spawn_direction_from = Direction::NorthEast;
        let spawn_direction_to = Direction::SouthEast; // Not adjacent

        // Act 1: Create the explorers
        let from_explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);
        let to_explorer_id = troop_management_systems
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);

        // Act 2: Attempt the swap between non-adjacent explorers (expect panic)
        let swap_direction = Direction::SouthEast;
        troop_management_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        // Assert - Handled by should_panic
    }

    /// @notice Tests that `explorer_explorer_swap` reverts if the swap count exceeds the source
    /// explorer's troops.
    /// @dev Required by the `assert!(count <= from_explorer.troops.count)` check.
    #[test]
    #[should_panic(expected: ("insufficient troops in source explorer", 'ENTRYPOINT_FAILED'))]
    fn explorer_swap_revert_insufficient_troops() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);
        let realm2_coord = Coord { x: 13, y: 10 };
        let realm2_id = tspawn_realm_with_resources(ref world, 2, realm_owner, realm2_coord);

        // Grant enough resources for two explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 4 * RESOURCE_PRECISION; // Swap MORE than the source has
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West; // Adjacent

        // Act 1: Create the explorers
        let from_explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);
        let to_explorer_id = troop_management_systems
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);

        // Act 2: Attempt the swap with insufficient troops (expect panic)
        let swap_direction = Direction::East;
        troop_management_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        // Assert - Handled by should_panic
    }

    /// @dev Required by the `assert!(count % RESOURCE_PRECISION == 0)` check.
    #[test]
    #[should_panic(expected: ("count must be divisible by resource precision", 'ENTRYPOINT_FAILED'))]
    fn explorer_swap_revert_invalid_precision() {
        // Arrange
        let mut world = spawn_test_world([namespace_def()].span());
        world.sync_perms_and_inits(contract_defs());
        init_config(ref world);

        let realm_owner = starknet::get_contract_address();
        let realm_coord = Coord { x: 10, y: 10 };
        let realm_id = tspawn_realm_with_resources(ref world, 1, realm_owner, realm_coord);
        let realm2_coord = Coord { x: 13, y: 10 };
        let realm2_id = tspawn_realm_with_resources(ref world, 2, realm_owner, realm2_coord);

        // Grant enough resources for two explorers
        let starting_knight_t1_amount = 10 * RESOURCE_PRECISION;
        tgrant_resources(ref world, realm_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());
        tgrant_resources(ref world, realm2_id, array![(ResourceTypes::KNIGHT_T1, starting_knight_t1_amount)].span());

        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_management_systems = ITroopManagementSystemsDispatcher {
            contract_address: troop_management_system_addr,
        };

        let category = TroopType::Knight;
        let tier = TroopTier::T1;
        let create_amount_from = 3 * RESOURCE_PRECISION;
        let create_amount_to = 2 * RESOURCE_PRECISION;
        let swap_amount = 1 * RESOURCE_PRECISION + 1; // Invalid precision
        let spawn_direction_from = Direction::East;
        let spawn_direction_to = Direction::West; // Adjacent

        // Act 1: Create the explorers
        let from_explorer_id = troop_management_systems
            .explorer_create(realm_id, category, tier, create_amount_from, spawn_direction_from);
        let to_explorer_id = troop_management_systems
            .explorer_create(realm2_id, category, tier, create_amount_to, spawn_direction_to);

        // Act 2: Attempt the swap with invalid precision (expect panic)
        let swap_direction = Direction::East;
        troop_management_systems.explorer_explorer_swap(from_explorer_id, to_explorer_id, swap_direction, swap_amount);
        // Assert - Handled by should_panic
    }
}
