use eternum::alias::ID;
use eternum::utils::coin_toss;

#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct Attack {
    #[key]
    entity_id: ID,
    value: u8,
    last_attack: u64
}

#[generate_trait]
impl AttackImpl of AttackTrait{

    /// Check whether an attack can be launched
    ///
    /// Returns true if it can else false
    ///
    fn can_launch(self: @Attack, min_cooldown_minutes: u64 ) -> bool {
        if *self.value > 0  {

            let time_passed_since_last_attack = starknet::get_block_timestamp() - *self.last_attack;
            if  time_passed_since_last_attack > min_cooldown_minutes {
                return true;
            }
        }
        
        return false;
    }

    /// Launch attack
    ///
    /// Returns true if attack was successful, 
    /// false otherwise
    ///
    fn launch(self: @Attack) -> bool { 
        // if self.value == 7, for example, they have 
        // to roll a die 10 (max) times and if they get 
        // heads up to 3 times, they win.   
        coin_toss(AttackImpl::max_value() - *self.value, AttackImpl::max_value())
    }


    fn max_value() -> u8 {
        10
    }
}


