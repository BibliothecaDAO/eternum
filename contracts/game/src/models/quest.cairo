use s0_eternum::alias::ID;

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Quest {
    #[key]
    entity_id: ID,
    #[key]
    config_id: ID,
    completed: bool,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct QuestBonus {
    #[key]
    entity_id: ID,
    #[key]
    resource_type: u8,
    claimed: bool
}
