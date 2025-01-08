use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s0_eternum::alias::ID;
use s0_eternum::constants::{LAST_REGULAR_RESOURCE_ID};
use s0_eternum::models::config::{LaborConfig};
use s0_eternum::models::config::{TickConfig, TickImpl, TickTrait};
use s0_eternum::models::resources::{Resource, ResourceImpl};


#[generate_trait]
impl LaborImpl LaborTrait {

    fn labor_resource_from_regular(resource_type: u8) -> u8 {
        return 255 - resource_type;
    }

    fn resource_from_labor(labor_type: u8) -> u8 {
        return 255 - labor_type;
    }

    fn is_labor(resource_type: u8) -> bool {
        return resource_type != 255 && resource_type >= 255 - LAST_LABOR_RESOURCE_ID;
    }

    fn make_labor(ref world: WorldStorage, entity_id: ID, resource_type: u8, labor_amount: u128) {

        assert!(resource_type.is_non_zero(), "wrong labor resource type");
        assert!(labor_amount.is_non_zero(), "zero labor amount");
        assert!(entity_id.is_non_zero(), "zero entity id");

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
        let labor_resource_type = Self::labor_resource_from_regular(resource_type);
        let mut labor_resource = ResourceImpl::get(ref world, (entity_id, labor_resource_type));
        labor_resource.add(labor_amount);
        labor_resource.save(ref world);

        // todo add event here
    }

    fn add_production_labor(ref world: WorldStorage, entity_id: ID, resource_type: u8, labor_amount: u128) {

        assert!(resource_type.is_non_zero(), "wrong labor resource type");
        assert!(labor_amount.is_non_zero(), "zero labor amount");
        assert!(entity_id.is_non_zero(), "zero entity id");

        // ensure entity is a structure
        let entity_structure: Structure = world.read_model(self.entity_id);
        assert!(entity_structure.is_structure(), "entity is not a structure");
        
        // ** ADD LABOR AMOUNT TO PRODUCTION ** //

        let resource: Resource = ResourceImpl::get(ref world, (entity_id, resource_type));
        let mut resource_production: Production = world.read_model((entity_id, resource_type));
        resource_production.add_labor(labor_amount);
        world.write_model(resource_production);

        // ** BURN LABOR AMOUNT FROM LABOR RESOURCE ** //

        let labor_resource_type = Self::labor_resource_from_regular(resource_type);
        let mut labor_resource = ResourceImpl::get(ref world, (entity_id, labor_resource_type));
        labor_resource.burn(labor_amount);
        labor_resource.save(ref world);   

        // todo add event here
    }
}