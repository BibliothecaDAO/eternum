use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::alias::ID;
use s1_eternum::constants::WORLD_CONFIG_ID;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct AgentOwner {
    #[key]
    pub explorer_id: ID,
    pub address: starknet::ContractAddress,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct AgentCount {
    #[key]
    pub id: ID,
    pub count: u16,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct AgentLifetimeCount {
    #[key]
    pub id: ID,
    pub count: u16,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct AgentLordsMinted {
    #[key]
    pub id: ID,
    pub amount: u32,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct AgentConfig {
    #[key]
    pub id: ID,
    pub max_lifetime_count: u16,
    pub max_current_count: u16,
    pub min_spawn_lords_amount: u8,
    pub max_spawn_lords_amount: u8,
}

#[generate_trait]
pub impl AgentCountImpl of AgentCountTrait {
    fn limit_reached(world: WorldStorage) -> bool {
        let agent_config: AgentConfig = world.read_model(WORLD_CONFIG_ID);
        let agent_current_count: AgentCount = world.read_model(WORLD_CONFIG_ID);
        if (agent_current_count.count >= agent_config.max_current_count) {
            return true;
        }

        let agent_lifetime_count: AgentLifetimeCount = world.read_model(WORLD_CONFIG_ID);
        if (agent_lifetime_count.count >= agent_config.max_lifetime_count) {
            return true;
        }

        return false;
    }

    fn increase(ref world: WorldStorage) {
        let mut agent_current_count: AgentCount = world.read_model(WORLD_CONFIG_ID);
        agent_current_count.count += 1;
        world.write_model(@agent_current_count);

        let mut agent_lifetime_count: AgentLifetimeCount = world.read_model(WORLD_CONFIG_ID);
        agent_lifetime_count.count += 1;
        world.write_model(@agent_lifetime_count);
    }

    fn decrease(ref world: WorldStorage) {
        let mut agent_current_count: AgentCount = world.read_model(WORLD_CONFIG_ID);
        agent_current_count.count -= 1;
        world.write_model(@agent_current_count);
    }
}


#[generate_trait]
pub impl AgentLordsMintedImpl of AgentLordsMintedTrait {
    fn increase(ref world: WorldStorage, amount: u32) {
        let mut agent_lords_minted: AgentLordsMinted = world.read_model(WORLD_CONFIG_ID);
        agent_lords_minted.amount += amount;
        world.write_model(@agent_lords_minted);
    }
}
