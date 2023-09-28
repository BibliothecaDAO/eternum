use eternum::alias::ID;
use eternum::utils::coin_toss;

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Attack {
    #[key]
    entity_id: ID,
    chance: u8,
    last_attack: u64
}

#[generate_trait]
impl AttackImpl of AttackTrait{
    
    fn get_cost(self: @Attack) -> u8 {
        // todo@credence move hardcoded price to config
        *self.chance * 40 
    }

    #[inline(always)]
    fn new(entity_id: ID, chance: u8) -> Attack {
        assert(chance <= AttackImpl::max_chance() - 3, 
            // e.g max_chance = 7 / 10 so that you can only increase 
            // your chances and can't actually buy the outcome
            'chance is greater than max' 
        );
        assert(chance > 0, 'chance is 0');
        
        Attack {
            entity_id,
            chance,
            last_attack: 0
        }
    }


    fn can_attack(self: @Attack) -> bool {
        if *self.chance > 0  {
            // todo@credence move hardcoded cooldown to config
            let cooldown = 60 * 60 * 3; // 3 minutes
            let time_passed_since_last_attack = starknet::get_block_timestamp() - *self.last_attack;
            if  time_passed_since_last_attack > cooldown {
                return true;
            }
        }
        
        return false;
    }

    /// Returns true if attack was successful
    fn launch(self: @Attack) -> bool { 
        // e.g if they have 7/10 chance, then they have to roll a die 10 times
        // and if they get heads up to 3 times, they win    
        coin_toss(AttackImpl::max_chance() - *self.chance, AttackImpl::max_chance())
    }


    fn max_chance() -> u8 {
        10
    }
}


