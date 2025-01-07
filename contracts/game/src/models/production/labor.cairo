use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s0_eternum::alias::ID;
use s0_eternum::models::config::{LaborConfig};
use s0_eternum::models::config::{TickConfig, TickImpl, TickTrait};
use s0_eternum::models::resources::{Resource, ResourceImpl};


#[generate_trait]
impl LaborImpl LaborTrait {

    fn labor_type_from_resource(resource_type: u8) -> u8 {
        return 255 - resource_type;
    }

    fn make_labor(ref world: WorldStorage, entity_id: ID, resource_type: u8, labor_amount: u128) {

        assert!(resource_type.is_non_zero(), "can't make labor for 0 resource");
        assert!(labor_amount.is_non_zero(), "can't make 0 labor");
        assert!(entity_id.is_non_zero(), "can't make labor for 0 entity");

        // ensure there is a config for this labor resource
        let labor_config: LaborConfig = world.read_model(resource_type);
        let input_count = labor_config.input_count; 
        assert!(input_count.is_non_zero(), "can't make labor for specified resource");

        for i in 0..input_count {
            let resource_cost: ResourceCost = world.read_model((labor_config.input_id, i));
            let input_resource_type = resource_cost.resource_type;
            let input_resource_amount = resource_cost.amount;
            assert!(input_resource_amount.is_non_zero(), "labor resource cost is 0");

            // make payment for labor
            let input_resource = ResourceImpl::get(ref world, (entity_id, input_resource_type));
            input_resource.burn(input_resource_amount * labor_amount);
            input_resource.save(ref world);
        }

        // make labor resource
        let labor_resource_type = Self::labor_type_from_resource(resource_type);
        let labor_resource = ResourceImpl::get(ref world, (entity_id, labor_resource_type));
        labor_resource.add(labor_amount);
        labor_resource.save(ref world);

        // todo add event here
    }
}