use alexandria_data_structures::array_ext::ArrayTraitExt;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::{
    models::{combat::Army, config::{StaminaConfig, StaminaRefillConfig, TickConfig, TickImpl}},
    constants::{ResourceTypes, TravelTypes, TravelTypesImpl, WORLD_CONFIG_ID}
};

#[derive(IntrospectPacked, Copy, Drop, Serde)]
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

    fn drain(ref self: Stamina, world: IWorldDispatcher) {
        self.refill_if_next_tick(world);
        self.substract_costs(self.amount, world);
    }

    fn substract_costs(ref self: Stamina, costs: u16, world: IWorldDispatcher) {
        self.amount -= costs;
        self.sset(world);
    }

    fn sset(ref self: Stamina, world: IWorldDispatcher) {
        set!(world, (self));
    }

    fn max(ref self: Stamina, world: IWorldDispatcher) -> u16 {
        let army = get!(world, (self.entity_id,), Army);
        let troops = army.troops;
        let mut maxes = array![];

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

        maxes.min().unwrap()
    }

    fn refill(ref self: Stamina, world: IWorldDispatcher) {
        let stamina_refill_config = get!(world, WORLD_CONFIG_ID, StaminaRefillConfig);
        let stamina_per_tick = stamina_refill_config.amount_per_tick;

        let current_tick = TickImpl::get_armies_tick_config(world).current();
        let num_ticks_passed = current_tick - self.last_refill_tick;

        let total_stamina = num_ticks_passed * stamina_per_tick.into();
        let total_stamina_since_last_tick: u16 = match total_stamina.try_into() {
            Option::Some(value) => value,
            Option::None => { self.max(world) }
        };

        self.amount = core::cmp::min(self.amount + total_stamina_since_last_tick, self.max(world));
        self.last_refill_tick = current_tick;
        self.sset(world);
    }


    fn assert_enough_stamina(self: Stamina, cost: u16) {
        assert(self.amount >= cost, 'not enough stamina');
    }
}
