use alexandria_data_structures::array_ext::ArrayTraitExt;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::{
    models::{combat::Army, config::{StaminaConfig, StaminaRefillConfig, TickConfig, TickImpl}},
    constants::{ResourceTypes, TravelTypes, WORLD_CONFIG_ID}
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
impl StaminaImpl of StaminaTrait {
    fn handle_stamina_costs(army_entity_id: ID, stamina_cost: u16, ref world: WorldStorage) {
        let mut stamina: Stamina = world.read_model((army_entity_id));
        stamina.refill_if_next_tick(ref world);
        stamina.assert_enough_stamina(stamina_cost);
        stamina.substract_costs(stamina_cost, ref world);
    }

    fn refill_if_next_tick(ref self: Stamina, ref world: WorldStorage) {
        let armies_tick_config = TickImpl::get_armies_tick_config(ref world);
        if (self.last_refill_tick != armies_tick_config.current()) {
            self.refill(ref world);
        }
    }

    fn drain(ref self: Stamina, ref world: WorldStorage) {
        self.refill_if_next_tick(ref world);
        self.substract_costs(self.amount, ref world);
    }

    fn substract_costs(ref self: Stamina, costs: u16, ref world: WorldStorage) {
        self.amount -= costs;
        self.sset(ref world);
    }

    fn sset(ref self: Stamina, ref world: WorldStorage) {
        world.write_model(@self);
    }

    fn max(ref self: Stamina, ref world: WorldStorage) -> u16 {
        let army: Army = world.read_model(self.entity_id);
        let troops = army.troops;
        let mut maxes = array![];

        if (troops.knight_count > 0) {
            let knight_config: StaminaConfig = world.read_model((WORLD_CONFIG_ID, ResourceTypes::KNIGHT));
            maxes.append(knight_config.max_stamina);
        }
        if (troops.paladin_count > 0) {
            let paladin_config: StaminaConfig = world.read_model((WORLD_CONFIG_ID, ResourceTypes::PALADIN));
            maxes.append(paladin_config.max_stamina);
        }
        if (troops.crossbowman_count > 0) {
            let crossbowman_config: StaminaConfig = world.read_model((WORLD_CONFIG_ID, ResourceTypes::CROSSBOWMAN));
            maxes.append(crossbowman_config.max_stamina);
        }

        if maxes.len() > 0 {
            maxes.min().unwrap()
        } else {
            0
        }
    }

    fn refill(ref self: Stamina, ref world: WorldStorage) {
        let stamina_refill_config: StaminaRefillConfig = world.read_model(WORLD_CONFIG_ID);
        let stamina_per_tick = stamina_refill_config.amount_per_tick;

        let current_tick = TickImpl::get_armies_tick_config(ref world).current();
        let num_ticks_passed = current_tick - self.last_refill_tick;

        let total_stamina = num_ticks_passed * stamina_per_tick.into();
        let total_stamina_since_last_tick: u16 = match total_stamina.try_into() {
            Option::Some(value) => value,
            Option::None => { self.max(ref world) }
        };

        self.amount = core::cmp::min(self.amount + total_stamina_since_last_tick, self.max(ref world));
        self.last_refill_tick = current_tick;
        self.sset(ref world);
    }


    fn assert_enough_stamina(self: Stamina, cost: u16) {
        assert(self.amount >= cost, 'not enough stamina');
    }
}
