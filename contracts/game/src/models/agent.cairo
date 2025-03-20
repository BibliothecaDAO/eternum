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


#[generate_trait]
pub impl AgentCountImpl of AgentCountTrait {
    fn increase(ref world: WorldStorage) {
        let mut agent_count: AgentCount = world.read_model(WORLD_CONFIG_ID);
        agent_count.count += 1;
        world.write_model(@agent_count);
    }

    fn decrease(ref world: WorldStorage) {
        let mut agent_count: AgentCount = world.read_model(WORLD_CONFIG_ID);
        agent_count.count -= 1;
        world.write_model(@agent_count);
    }
}
