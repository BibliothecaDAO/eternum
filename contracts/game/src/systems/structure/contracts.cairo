use s1_eternum::alias::ID;

#[starknet::interface]
pub trait IStructureSystems<T> {
    fn level_up(ref self: T, structure_id: ID);
}

#[dojo::contract]
pub mod structure_systems {
    use achievement::store::{StoreTrait};
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;

    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS};
    use s1_eternum::models::config::{SeasonConfigImpl, SettlementConfigImpl, StructureLevelConfig, WorldConfigUtilImpl};
    use s1_eternum::models::owner::{OwnerAddressTrait};
    use s1_eternum::models::resource::production::building::{BuildingImpl};
    use s1_eternum::models::resource::resource::{ResourceList};
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::structure::{
        StructureBase, StructureBaseImpl, StructureBaseStoreImpl, StructureCategory, StructureImpl,
        StructureOwnerStoreImpl,
    };
    use s1_eternum::models::weight::{Weight};
    use s1_eternum::utils::tasks::index::{Task, TaskTrait};
    use starknet::ContractAddress;

    #[abi(embed_v0)]
    impl StructureSystemsImpl of super::IStructureSystems<ContractState> {
        fn level_up(ref self: ContractState, structure_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure caller owns the structure
            let mut structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            structure_owner.assert_caller_owner();

            // ensure entity is a realm or village
            let mut structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            assert!(
                structure_base.category == StructureCategory::Realm.into()
                    || structure_base.category == StructureCategory::Village.into(),
                "structure is not a realm or village",
            );

            // ensure structure is not already at max level
            let max_level = structure_base.max_level(world);
            assert!(structure_base.level < max_level, "structure is already at max level");

            // make payment to upgrade to next level
            let next_level = structure_base.level + 1;
            let structure_level_config: StructureLevelConfig = world.read_model(next_level);
            let required_resources_id = structure_level_config.required_resources_id;
            let required_resource_count = structure_level_config.required_resource_count;

            let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, structure_id);
            let mut index = 0;
            loop {
                if index == required_resource_count {
                    break;
                }

                let mut required_resource: ResourceList = world.read_model((required_resources_id, index));
                // burn resource from realm
                let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, required_resource.resource_type);
                let mut structure_resource = SingleResourceStoreImpl::retrieve(
                    ref world,
                    structure_id,
                    required_resource.resource_type,
                    ref structure_weight,
                    resource_weight_grams,
                    true,
                );
                structure_resource.spend(required_resource.amount, ref structure_weight, resource_weight_grams);
                structure_resource.store(ref world);

                index += 1;
            };

            // update structure weight
            structure_weight.store(ref world, structure_id);

            // update structure level and troop max guard count
            structure_base.level = next_level;
            structure_base.troop_max_guard_count += 1;
            StructureBaseStoreImpl::store(ref structure_base, ref world, structure_id);

            // [Achievement] Upgrade to max level
            if structure_base.level == max_level {
                let player_id: felt252 = starknet::get_caller_address().into();
                let task_id: felt252 = Task::Maximalist.identifier();
                let store = StoreTrait::new(world);
                store.progress(player_id, task_id, count: 1, time: starknet::get_block_timestamp());
            }
        }
    }
}
