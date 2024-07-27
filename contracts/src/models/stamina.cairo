use alexandria_data_structures::array_ext::ArrayImpl;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::{
    models::{combat::Army, config::{StaminaConfig, TickConfig, TickImpl}},
    constants::{ResourceTypes, TravelTypes, TravelTypesImpl, WORLD_CONFIG_ID}
};

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Stamina {
    #[key]
    entity_id: ID,
    amount: u16,
    last_refill_tick: u64,
}

#[generate_trait]
impl StaminaCustomImpl of StaminaCustomTrait {
    fn handle_stamina_costs(army_entity_id: ID, travel: TravelTypes, world: IWorldDispatcher) {
        let mut stamina = get!(world, (army_entity_id), Stamina);
        stamina.refill_if_next_tick(world);
        let costs = travel.get_stamina_costs();
        stamina.assert_enough_stamina(costs);
        stamina.substract_costs(costs, world);
    }

    fn refill_if_next_tick(ref self: Stamina, world: IWorldDispatcher) {
        let armies_tick_config = TickImpl::get_armies_tick_config(world);
        if (self.last_refill_tick != armies_tick_config.current()) {
            self.refill(world);
        }
    }

    fn substract_costs(ref self: Stamina, costs: u16, world: IWorldDispatcher) {
        self.amount -= costs;
        self.sset(world);
    }

    fn sset(ref self: Stamina, world: IWorldDispatcher) {
        set!(world, (self));
    }

    fn refill(ref self: Stamina, world: IWorldDispatcher) {
        let army = get!(world, (self.entity_id,), Army);
        let troops = army.troops;
        let mut maxes = array![];
        let armies_tick_config = TickImpl::get_armies_tick_config(world);

        if (troops.knight_count > 0) {
            let knight_config = get!(world, (WORLD_CONFIG_ID, ResourceTypes::KNIGHT), StaminaConfig);
            maxes.append(knight_config.max_stamina);
        }
        if (troops.paladin_count > 0) {
            let paladin_config = get!(world, (WORLD_CONFIG_ID, ResourceTypes::PALADIN), StaminaConfig);
            maxes.append(paladin_config.max_stamina);
        }
        if (troops.crossbowman_count > 0) {
            let crossbowman_config = get!(world, (WORLD_CONFIG_ID, ResourceTypes::CROSSBOWMAN), StaminaConfig);
            maxes.append(crossbowman_config.max_stamina);
        }

        assert(maxes.len() > 0, 'No troops in army');

        self.amount = maxes.min().unwrap();
        self.last_refill_tick = armies_tick_config.current();
        self.sset(world);
    }


    fn assert_enough_stamina(self: Stamina, cost: u16) {
        assert(self.amount >= cost, 'not enough stamina');
    }
}
