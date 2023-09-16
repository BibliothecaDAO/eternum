#[system]
mod TransferResources {
    use eternum::alias::ID;
    use eternum::components::resources::Resource;
    use eternum::components::owner::Owner;
    use eternum::components::position::Position;
    use eternum::components::config::WeightConfigImpl;

    use dojo::world::Context;

    use core::traits::Into;
    use core::array::SpanTrait;

    fn execute(ctx: Context, sending_entity_id: ID, receiving_entity_id: ID, mut resources: Span<(u8, u128)>) {

        let sending_entity_owner = get!(ctx.world, sending_entity_id, Owner);
        assert(sending_entity_owner.address == ctx.origin, 'not owner of entity id');
        
        // compare positions
        let sending_entity_position = get!(ctx.world, sending_entity_id, Position);
        let receiving_entity_position = get!(ctx.world, receiving_entity_id, Position);

        assert(receiving_entity_position.x !=  0, 'entity position mismatch');
        assert(receiving_entity_position.y != 0, 'entity position mismatch');

        assert(receiving_entity_position.x == sending_entity_position.x, 'entity position mismatch');
        assert(receiving_entity_position.y == sending_entity_position.y, 'entity position mismatch');
       
        // get receiving entity's total capacity
        let receiving_entity_capacity = get!(ctx.world, receiving_entity_id, Capacity);
        let receiving_entity_total_capacity = 0;
        if receiving_entity_capacity.weight_gram != 0 {
            let receiving_entity_quantity = (get!(ctx.world, receiving_entity_id, Quantity )).get_value();
            receiving_entity_total_capacity = receiving_entity_capacity.weight_gram * receiving_entity_quantity;
        }
        

        let mut total_weight = 0;
        loop {
            match resources.pop_front() {
                Option::Some((resource_type, resource_amount)) => {
                    assert(resource_amount != 0, 'resource transfer amount is 0');

                    let sending_entity_resource = get!(ctx.world, (sending_entity_id, resource_type) , Resource);  
                    assert(sending_entity_resource.balance >= resource_amount, 'insufficient balance');

                    let receiving_entity_resource = get!(ctx.world, (receiving_entity_id, resource_type) , Resource);
                    set!(ctx.world, (
                        Resource { 
                            entity_id: sending_entity_id, 
                            resource_type: resource_type, 
                            balance: sending_entity_resource.balance - resource_amount
                        },
                        Resource { 
                            entity_id: receiving_entity_id, 
                            resource_type: resource_type, 
                            balance: receiving_entity_resource.balance + resource_amount
                        }
                    ));
                    
                    total_weight += WeightConfigImpl::get_weight(
                        ctx.world, resource_type, resource_amount.into()
                    );
                },
                Option::None(_) => {break;}
            };
        };

        // ensure receiving entity has adequate capacity
        if receiving_entity_total_capacity != 0 {
            assert(receiving_entity_total_capacity >= total_weight, 'receiving entity capacity not enough');
        }
    }   
}