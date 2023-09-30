use eternum::constants::ResourceTypes;

fn assert_harvestable_resource(resource_type: u8) {
    let is_food = (resource_type == ResourceTypes::FISH) | (resource_type == ResourceTypes::WHEAT);

    let is_minable_resource = (resource_type > 0) & (resource_type <= 28);

    assert(is_food | is_minable_resource, 'Invalid resource type');
}

fn get_labor_resource_type(resource_type: u8) -> u8 {
    let is_food = (resource_type == ResourceTypes::FISH) | (resource_type == ResourceTypes::WHEAT);

    let is_minable_resource = (resource_type > 0) & (resource_type <= 28);

    let labor_resource_type: u8 = if is_food {
        resource_type - 3
    } else {
        resource_type + 28
    };

    labor_resource_type
}
